import { it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setPool } from '../src/db/pool.js';
const registration = {
  fullName: 'New Candidate',
  email: 'New@Example.test',
  mobileNumber: '+919876543210',
  password: 'a test passphrase'
};
it('registration rejects every missing/empty field and requires both contacts', async () => {
  for (const field of Object.keys(registration)) {
    for (const value of [undefined, null, '']) {
      const body = { ...registration, [field]: value };
      if (value === undefined) delete body[field];
      const r = await request(app)
        .post('/api/auth/register')
        .set('Origin', env.FRONTEND_ORIGIN)
        .send(body);
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      assert.ok(r.body.error.details.some((d) => d.field === field));
    }
  }
});
it('complete registration normalizes both contacts and creates only a candidate', async () => {
  let record;
  setPool({
    getConnection: async () => ({
      query: async ({ sql }, values) => {
        if (sql.startsWith('SET')) return [[]];
        if (sql.startsWith('INSERT INTO users')) {
          record = {
            id: 1,
            full_name: values[0],
            email: values[1],
            mobile_number: values[2],
            password_hash: values[3],
            role: values[4],
            is_active: 1
          };
          return [{ insertId: 1 }];
        }
        if (sql.includes('FROM users')) return [[record]];
        throw new Error('Unexpected test query');
      },
      release() {},
      destroy() {}
    })
  });
  try {
    const r = await request(app)
      .post('/api/auth/register')
      .set('Origin', env.FRONTEND_ORIGIN)
      .send(registration);
    assert.equal(r.status, 201);
    assert.equal(r.body.data.email, 'new@example.test');
    assert.equal(r.body.data.mobileNumber, registration.mobileNumber);
    assert.equal(r.body.data.role, 'candidate');
    assert.ok(record.password_hash.startsWith('$argon2id$'));
    assert.equal(r.body.data.password_hash, undefined);
  } finally {
    setPool(null);
  }
});
