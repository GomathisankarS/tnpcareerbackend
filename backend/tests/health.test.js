import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPool } from '../src/db/pool.js';

describe('Health Module & Database Readiness Probes', () => {
  beforeEach(() => {
    // Reset pool before each test
    setPool(null);
  });

  afterEach(() => {
    // Cleanup pool after each test
    setPool(null);
  });

  it('GET /api/health/db returns 200 when database connectivity is verified', async () => {
    // Inject mock pool that succeeds
    const mockSuccessPool = {
      query: async (sql) => {
        if (sql.includes('SELECT 1')) {
          return [[{ alive: 1 }]];
        }
        return [[]];
      }
    };
    setPool(mockSuccessPool);

    const res = await request(app).get('/api/health/db');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'healthy');
    assert.equal(res.body.data.database, 'connected');
    assert.ok(res.body.data.timestamp);
    assert.ok(res.headers['x-request-id']);
  });

  it('GET /api/health/db returns 503 DATABASE_UNAVAILABLE when database connection fails', async () => {
    // Inject mock pool that throws connection error
    const mockFailingPool = {
      query: async () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:3306 user secret_password_123');
        error.code = 'ECONNREFUSED';
        throw error;
      }
    };
    setPool(mockFailingPool);

    const res = await request(app).get('/api/health/db');

    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(res.body.error.message, 'Database service is currently unavailable');
    assert.ok(res.body.requestId);

    // CRITICAL: Ensure internal database connection details and secrets are not leaked
    const responseString = JSON.stringify(res.body);
    assert.equal(responseString.includes('ECONNREFUSED'), false);
    assert.equal(responseString.includes('secret_password_123'), false);
    assert.equal(responseString.includes('127.0.0.1'), false);
  });
});
