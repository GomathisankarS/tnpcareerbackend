import { it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { parseAndValidateEnv } from '../src/config/env.js';
import { redactSensitive } from '../src/config/logger.js';
it('rejects partial integers and unsafe origins', () => {
  const base = { NODE_ENV: 'test' };
  for (const patch of [
    { PORT: '4000junk' },
    { DB_PORT: '3306x' },
    { DB_CONNECTION_LIMIT: '2.5' },
    { NODE_ENV: 'unknown' },
    { FRONTEND_ORIGIN: 'not-a-url' },
    { FRONTEND_ORIGIN: 'http://example.com' }
  ])
    assert.throws(() => parseAndValidateEnv({ ...base, ...patch }));
});
it('oversized JSON is a safe 413', async () => {
  const r = await request(app)
    .post('/api/health')
    .send({ x: 'x'.repeat(1048576) });
  assert.equal(r.status, 413);
  assert.equal(r.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.ok(r.body.requestId);
});
it('replaces unbounded request ids and redacts error strings and token variants', async () => {
  const r = await request(app).get('/api/health').set('X-Request-Id', 'x'.repeat(200));
  assert.equal(r.headers['x-request-id'].length, 36);
  const safe = JSON.stringify(
    redactSensitive({
      errorMessage: 'synthetic-secret',
      refresh_token: 'synthetic-secret',
      nested: { password: 'synthetic-secret' },
      error: new Error('synthetic-secret')
    })
  );
  assert.ok(!safe.includes('synthetic-secret'));
});
