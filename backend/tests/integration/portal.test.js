// Explicit opt-in integration suite. It refuses any populated or non-test database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import argon2 from 'argon2';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const local = dotenv.config({ path: path.join(root, '.env') }).parsed || {};
const target = process.env.TEST_DB_NAME || local.TEST_DB_NAME;
if (!target || !/_test$/.test(target) || target === (local.DB_NAME || 'tnp_job_portal'))
  throw new Error(
    'Configure a separate empty TEST_DB_NAME ending in _test. Development data will not be used.'
  );
Object.assign(process.env, {
  ...local,
  ...process.env,
  NODE_ENV: 'test',
  DB_NAME: target,
  JWT_SECRET: randomBytes(48).toString('base64url')
});
let db, app, closePool, uploads;
let initialized = false;
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const origin = () => process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
let adminToken, candidateToken, mobileToken, candidateId, jobId, refreshCookie;
const job = {
  title: 'Integration Developer',
  companyName: 'Integration Company',
  categoryId: 1,
  locationCity: 'Kochi',
  employmentType: 'full_time',
  workMode: 'hybrid',
  experienceLevel: 'junior',
  minExperienceMonths: 0,
  maxExperienceMonths: 24,
  salaryMinAnnualInr: 400000,
  salaryMaxAnnualInr: 900000,
  description: 'A real test database job',
  skills: ['JavaScript', 'MySQL'],
  isFeatured: true,
  status: 'published'
};
before(async () => {
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: target,
    timezone: 'Z',
    multipleStatements: true
  });
  const [tables] = await db.query('SHOW TABLES');
  if (tables.length)
    throw new Error('Integration database must be empty. No existing tables were changed.');
  uploads = await mkdtemp(path.join(tmpdir(), 'tnp-resumes-'));
  process.env.UPLOAD_DIR = uploads;
  await db.query(await readFile(path.join(root, '../database/tnp_job_portal_schema.sql'), 'utf8'));
  await db.query(
    await readFile(path.join(root, '../database/migrations/001_managed_job_options.sql'), 'utf8')
  );
  await db.query(
    await readFile(path.join(root, '../database/migrations/002_requires_city_scope.sql'), 'utf8')
  );
  initialized = true;
  ({ app } = await import('../../src/app.js'));
  ({ closePool } = await import('../../src/db/pool.js'));
  await db.query(
    "INSERT INTO users (full_name,email,password_hash,role) VALUES ('Test Administrator','admin@example.test',?,'admin')",
    [await argon2.hash('integration-admin-pass', { type: argon2.argon2id })]
  );
  await db.query("INSERT INTO job_categories (name,slug) VALUES ('Engineering','engineering')");
});
after(async () => {
  if (closePool) await closePool();
  // Cleanup only tables created in the previously empty, explicitly selected test DB.
  if (db && initialized) {
    await db.query(
      'DROP TABLE job_applications,auth_sessions,jobs,candidate_profiles,job_categories,job_options,users'
    );
  }
  if (db) await db.end();
  if (uploads) {
    const resolved = path.resolve(uploads);
    if (
      !resolved.startsWith(path.resolve(tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith('tnp-resumes-')
    )
      throw new Error('Unsafe temporary cleanup target');
    await rm(resolved, { recursive: true, force: true });
  }
});
test('MySQL integration: complete portal workflows', async (t) => {
  await t.test('sessions use UTC and strict SQL on MySQL', async () => {
    const { query } = await import('../../src/db/pool.js');
    const [r] = await query(
      'SELECT VERSION() AS version,@@session.time_zone AS zone,@@session.sql_mode AS mode'
    );
    assert.match(r.version, /^8\./);
    assert.equal(r.zone, '+00:00');
    assert.ok(r.mode.includes('STRICT_TRANS_TABLES'));
    console.info(`Integration database server version: ${r.version}`);
    assert.equal((await request(app).get('/api/health/db')).status, 200);
  });
  await t.test(
    'registration requires both contacts, rejects duplicates and supports either login identifier',
    async () => {
      let r = await request(app).post('/api/auth/register').set('Origin', origin()).send({
        fullName: 'Candidate',
        email: 'Candidate@EXAMPLE.test',
        mobileNumber: '+919876543211',
        password: 'integration-candidate-pass'
      });
      assert.equal(r.status, 201);
      candidateId = r.body.data.id;
      r = await request(app).post('/api/auth/register').set('Origin', origin()).send({
        fullName: 'Mobile Candidate',
        email: 'mobile@example.test',
        mobileNumber: '+919876543210',
        password: 'integration-mobile-pass'
      });
      assert.equal(r.status, 201);
      r = await request(app).post('/api/auth/register').set('Origin', origin()).send({
        fullName: 'Duplicate',
        email: 'candidate@example.test',
        mobileNumber: '+919876543212',
        password: 'integration-candidate-pass'
      });
      assert.equal(r.status, 409);
      r = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin())
        .send({ identifier: 'candidate@example.test', password: 'wrong' });
      assert.equal(r.status, 401);
      r = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin())
        .send({ identifier: 'candidate@example.test', password: 'integration-candidate-pass' });
      assert.equal(r.status, 200);
      candidateToken = r.body.data.accessToken;
      refreshCookie = r.headers['set-cookie'][0].split(';')[0];
      assert.match(r.headers['set-cookie'][0], /HttpOnly/);
      assert.match(r.headers['set-cookie'][0], /SameSite=Lax/);
      assert.ok(!JSON.stringify(r.body).includes('refreshToken'));
      r = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin())
        .send({ identifier: '+919876543210', password: 'integration-mobile-pass' });
      assert.equal(r.status, 200);
      mobileToken = r.body.data.accessToken;
      r = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin())
        .send({ identifier: 'admin@example.test', password: 'integration-admin-pass' });
      adminToken = r.body.data.accessToken;
      assert.equal(r.status, 200);
    }
  );
  await t.test(
    'refresh rotation keeps expiry and commits family revocation on replay',
    async () => {
      const [beforeRows] = await db.query(
        'SELECT family_id,expires_at FROM auth_sessions WHERE user_id=?',
        [candidateId]
      );
      let r = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', origin())
        .set('Cookie', refreshCookie);
      assert.equal(r.status, 200);
      const replacement = r.headers['set-cookie'][0].split(';')[0];
      assert.notEqual(replacement, refreshCookie);
      const [rows] = await db.query(
        'SELECT expires_at,rotated_at FROM auth_sessions WHERE family_id=?',
        [beforeRows[0].family_id]
      );
      assert.equal(rows.length, 2);
      assert.equal(+rows[0].expires_at, +rows[1].expires_at);
      assert.ok(rows.some((r) => r.rotated_at));
      r = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', origin())
        .set('Cookie', refreshCookie);
      assert.equal(r.status, 401);
      r = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', origin())
        .set('Cookie', replacement);
      assert.equal(r.status, 401);
      const [revoked] = await db.query('SELECT revoked_at FROM auth_sessions WHERE family_id=?', [
        beforeRows[0].family_id
      ]);
      assert.ok(revoked.every((r) => r.revoked_at));
    }
  );
  await t.test('authorization, CRUD, public visibility, filters and dashboard', async () => {
    assert.equal(
      (await request(app).post('/api/admin/jobs').set(auth(candidateToken)).send(job)).status,
      403
    );
    let r = await request(app).post('/api/admin/jobs').set(auth(adminToken)).send(job);
    assert.equal(r.status, 201);
    jobId = r.body.data.id;
    r = await request(app).get('/api/jobs?categoryId=1&experienceLevel=junior&page=1&limit=1');
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.total, 1);
    assert.equal(r.body.data[0].id, jobId);
    r = await request(app)
      .put(`/api/admin/jobs/${jobId}`)
      .set(auth(adminToken))
      .send({ ...job, status: 'draft' });
    assert.equal(r.status, 200);
    assert.equal((await request(app).get(`/api/jobs/${jobId}`)).status, 404);
    assert.equal(
      (await request(app).put(`/api/admin/jobs/${jobId}`).set(auth(adminToken)).send(job)).status,
      200
    );
    r = await request(app).get('/api/admin/dashboard').set(auth(adminToken));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.totalJobs, 1);
  });
  await t.test(
    'profile required, PDF upload, duplicate application and immutable snapshot',
    async () => {
      const apply = () =>
        request(app)
          .post('/api/applications')
          .set(auth(candidateToken))
          .send({ jobId, coverNote: 'Interested in this role' });
      assert.equal((await apply()).body.error.code, 'PROFILE_REQUIRED');
      const pdf = await PDFDocument.create();
      pdf.addPage();
      const bytes = Buffer.from(await pdf.save());
      const withoutResume = await request(app)
        .put('/api/profile')
        .set(auth(candidateToken))
        .send({ currentCity: 'Kochi', totalExperienceMonths: 12, skills: ['React', 'MySQL'] });
      assert.equal(withoutResume.status, 400);
      assert.equal(withoutResume.body.error.code, 'RESUME_REQUIRED');
      assert.equal(
        (await request(app).get('/api/profile').set(auth(candidateToken))).body.data,
        null
      );
      assert.equal(
        (
          await request(app)
            .put('/api/profile')
            .set(auth(candidateToken))
            .field('currentCity', 'Kochi')
            .field('totalExperienceMonths', '12')
            .field('skills', JSON.stringify(['React', 'MySQL']))
            .attach('resume', bytes, { filename: 'resume.pdf', contentType: 'application/pdf' })
        ).status,
        200
      );
      // Fresh GETs simulate reloading the page rather than reading mutation state.
      const persisted = await request(app).get('/api/profile').set(auth(candidateToken));
      assert.equal(persisted.body.data.resume.originalName, 'resume.pdf');
      const download = await request(app).get('/api/profile/resume').set(auth(candidateToken));
      assert.equal(download.status, 200);
      assert.match(download.headers['content-type'], /application\/pdf/);
      assert.equal(Buffer.compare(download.body, bytes), 0);
      assert.equal(
        (
          await request(app)
            .put('/api/profile')
            .set(auth(candidateToken))
            .send({ currentCity: 'Mumbai', totalExperienceMonths: 24, skills: ['React', 'MySQL'] })
        ).status,
        200
      );
      assert.equal(
        (await request(app).get('/api/profile').set(auth(candidateToken))).body.data.resume
          .originalName,
        'resume.pdf'
      );
      assert.equal(
        (
          await request(app)
            .post('/api/profile/resume')
            .set(auth(candidateToken))
            .attach('resume', bytes, { filename: 'resume.pdf', contentType: 'application/pdf' })
        ).status,
        200
      );
      const r = await apply();
      assert.equal(r.status, 201);
      const applicationId = r.body.data.id;
      const repeat = await apply();
      assert.equal(repeat.status, 409);
      assert.equal(repeat.body.error.code, 'ALREADY_APPLIED');
      const ownStatus = await request(app)
        .get(`/api/applications/job/${jobId}`)
        .set(auth(candidateToken));
      assert.equal(ownStatus.status, 200);
      assert.equal(ownStatus.body.data.id, applicationId);
      assert.equal(
        (await request(app).get(`/api/applications/job/${jobId}`).set(auth(mobileToken))).body.data,
        null
      );
      const [[count]] = await db.query(
        'SELECT COUNT(*) AS total FROM job_applications WHERE job_id=? AND candidate_id=?',
        [jobId, candidateId]
      );
      assert.equal(count.total, 1);
      const [[snapshot]] = await db.query(
        'SELECT resume_storage_key FROM job_applications WHERE id=?',
        [applicationId]
      );
      assert.equal(
        (
          await request(app)
            .put('/api/profile')
            .set(auth(candidateToken))
            .field('currentCity', 'Mumbai')
            .field('totalExperienceMonths', '24')
            .field('skills', JSON.stringify(['React', 'MySQL']))
            .attach('resume', bytes, { filename: 'updated.pdf', contentType: 'application/pdf' })
        ).status,
        200
      );
      const [[profile]] = await db.query(
        'SELECT resume_storage_key FROM candidate_profiles WHERE user_id=?',
        [candidateId]
      );
      assert.notEqual(snapshot.resume_storage_key, profile.resume_storage_key);
      assert.equal(
        (
          await request(app)
            .get(`/api/applications/${applicationId}/resume`)
            .set(auth(candidateToken))
        ).status,
        200
      );
      assert.equal(
        (await request(app).get(`/api/applications/${applicationId}/resume`).set(auth(mobileToken)))
          .status,
        404
      );
      assert.equal(
        (await request(app).get(`/api/applications/${applicationId}/resume`).set(auth(adminToken)))
          .status,
        200
      );
      assert.equal(
        (await request(app).get('/api/applications').set(auth(candidateToken))).body.meta.total,
        1
      );
    }
  );
  await t.test(
    'failed combined profile save preserves existing data and removes the newly written file',
    async () => {
      const [[before]] = await db.query(
        'SELECT current_city,resume_storage_key FROM candidate_profiles WHERE user_id=?',
        [candidateId]
      );
      const filesBefore = (await readdir(uploads)).sort();
      const pdf = await PDFDocument.create();
      pdf.addPage();
      const bytes = Buffer.from(await pdf.save());
      await db.query(
        "CREATE TRIGGER fail_profile_update BEFORE UPDATE ON candidate_profiles FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected profile failure'"
      );
      try {
        const r = await request(app)
          .put('/api/profile')
          .set(auth(candidateToken))
          .field('currentCity', 'Delhi')
          .field('totalExperienceMonths', '36')
          .field('skills', JSON.stringify(['React']))
          .attach('resume', bytes, { filename: 'failed.pdf', contentType: 'application/pdf' });
        assert.equal(r.status, 500);
      } finally {
        await db.query('DROP TRIGGER fail_profile_update');
      }
      const [[after]] = await db.query(
        'SELECT current_city,resume_storage_key FROM candidate_profiles WHERE user_id=?',
        [candidateId]
      );
      assert.deepEqual(after, before);
      assert.deepEqual((await readdir(uploads)).sort(), filesBefore);
    }
  );
  await t.test('concurrent applications allow one insert and reject the duplicate', async () => {
    const created = await request(app)
      .post('/api/admin/jobs')
      .set(auth(adminToken))
      .send({ ...job, title: 'Concurrent applications' });
    assert.equal(created.status, 201);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post('/api/applications')
          .set(auth(candidateToken))
          .send({ jobId: created.body.data.id })
      )
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  });
  await t.test('refresh rollback preserves an unconsumed token after insert failure', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin())
      .send({ identifier: 'candidate@example.test', password: 'integration-candidate-pass' });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const [[before]] = await db.query('SELECT COUNT(*) AS count FROM auth_sessions');
    await db.query(
      "CREATE TRIGGER fail_refresh_insert BEFORE INSERT ON auth_sessions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected test failure'"
    );
    try {
      assert.equal(
        (await request(app).post('/api/auth/refresh').set('Origin', origin()).set('Cookie', cookie))
          .status,
        500
      );
    } finally {
      await db.query('DROP TRIGGER fail_refresh_insert');
    }
    const [[after]] = await db.query('SELECT COUNT(*) AS count FROM auth_sessions');
    assert.equal(after.count, before.count);
    assert.equal(
      (await request(app).post('/api/auth/refresh').set('Origin', origin()).set('Cookie', cookie))
        .status,
      200
    );
  });
  await t.test(
    'concurrent refresh detects replay and revokes the winning replacement',
    async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin())
        .send({ identifier: 'candidate@example.test', password: 'integration-candidate-pass' });
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      const responses = await Promise.all(
        [1, 2].map(() =>
          request(app).post('/api/auth/refresh').set('Origin', origin()).set('Cookie', cookie)
        )
      );
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
      const winner = responses.find((r) => r.status === 200).headers['set-cookie'][0].split(';')[0];
      assert.equal(
        (await request(app).post('/api/auth/refresh').set('Origin', origin()).set('Cookie', winner))
          .status,
        401
      );
    }
  );
  await t.test(
    'city applicability is NULL outside work modes and enforced by API and database',
    async () => {
      const values = (await request(app).get('/api/job-options')).body.data;
      assert.ok(values.experienceLevel.every((o) => o.requiresCity === null));
      assert.ok(values.employmentType.every((o) => o.requiresCity === null));
      assert.deepEqual(
        values.workMode.map((o) => [o.code, o.requiresCity]),
        [
          ['onsite', 1],
          ['hybrid', 1],
          ['remote', 0]
        ]
      );
      await assert.rejects(
        db.query("UPDATE job_options SET requires_city=1 WHERE kind='experienceLevel'")
      );
      await assert.rejects(
        db.query("UPDATE job_options SET requires_city=NULL WHERE kind='workMode'")
      );
      await assert.rejects(
        db.query("UPDATE job_options SET requires_city=2 WHERE kind='workMode'")
      );
      assert.equal(
        (
          await request(app).post('/api/admin/catalog/workMode').set(auth(adminToken)).send({
            name: 'Invalid city setting',
            code: 'invalid_city',
            isActive: true,
            requiresCity: null
          })
        ).status,
        400
      );
    }
  );
  await t.test(
    'managed dropdown CRUD, authorization, custom values, deactivation and safe deletion',
    async () => {
      const endpoint = '/api/admin/catalog/experienceLevel';
      assert.equal((await request(app).get(endpoint)).status, 401);
      assert.equal(
        (await request(app).post(endpoint).set(auth(candidateToken)).send({})).status,
        403
      );
      const data = {
        name: 'Principal engineer',
        code: 'principal',
        isActive: true,
        requiresCity: true
      };
      let r = await request(app).post(endpoint).set(auth(adminToken)).send(data);
      assert.equal(r.status, 201);
      assert.equal(r.body.data.requiresCity, null);
      const id = r.body.data.id;
      assert.equal(
        (await request(app).post(endpoint).set(auth(adminToken)).send(data)).status,
        409
      );
      r = await request(app)
        .post('/api/admin/jobs')
        .set(auth(adminToken))
        .send({ ...job, title: 'Custom experience job', experienceLevel: 'principal' });
      assert.equal(r.status, 201);
      const customJob = r.body.data.id;
      r = await request(app).get('/api/jobs?experienceLevel=principal');
      assert.equal(r.body.meta.total, 1);
      assert.equal(r.body.data[0].experienceLevelName, 'Principal engineer');
      assert.equal(
        (await request(app).delete(`${endpoint}/${id}`).set(auth(adminToken))).status,
        409
      );
      assert.equal(
        (
          await request(app)
            .put(`${endpoint}/${id}`)
            .set(auth(adminToken))
            .send({ ...data, code: 'changed' })
        ).status,
        400
      );
      assert.equal(
        (
          await request(app)
            .put(`${endpoint}/${id}`)
            .set(auth(adminToken))
            .send({ ...data, name: 'Principal', isActive: false })
        ).status,
        200
      );
      assert.equal(
        (
          await request(app)
            .post('/api/admin/jobs')
            .set(auth(adminToken))
            .send({ ...job, experienceLevel: 'principal' })
        ).status,
        400
      );
      assert.equal(
        (
          await request(app)
            .put(`/api/admin/jobs/${customJob}`)
            .set(auth(adminToken))
            .send({ ...job, title: 'Retained inactive option', experienceLevel: 'principal' })
        ).status,
        200
      );
      assert.equal(
        (await request(app).put(`/api/admin/jobs/${customJob}`).set(auth(adminToken)).send(job))
          .status,
        200
      );
      assert.equal(
        (await request(app).delete(`${endpoint}/${id}`).set(auth(adminToken))).status,
        204
      );
      for (const kind of ['categories', 'workMode', 'employmentType']) {
        const body = {
          name: `Temporary ${kind}`,
          code: kind === 'categories' ? 'temporary-category' : 'temporary_option',
          isActive: true,
          requiresCity: false
        };
        const created = await request(app)
          .post(`/api/admin/catalog/${kind}`)
          .set(auth(adminToken))
          .send(body);
        assert.equal(created.status, 201);
        if (kind === 'employmentType') assert.equal(created.body.data.requiresCity, null);
        assert.equal(
          (
            await request(app)
              .put(`/api/admin/catalog/${kind}/${created.body.data.id}`)
              .set(auth(adminToken))
              .send({ ...body, name: `Renamed ${kind}` })
          ).status,
          200
        );
        assert.equal(
          (
            await request(app)
              .delete(`/api/admin/catalog/${kind}/${created.body.data.id}`)
              .set(auth(adminToken))
          ).status,
          204
        );
      }
      assert.equal(
        (
          await request(app)
            .post('/api/admin/jobs')
            .set(auth(adminToken))
            .send({ ...job, workMode: 'missing_option' })
        ).status,
        400
      );
      assert.equal(
        (
          await request(app)
            .post('/api/admin/jobs')
            .set(auth(adminToken))
            .send({ ...job, workMode: 'hybrid', locationCity: null })
        ).status,
        400
      );
      assert.equal((await request(app).get('/api/job-options')).status, 200);
    }
  );
  await t.test('closed/deleted jobs reject apply; soft delete keeps history', async () => {
    await request(app)
      .put(`/api/admin/jobs/${jobId}`)
      .set(auth(adminToken))
      .send({ ...job, status: 'closed' });
    assert.equal(
      (await request(app).post('/api/applications').set(auth(candidateToken)).send({ jobId })).body
        .error.code,
      'JOB_UNAVAILABLE'
    );
    assert.equal(
      (await request(app).delete(`/api/admin/jobs/${jobId}`).set(auth(adminToken))).status,
      204
    );
    assert.equal((await request(app).get(`/api/jobs/${jobId}`)).status, 404);
    assert.equal(
      (await request(app).get('/api/applications').set(auth(candidateToken))).body.meta.total,
      2
    );
  });
  await t.test(
    'logout revokes cookie family; disabled account loses protected access',
    async () => {
      const r = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin())
        .send({ identifier: 'candidate@example.test', password: 'integration-candidate-pass' });
      const cookie = r.headers['set-cookie'][0].split(';')[0];
      assert.equal(
        (await request(app).post('/api/auth/logout').set('Origin', origin()).set('Cookie', cookie))
          .status,
        204
      );
      assert.equal(
        (await request(app).post('/api/auth/refresh').set('Origin', origin()).set('Cookie', cookie))
          .status,
        401
      );
      await db.query('UPDATE users SET is_active=0 WHERE id=?', [candidateId]);
      assert.equal((await request(app).get('/api/auth/me').set(auth(candidateToken))).status, 401);
    }
  );
});
