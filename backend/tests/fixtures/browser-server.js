// Opt-in browser fixture: creates a unique temporary database, never development data.
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { createBrowserData } from './browser-data.js';
const name = process.env.DB_NAME;
if (
  process.env.NODE_ENV !== 'test' ||
  !/^tnp_browser_[a-f0-9]{12}_test$/.test(name) ||
  !process.env.E2E_ADMIN_PASSWORD ||
  !process.env.E2E_CANDIDATE_PASSWORD
)
  throw new Error('Use the Playwright runner with its isolated database settings');
const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true
});
try {
  await c.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await c.changeUser({ database: name });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  await c.query(await readFile(path.join(root, 'database/tnp_job_portal_schema.sql'), 'utf8'));
  await c.query(
    await readFile(path.join(root, 'database/migrations/001_managed_job_options.sql'), 'utf8')
  );
  await c.query(
    await readFile(path.join(root, 'database/migrations/002_requires_city_scope.sql'), 'utf8')
  );
  for (const [fullName, email, password, role] of [
    ['Browser Admin', 'browser-admin@example.test', process.env.E2E_ADMIN_PASSWORD, 'admin'],
    [
      'Browser Candidate',
      'browser-candidate@example.test',
      process.env.E2E_CANDIDATE_PASSWORD,
      'candidate'
    ]
  ])
    await c.query('INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)', [
      fullName,
      email,
      await argon2.hash(password, { type: argon2.argon2id }),
      role
    ]);
  await createBrowserData(c);
} finally {
  await c.end();
}
await import('../../src/server.js');
