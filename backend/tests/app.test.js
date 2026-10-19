import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Express Application & Middleware Foundation', () => {
  it('GET /api/health returns 200 with server liveness status', async () => {
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'healthy');
    assert.equal(typeof res.body.data.uptimeSeconds, 'number');
    assert.ok(res.body.data.timestamp);
    assert.ok(res.headers['x-request-id']);
  });

  it('GET /api/unknown returns 404 with standardized error contract', async () => {
    const res = await request(app).get('/api/unknown');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.message.includes('/api/unknown'));
    assert.ok(res.body.requestId);
    assert.equal(res.body.requestId, res.headers['x-request-id']);
  });

  it('sets secure HTTP response headers via Helmet', async () => {
    const res = await request(app).get('/api/health');

    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
  });

  it('handles malformed JSON body with a clean 400 INVALID_JSON response', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"badJson": ');

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_JSON');
    assert.ok(res.body.requestId);
  });
});
