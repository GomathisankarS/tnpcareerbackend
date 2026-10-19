import mysql from 'mysql2/promise';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { backendRoot } from '../src/config/env.js';
import { connectionOptions } from '../src/db/connection-options.js';

const connection = await mysql.createConnection(connectionOptions());
try {
  const tables = [
    'users',
    'candidate_profiles',
    'job_categories',
    'job_options',
    'jobs',
    'job_applications',
    'auth_sessions'
  ];
  const lines = [
    '-- TNP Careers: fresh database schema with a snapshot of current lookup values.',
    `-- Generated: ${new Date().toISOString()}. MySQL 8.0.44+ compatible; verified on 8.0.45.`,
    '-- Select a NEW EMPTY database before running. Never import over an existing installation.',
    '-- No accounts, jobs, applications, sessions, credentials or resume data are included.',
    '-- Existing installations use the versioned migrations instead.',
    'SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;',
    "SET SESSION time_zone = '+00:00';",
    ''
  ];
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  for (const table of tables) {
    const [rows] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    lines.push(rows[0]['Create Table'].replace(/ AUTO_INCREMENT=\d+\b/g, '') + ';', '');
  }
  for (const [table, columns] of [
    ['job_categories', ['id', 'name', 'slug', 'is_active']],
    ['job_options', ['id', 'kind', 'code', 'name', 'is_active', 'requires_city']]
  ]) {
    const names = columns.map((column) => `\`${column}\``).join(',');
    const [rows] = await connection.query(`SELECT ${names} FROM \`${table}\` ORDER BY id`);
    if (rows.length) {
      lines.push(`-- Current ${table} values. IDs and activity settings are preserved.`);
      lines.push(`INSERT INTO \`${table}\` (${names}) VALUES`);
      lines.push(
        rows
          .map((row) => '(' + columns.map((column) => mysql.escape(row[column])).join(',') + ')')
          .join(',\n') + ';',
        ''
      );
    }
    console.info(`${table}: ${rows.length} lookup rows included`);
  }
  await connection.commit();
  await writeFile(path.join(backendRoot, '../database/setup.sql'), lines.join('\n'), 'utf8');
  console.info('Created database/setup.sql. Source database unchanged.');
} finally {
  await connection.end();
}
