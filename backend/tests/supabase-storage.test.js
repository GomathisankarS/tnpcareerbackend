import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStorage } from '../src/shared/supabase-storage.js';
import { parseAndValidateEnv } from '../src/config/env.js';
const key = '12345678-1234-1234-1234-123456789abc.pdf';
const config = {
  SUPABASE_URL: 'https://storage.example.test',
  SUPABASE_STORAGE_BUCKET: 'resumes',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-service-key',
  RESUME_MAX_BYTES: 1024
};
it('private storage uploads immutable PDFs, retrieves bytes and deletes only the requested key', async () => {
  const calls = [];
  const pdf = Buffer.from('%PDF-test');
  const storage = createSupabaseStorage(config, async (url, options) => {
    calls.push({ url, ...options });
    return options.method ? globalThis.Response.json({}) : new globalThis.Response(pdf);
  });
  await storage.put(key, pdf);
  assert.deepEqual(await storage.get(key), pdf);
  await storage.remove(key);
  assert.equal(calls[0].url, `${config.SUPABASE_URL}/storage/v1/object/resumes/${key}`);
  assert.equal(calls[0].headers['x-upsert'], 'false');
  assert.equal(calls[0].headers['Content-Type'], 'application/pdf');
  assert.equal(calls[0].body, pdf);
  assert.equal(
    calls[1].url,
    `${config.SUPABASE_URL}/storage/v1/object/authenticated/resumes/${key}`
  );
  assert.equal(calls[2].method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[2].body), { prefixes: [key] });
  for (const call of calls) {
    assert.equal(call.headers.Authorization, `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`);
    assert.equal(call.headers.apikey, config.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(call.redirect, 'error');
  }
  await assert.rejects(storage.get('../secret'), { statusCode: 404 });
  assert.equal(calls.length, 3);
});
it('missing objects are distinct from configuration and provider failures; errors never leak secrets', async () => {
  for (const status of [400, 404]) {
    const storage = createSupabaseStorage(config, async () =>
      globalThis.Response.json({ statusCode: '404' }, { status })
    );
    assert.equal(await storage.get(key), null);
  }
  for (const status of [400, 401, 403, 429, 500]) {
    const storage = createSupabaseStorage(config, async () =>
      globalThis.Response.json({ message: config.SUPABASE_SERVICE_ROLE_KEY }, { status })
    );
    await assert.rejects(
      storage.get(key),
      (e) => e.statusCode === 503 && !e.message.includes(config.SUPABASE_SERVICE_ROLE_KEY)
    );
    await assert.rejects(storage.put(key, Buffer.from('test')), { statusCode: 503 });
  }
  const offline = createSupabaseStorage(config, async () => {
    throw Error(config.SUPABASE_SERVICE_ROLE_KEY);
  });
  await assert.rejects(offline.remove(key), { statusCode: 503 });
  const oversized = createSupabaseStorage(
    config,
    async () => new globalThis.Response(Buffer.alloc(1025))
  );
  await assert.rejects(oversized.get(key), { statusCode: 503 });
});
it('Supabase configuration requires an HTTPS origin and a backend service key', () => {
  const raw = { NODE_ENV: 'test', STORAGE_DRIVER: 'supabase', ...config };
  assert.equal(parseAndValidateEnv(raw).STORAGE_DRIVER, 'supabase');
  for (const changes of [
    { STORAGE_DRIVER: 'unknown' },
    { SUPABASE_URL: 'http://storage.example.test' },
    { SUPABASE_URL: 'https://storage.example.test/path' },
    { SUPABASE_SERVICE_ROLE_KEY: '' },
    { SUPABASE_STORAGE_BUCKET: '../other' }
  ])
    assert.throws(() => parseAndValidateEnv({ ...raw, ...changes }));
});
