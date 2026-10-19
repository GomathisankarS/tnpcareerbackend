import { it } from 'node:test';
import assert from 'node:assert/strict';
import argon2 from 'argon2';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setPool } from '../src/db/pool.js';

it('login checks the selected role after credentials and before issuing a session', async () => {
  const password = 'role-login-test-passphrase';
  const user = {
    id: 1,
    full_name: 'Test User',
    role: 'admin',
    is_active: 1,
    email: 'role@example.test',
    password_hash: await argon2.hash(password)
  };
  let sessions = 0;
  setPool({
    getConnection: async () => ({
      query: async ({ sql }) => {
        if (sql.startsWith('SET')) return [[]];
        if (sql.includes('FROM users')) return [[user]];
        if (sql.startsWith('INSERT INTO auth_sessions')) {
          sessions++;
          return [{}];
        }
        throw new Error('Unexpected test query');
      },
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
      destroy() {}
    })
  });
  const login = (loginRole, suppliedPassword = password) =>
    request(app)
      .post('/api/auth/login')
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({ identifier: user.email, password: suppliedPassword, loginRole });
  try {
    for (const role of ['admin', 'candidate']) {
      user.role = role;
      const other = role === 'admin' ? 'candidate' : 'admin';
      let r = await login(other, 'incorrect-password');
      assert.equal(r.status, 401);
      assert.equal(r.body.error.code, 'UNAUTHENTICATED');
      r = await login(other);
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'LOGIN_ROLE_MISMATCH');
      assert.equal(r.headers['set-cookie'], undefined);
      assert.equal(r.body.data, undefined);
      assert.equal(sessions, role === 'admin' ? 0 : 1);
      r = await login(role);
      assert.equal(r.status, 200);
      assert.equal(r.body.data.user.role, role);
      assert.ok(r.headers['set-cookie']);
    }
    assert.equal(sessions, 2);
    assert.equal((await login('superadmin')).status, 400);
  } finally {
    setPool(null);
  }
});
