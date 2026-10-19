import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { connectionOptions } from './connection-options.js';
let poolInstance;
export function getPool() {
  return (poolInstance ??= mysql.createPool({
    ...connectionOptions(),
    connectionLimit: env.DB_CONNECTION_LIMIT,
    queueLimit: env.DB_QUEUE_LIMIT,
    waitForConnections: true,
    connectTimeout: env.DB_TIMEOUT_MS,
    timezone: 'Z',
    charset: 'utf8mb4',
    enableKeepAlive: true,
    multipleStatements: false
  }));
}
export function setPool(p) {
  if (!env.isTest) throw new Error('Pool injection is test-only');
  poolInstance = p;
}
export async function acquire() {
  let timer,
    expired = false;
  const pending = getPool()
    .getConnection()
    .then((c) => {
      if (expired) {
        c.release();
        throw new Error('Database acquisition timed out');
      }
      return c;
    });
  try {
    const c = await Promise.race([
      pending,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('Database acquisition timed out'));
        }, env.DB_TIMEOUT_MS);
      })
    ]);
    try {
      await c.query({
        sql: "SET SESSION time_zone = '+00:00', sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION', innodb_lock_wait_timeout = 5",
        timeout: env.DB_TIMEOUT_MS
      });
      return c;
    } catch (e) {
      c.destroy();
      throw e;
    }
  } finally {
    clearTimeout(timer);
  }
}
export async function query(sql, values = [], connection) {
  const c = connection || (await acquire());
  try {
    return (await c.query({ sql, timeout: env.DB_TIMEOUT_MS }, values))[0];
  } catch (e) {
    if (e.code === 'PROTOCOL_SEQUENCE_TIMEOUT') c.destroy();
    throw e;
  } finally {
    if (!connection) c.release();
  }
}
export async function transaction(work, attempt = 0) {
  const c = await acquire();
  try {
    await c.beginTransaction();
    const result = await work(c);
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    if (e.code === 'ER_LOCK_DEADLOCK' && attempt < 2) return transaction(work, attempt + 1);
    throw e;
  } finally {
    c.release();
  }
}
export async function pingDb() {
  if (env.isTest && poolInstance && !poolInstance.getConnection) {
    const [r] = await poolInstance.query('SELECT 1 AS alive');
    return r[0]?.alive === 1;
  }
  return (await query('SELECT 1 AS alive'))[0]?.alive === 1;
}
export async function closePool() {
  const p = poolInstance;
  poolInstance = null;
  if (p) await p.end();
}
