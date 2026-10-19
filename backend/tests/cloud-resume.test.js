import { it } from 'node:test';
import assert from 'node:assert/strict';

it('cloud resumes retain independent versions and download through the backend', async () => {
  process.env.STORAGE_DRIVER = 'supabase';
  process.env.SUPABASE_URL = 'https://storage.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-service-key';
  const objects = new Map();
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const key = url.split('/').at(-1);
    if (options.method === 'POST') {
      assert.equal(options.headers['x-upsert'], 'false');
      assert.equal(objects.has(key), false);
      objects.set(key, Buffer.from(options.body));
      return globalThis.Response.json({});
    }
    if (options.method === 'DELETE') {
      for (const item of JSON.parse(options.body).prefixes) objects.delete(item);
      return globalThis.Response.json([]);
    }
    return objects.has(key)
      ? new globalThis.Response(objects.get(key))
      : globalThis.Response.json({ statusCode: '404' }, { status: 400 });
  };
  try {
    const { PDFDocument } = await import('pdf-lib');
    const { storeResume, resumeExists, downloadResume, removeUnreferencedNewFile } =
      await import('../src/shared/storage.js');
    const doc = await PDFDocument.create();
    doc.addPage();
    const buffer = Buffer.from(await doc.save());
    const file = {
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      size: buffer.length,
      buffer
    };
    const first = await storeResume(file);
    const replacement = await storeResume(file);
    assert.notEqual(first.key, replacement.key);
    assert.equal(await resumeExists(first.key), true);
    const headers = {};
    let downloaded;
    const res = {
      set: (key, value) => {
        headers[key] = value;
      },
      attachment: (name) => {
        headers.attachment = name;
      },
      type: (type) => {
        headers.type = type;
      },
      send: (data) => {
        downloaded = data;
      }
    };
    await downloadResume(res, first.key, first.name, () => assert.fail('Unexpected error'));
    assert.deepEqual(downloaded, buffer);
    assert.equal(headers['Cache-Control'], 'no-store');
    assert.equal(headers.type, 'application/pdf');
    assert.equal(headers.attachment, 'resume.pdf');
    await removeUnreferencedNewFile(replacement.key);
    assert.equal(await resumeExists(replacement.key), false);
    assert.equal(await resumeExists(first.key), true);
    await assert.rejects(storeResume({ ...file, mimetype: 'text/plain' }), { statusCode: 400 });
    assert.equal(objects.size, 1);
  } finally {
    globalThis.fetch = original;
  }
});
