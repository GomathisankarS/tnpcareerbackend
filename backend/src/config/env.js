import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { isIP } from 'node:net';
export const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.env.NODE_ENV !== 'test') dotenv.config({ path: path.join(backendRoot, '.env') });
export function parseAndValidateEnv(raw = process.env) {
  const test = raw.NODE_ENV === 'test';
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'].filter(
    (k) => raw[k] === undefined && !test
  );
  if (missing.length)
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  const integer = (key, fallback, max = 65535) => {
    const v = String(raw[key] ?? fallback);
    if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > max)
      throw new Error(
        `${key} must be a valid ${key.includes('PORT') ? 'port number' : 'positive integer'}`
      );
    return Number(v);
  };
  const mode = raw.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(mode)) throw new Error('Invalid NODE_ENV');
  const origin = raw.FRONTEND_ORIGIN || 'http://localhost:5173';
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('Invalid FRONTEND_ORIGIN');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
    throw new Error('FRONTEND_ORIGIN must be an exact HTTP(S) origin');
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && (!localhost || mode === 'production'))
    throw new Error('HTTPS is required outside localhost development');
  const secret = raw.JWT_SECRET || (test ? 'unit-test-secret-which-is-at-least-32-characters' : '');
  if (secret.length < 32 || secret.includes('replace_'))
    throw new Error('JWT_SECRET must contain at least 32 locally generated characters');
  const dbHost = raw.DB_HOST ?? 'localhost',
    dbUser = raw.DB_USER ?? 'test_only';
  if (!dbHost.trim() || !dbUser.trim()) throw new Error('DB_HOST and DB_USER must not be blank');
  const dbSsl = String(raw.DB_SSL ?? 'false');
  if (!['true', 'false'].includes(dbSsl)) throw new Error('DB_SSL must be true or false');
  const caFile = raw.DB_SSL_CA_FILE?.trim();
  if (dbSsl === 'true' && !caFile) throw new Error('DB_SSL_CA_FILE is required when DB_SSL=true');
  if (dbSsl === 'true' && isIP(dbHost))
    throw new Error(
      'Use the database DNS hostname for TLS identity verification, not an IP address'
    );
  const storageDriver = raw.STORAGE_DRIVER || 'local';
  if (!['local', 'supabase'].includes(storageDriver))
    throw new Error('STORAGE_DRIVER must be local or supabase');
  const storageUrl = raw.SUPABASE_URL || '';
  const storageKey = raw.SUPABASE_SERVICE_ROLE_KEY || '';
  const storageBucket = raw.SUPABASE_STORAGE_BUCKET || 'resumes';
  if (storageDriver === 'supabase') {
    let parsed;
    try {
      parsed = new URL(storageUrl);
    } catch {
      throw new Error('SUPABASE_URL must be an HTTPS origin');
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== storageUrl)
      throw new Error('SUPABASE_URL must be an HTTPS origin');
    if (!storageKey.trim()) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storageBucket))
      throw new Error('Invalid SUPABASE_STORAGE_BUCKET');
  }
  return Object.freeze({
    NODE_ENV: mode,
    isTest: test,
    isProduction: mode === 'production',
    PORT: integer('PORT', 4000),
    FRONTEND_ORIGIN: origin,
    DB_HOST: dbHost,
    DB_PORT: integer('DB_PORT', 3306),
    DB_NAME: raw.DB_NAME || (test ? 'tnp_job_portal_test' : 'tnp_job_portal'),
    DB_USER: dbUser,
    DB_PASSWORD: raw.DB_PASSWORD ?? '',
    DB_SSL: dbSsl === 'true',
    DB_SSL_CA_FILE: caFile ? path.resolve(backendRoot, caFile) : null,
    DB_CONNECTION_LIMIT: integer('DB_CONNECTION_LIMIT', 10, 100),
    DB_QUEUE_LIMIT: integer('DB_QUEUE_LIMIT', 50, 1000),
    DB_TIMEOUT_MS: integer('DB_TIMEOUT_MS', 5000, 60000),
    JWT_SECRET: secret,
    JWT_ISSUER: raw.JWT_ISSUER || 'tnp-api',
    JWT_AUDIENCE: raw.JWT_AUDIENCE || 'tnp-web',
    ACCESS_TTL_SECONDS: integer('ACCESS_TTL_SECONDS', 900, 3600),
    REFRESH_TTL_SECONDS: integer('REFRESH_TTL_SECONDS', 604800, 2592000),
    COOKIE_SECURE: url.protocol === 'https:',
    UPLOAD_DIR: path.resolve(backendRoot, raw.UPLOAD_DIR || 'private-uploads'),
    AUTH_RATE_LIMIT: integer('AUTH_RATE_LIMIT', 30, 1000),
    STORAGE_DRIVER: storageDriver,
    SUPABASE_URL: storageUrl,
    SUPABASE_SERVICE_ROLE_KEY: storageKey,
    SUPABASE_STORAGE_BUCKET: storageBucket,
    MAX_PAGE_SIZE: 50,
    RESUME_MAX_BYTES: 5242880
  });
}
let cached;
export function getEnv() {
  return (cached ??= parseAndValidateEnv());
}
export const env = getEnv();
