import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rootCertificates } from 'node:tls';
import { connectionOptions } from '../src/db/connection-options.js';
import { parseAndValidateEnv } from '../src/config/env.js';

const base = {
  DB_HOST: 'mysql.example.test',
  DB_PORT: 12345,
  DB_USER: 'test',
  DB_PASSWORD: 'synthetic-password',
  DB_NAME: 'example_test',
  DB_SSL: false
};
function removeFixture(dir) {
  const resolved = path.resolve(dir);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.ok(path.basename(resolved).startsWith('tnp-tls-'));
  rmSync(resolved, { recursive: true, force: true });
}
it('local MySQL connections keep TLS disabled unless configured', () => {
  const options = connectionOptions(base);
  assert.equal(options.host, base.DB_HOST);
  assert.equal(options.port, base.DB_PORT);
  assert.equal(options.ssl, undefined);
});
it('TLS enables CA and hostname verification with no insecure fallback', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tnp-tls-'));
  try {
    const file = path.join(dir, 'ca.pem');
    writeFileSync(file, rootCertificates[0]);
    const options = connectionOptions({ ...base, DB_SSL: true, DB_SSL_CA_FILE: file });
    assert.equal(options.ssl.ca, rootCertificates[0]);
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.equal(options.ssl.verifyIdentity, true);
    assert.equal(options.password, base.DB_PASSWORD);
  } finally {
    removeFixture(dir);
  }
});
it('missing and invalid certificates fail without exposing file contents', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tnp-tls-'));
  try {
    const file = path.join(dir, 'ca.pem');
    for (const contents of [null, 'synthetic-private-value']) {
      if (contents) writeFileSync(file, contents);
      assert.throws(() => connectionOptions({ ...base, DB_SSL: true, DB_SSL_CA_FILE: file }), {
        message: 'DB_SSL_CA_FILE must point to a readable PEM CA certificate'
      });
    }
  } finally {
    removeFixture(dir);
  }
});
it('TLS environment settings require an explicit flag, CA path and DNS hostname', () => {
  const valid = { NODE_ENV: 'test', DB_HOST: base.DB_HOST };
  assert.equal(parseAndValidateEnv(valid).DB_SSL, false);
  for (const patch of [
    { DB_SSL: 'yes' },
    { DB_SSL: 'true' },
    { DB_SSL: 'true', DB_SSL_CA_FILE: 'certs/ca.pem', DB_HOST: '127.0.0.1' }
  ])
    assert.throws(() => parseAndValidateEnv({ ...valid, ...patch }));
  const parsed = parseAndValidateEnv({ ...valid, DB_SSL: 'true', DB_SSL_CA_FILE: 'certs/ca.pem' });
  assert.equal(parsed.DB_SSL, true);
  assert.ok(path.isAbsolute(parsed.DB_SSL_CA_FILE));
});
