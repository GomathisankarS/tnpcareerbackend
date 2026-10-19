import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath, URL } from 'node:url';
import { setPool, acquire, transaction } from '../src/db/pool.js';
it('failed UTC/strict initialization destroys the connection before business SQL', async () => {
  let destroyed = false,
    released = false;
  setPool({
    getConnection: async () => ({
      query: async () => {
        throw new Error('synthetic setup failure');
      },
      destroy() {
        destroyed = true;
      },
      release() {
        released = true;
      }
    })
  });
  try {
    await assert.rejects(acquire);
    assert.equal(destroyed, true);
    assert.equal(released, false);
  } finally {
    setPool(null);
  }
});
it('failed transaction rolls back and always releases its connection', async () => {
  const events = [];
  setPool({
    getConnection: async () => ({
      query: async () => [[]],
      beginTransaction: async () => events.push('begin'),
      commit: async () => events.push('commit'),
      rollback: async () => events.push('rollback'),
      release: () => events.push('release')
    })
  });
  try {
    await assert.rejects(() =>
      transaction(async () => {
        throw new Error('synthetic business error');
      })
    );
    assert.deepEqual(events, ['begin', 'rollback', 'release']);
  } finally {
    setPool(null);
  }
});
async function runLifecycle(event) {
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return new Promise((resolve, reject) => {
    const code = `import {server} from './src/server.js'; const trigger=()=>process.emit('${event}',new Error('synthetic fatal secret')); if(server.listening)setTimeout(trigger,50);else server.once('listening',trigger);`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, PORT: String(port) },
      windowsHide: true
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Child shutdown exceeded deadline'));
    }, 15000);
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
}
it('normal shutdown closes HTTP and exits zero; fatal events exit nonzero without leaking errors', async () => {
  for (const event of ['SIGTERM', 'unhandledRejection', 'uncaughtException']) {
    const result = await runLifecycle(event);
    assert.equal(result.code, event === 'SIGTERM' ? 0 : 1);
    assert.ok(result.output.includes('Graceful shutdown completed'));
    assert.ok(!result.output.includes('synthetic fatal secret'));
  }
});
