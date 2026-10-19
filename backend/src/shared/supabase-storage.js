import { env } from '../config/env.js';
import { AppError } from './errors/AppError.js';

const unavailable = () =>
  new AppError(
    'Resume storage is unavailable. Please try again later.',
    503,
    'STORAGE_UNAVAILABLE'
  );

// Only the backend calls this private bucket. Never expose its service key or URLs to clients.
export function createSupabaseStorage(config = env, request = globalThis.fetch) {
  const base = `${config.SUPABASE_URL}/storage/v1/object`;
  const bucket = encodeURIComponent(config.SUPABASE_STORAGE_BUCKET);
  const object = (key) => {
    if (!/^[0-9a-f-]{36}\.pdf$/.test(key))
      throw new AppError('Resume unavailable', 404, 'NOT_FOUND');
    return `${bucket}/${encodeURIComponent(key)}`;
  };
  async function call(url, options = {}, missingAllowed = false) {
    try {
      const response = await request(url, {
        ...options,
        redirect: 'error',
        signal: globalThis.AbortSignal.timeout(30000),
        headers: {
          apikey: config.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
          ...options.headers
        }
      });
      if (!response.ok) {
        // Storage can report a missing object as HTTP 400 with a 404 code in its JSON.
        const error = await response.json().catch(() => ({}));
        if (
          missingAllowed &&
          (response.status === 404 ||
            (response.status === 400 &&
              (String(error.statusCode) === '404' || error.code === 'NoSuchKey')))
        )
          return null;
        throw unavailable();
      }
      return response;
    } catch {
      throw unavailable();
    }
  }
  return {
    async put(key, buffer) {
      await call(`${base}/${object(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
        body: buffer
      });
    },
    async get(key) {
      const response = await call(`${base}/authenticated/${object(key)}`, {}, true);
      if (!response) return null;
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > config.RESUME_MAX_BYTES) throw unavailable();
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } catch {
        throw unavailable();
      }
    },
    async remove(key) {
      object(key);
      await call(`${base}/${bucket}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [key] })
      });
    }
  };
}
