import { it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPool } from '../src/db/pool.js';
import { accessToken } from '../src/modules/auth/auth.service.js';
it('per-job status uses the signed-in candidate, validates the job id, and rejects guests/admins', async () => {
  let role = 'candidate';
  const lookups = [];
  setPool({
    getConnection: async () => ({
      query: async ({ sql }, values) => {
        if (sql.startsWith('SET')) return [[]];
        if (sql.includes('FROM users'))
          return [[{ id: 5, full_name: 'Candidate', role, is_active: 1 }]];
        if (sql.includes('FROM job_applications')) {
          lookups.push(values);
          return [[{ id: 1, jobId: 9, status: 'submitted', createdAt: new Date() }]];
        }
        throw new Error('Unexpected test query');
      },
      release() {},
      destroy() {}
    })
  });
  try {
    const token = accessToken({ id: 5 });
    let r = await request(app)
      .get('/api/applications/job/9?candidateId=99')
      .auth(token, { type: 'bearer' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'submitted');
    assert.deepEqual(lookups, [[5, 9]]);
    r = await request(app).get('/api/applications/job/invalid').auth(token, { type: 'bearer' });
    assert.equal(r.status, 400);
    assert.equal((await request(app).get('/api/applications/job/9')).status, 401);
    role = 'admin';
    assert.equal(
      (await request(app).get('/api/applications/job/9').auth(token, { type: 'bearer' })).status,
      403
    );
  } finally {
    setPool(null);
  }
});
