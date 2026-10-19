import { it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  accessToken,
  verifyAccess,
  hashRefresh,
  newRefresh
} from '../src/modules/auth/auth.service.js';
import { env } from '../src/config/env.js';
import { setPool } from '../src/db/pool.js';
it('access JWT rejects expired tokens, wrong audience and wrong algorithms', () => {
  assert.equal(verifyAccess(accessToken({ id: 9 })), 9);
  for (const options of [
    { expiresIn: -1, audience: env.JWT_AUDIENCE, algorithm: 'HS256' },
    { expiresIn: 60, audience: 'other', algorithm: 'HS256' },
    { expiresIn: 60, audience: env.JWT_AUDIENCE, algorithm: 'HS384' }
  ]) {
    const token = jwt.sign({}, env.JWT_SECRET, {
      subject: '9',
      issuer: env.JWT_ISSUER,
      ...options
    });
    assert.throws(() => verifyAccess(token));
  }
  const token = newRefresh();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(hashRefresh(token).length, 32);
  assert.ok(!hashRefresh(token).equals(Buffer.from(token)));
});
it('auth endpoints reject untrusted origins and candidate role injection before SQL', async () => {
  const r = await request(app).post('/api/auth/refresh');
  assert.equal(r.status, 403);
  const registration = await request(app)
    .post('/api/auth/register')
    .set('Origin', env.FRONTEND_ORIGIN)
    .send({
      fullName: 'Someone',
      email: 'someone@example.com',
      password: 'long-passphrase',
      role: 'admin'
    });
  assert.equal(registration.status, 400);
  const missing = await request(app).get('/api/admin/jobs');
  assert.equal(missing.status, 401);
});
it('candidate cannot access admin APIs and inactive users are rejected', async () => {
  let active = 1;
  setPool({
    getConnection: async () => ({
      query: async ({ sql }) =>
        sql.startsWith('SET')
          ? [[]]
          : [[{ id: 5, full_name: 'Candidate', role: 'candidate', is_active: active }]],
      release() {},
      destroy() {}
    })
  });
  try {
    let r = await request(app)
      .get('/api/admin/jobs')
      .auth(accessToken({ id: 5 }), { type: 'bearer' });
    assert.equal(r.status, 403);
    active = 0;
    r = await request(app)
      .get('/api/auth/me')
      .auth(accessToken({ id: 5 }), { type: 'bearer' });
    assert.equal(r.status, 401);
  } finally {
    setPool(null);
  }
});
