import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateEnv } from '../src/config/env.js';

describe('Environment Configuration Validation', () => {
  it('throws an error listing missing variables when required keys are absent', () => {
    assert.throws(
      () => {
        parseAndValidateEnv({
          NODE_ENV: 'production',
          PORT: '4000'
        });
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Missing required environment variable(s)'));
        assert.ok(err.message.includes('DB_HOST'));
        assert.ok(err.message.includes('DB_USER'));
        return true;
      }
    );
  });

  it('rejects non-numeric PORT values', () => {
    assert.throws(
      () => {
        parseAndValidateEnv({
          NODE_ENV: 'development',
          PORT: 'invalid-port',
          FRONTEND_ORIGIN: 'http://localhost:5173',
          DB_HOST: 'localhost',
          DB_PORT: '3306',
          DB_NAME: 'tnp_job_portal',
          DB_USER: 'root',
          DB_PASSWORD: 'password',
          JWT_SECRET: 'test-secret-with-at-least-32-characters'
        });
      },
      (err) => {
        assert.ok(err.message.includes('PORT must be a valid port number'));
        return true;
      }
    );
  });

  it('parses valid environment configuration successfully', () => {
    const parsed = parseAndValidateEnv({
      NODE_ENV: 'development',
      PORT: '5000',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3307',
      DB_NAME: 'tnp_job_portal',
      DB_USER: 'app_user',
      DB_PASSWORD: 'app_password',
      DB_CONNECTION_LIMIT: '15',
      JWT_SECRET: 'test-secret-with-at-least-32-characters'
    });

    assert.equal(parsed.PORT, 5000);
    assert.equal(parsed.DB_PORT, 3307);
    assert.equal(parsed.DB_CONNECTION_LIMIT, 15);
    assert.equal(parsed.DB_USER, 'app_user');
    assert.equal(parsed.isProduction, false);
  });
});
