import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForApi(url, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API dừng sớm với mã ${child.exitCode}.\n${output.join('')}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // API vẫn đang khởi động.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`API không sẵn sàng sau 15 giây.\n${output.join('')}`);
}

const port = await findFreePort();
assert.equal(typeof port, 'number');
const baseUrl = `http://127.0.0.1:${port}`;
const output = [];
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, NEST_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));

try {
  const healthResponse = await waitForApi(`${baseUrl}/api/v1/health`, child, output);
  const health = await healthResponse.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'connected');
  assert.equal(health.service, 'to-toan-api');
  assert.equal(typeof health.timestamp, 'string');

  const swaggerResponse = await fetch(`${baseUrl}/docs-json`);
  assert.equal(swaggerResponse.status, 200);
  const swagger = await swaggerResponse.json();
  assert.ok(swagger.paths['/api/v1/health']);

  const missingResponse = await fetch(`${baseUrl}/api/v1/khong-ton-tai`);
  assert.equal(missingResponse.status, 404);
  const missing = await missingResponse.json();
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.path, '/api/v1/khong-ton-tai');
  assert.equal(typeof missing.timestamp, 'string');

  process.stdout.write('E2E thành công: MySQL, health, Swagger và định dạng lỗi.\n');
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}
