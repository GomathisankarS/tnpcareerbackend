import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { backendRoot } from '../src/config/env.js';
import { connectionOptions } from '../src/db/connection-options.js';
const c = await mysql.createConnection({
  ...connectionOptions(),
  multipleStatements: true
});
try {
  if (!(await c.query("SELECT GET_LOCK('tnp_managed_job_options',10) AS acquired"))[0][0].acquired)
    throw new Error('Another migration is running');
  const [tables] = await c.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='job_options'"
  );
  const [columns] = await c.query(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='jobs' AND COLUMN_NAME IN ('employment_type','work_mode','experience_level')"
  );
  if (tables.length && columns.length === 3 && columns.every((r) => r.DATA_TYPE === 'varchar')) {
    console.info('Managed job options migration already applied. No changes.');
  } else {
    if (tables.length || columns.length !== 3 || !columns.every((r) => r.DATA_TYPE === 'enum'))
      throw new Error('Unexpected or partially migrated schema; inspect before retrying');
    const snapshot = async () =>
      createHash('sha256')
        .update(JSON.stringify((await c.query('SELECT * FROM jobs ORDER BY id'))[0]))
        .digest('hex');
    const before = await snapshot();
    await c.query(
      await readFile(
        path.join(backendRoot, '../database/migrations/001_managed_job_options.sql'),
        'utf8'
      )
    );
    const after = await snapshot();
    if (before !== after)
      throw new Error('Job records changed during migration; inspect before continuing');
    console.info('Managed job options migration applied. Existing jobs preserved.');
  }
  const [cityColumn] = await c.query(
    "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='job_options' AND COLUMN_NAME='requires_city'"
  );
  const [cityConstraint] = await c.query(
    "SELECT CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='ck_job_options_city'"
  );
  if (
    cityColumn[0]?.IS_NULLABLE === 'YES' &&
    cityConstraint[0]?.CHECK_CLAUSE.includes('workMode')
  ) {
    console.info('City applicability migration already applied. No changes.');
  } else {
    if (cityColumn[0]?.IS_NULLABLE !== 'NO' || !cityConstraint.length)
      throw new Error(
        'Unexpected or partial city applicability migration; inspect before retrying'
      );
    const before = (await c.query('SELECT * FROM job_options ORDER BY id'))[0].map((row) => ({
      ...row,
      requires_city: row.kind === 'workMode' ? row.requires_city : null
    }));
    await c.query(
      await readFile(
        path.join(backendRoot, '../database/migrations/002_requires_city_scope.sql'),
        'utf8'
      )
    );
    const after = (await c.query('SELECT * FROM job_options ORDER BY id'))[0];
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('Unexpected option changes during city applicability migration');
    console.info(
      'City applicability migration applied. Work modes retained; other groups now use NULL.'
    );
  }
} finally {
  await c.query("SELECT RELEASE_LOCK('tnp_managed_job_options')");
  await c.end();
}
