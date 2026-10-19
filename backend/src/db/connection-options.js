import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { env } from '../config/env.js';

export function connectionOptions(config = env) {
  const options = {
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME
  };
  if (config.DB_SSL) {
    let ca;
    try {
      ca = readFileSync(config.DB_SSL_CA_FILE, 'utf8');
      new X509Certificate(ca);
    } catch {
      throw new Error('DB_SSL_CA_FILE must point to a readable PEM CA certificate');
    }
    options.ssl = { ca, rejectUnauthorized: true, verifyIdentity: true };
  }
  return options;
}
