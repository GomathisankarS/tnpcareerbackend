import { query, closePool } from '../src/db/pool.js';
try {
  const version = (
    await query(
      'SELECT VERSION() AS version,@@session.time_zone AS timezone,@@session.sql_mode AS mode'
    )
  )[0];
  const rows = await query(
    "SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','candidate_profiles','job_categories','job_options','jobs','job_applications','auth_sessions') ORDER BY TABLE_NAME,ORDINAL_POSITION"
  );
  console.info(
    JSON.stringify(
      {
        version,
        tables: [...new Set(rows.map((r) => r.tableName))],
        phoneColumn: rows.some((r) => r.tableName === 'users' && r.columnName === 'mobile_number')
          ? 'mobile_number'
          : 'MISSING',
        columnCount: rows.length
      },
      null,
      2
    )
  );
} catch {
  console.error('Database inspection failed. Check local configuration; no changes were made.');
  process.exitCode = 1;
} finally {
  await closePool();
}
