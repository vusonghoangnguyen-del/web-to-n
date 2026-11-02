import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import mysql from 'mysql2/promise';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(testDirectory, '..');
const repositoryRoot = path.resolve(apiRoot, '..', '..');
const legacyApiRoot = path.join(repositoryRoot, 'apps', 'legacy-api');
const previewDirectory = path.join(repositoryRoot, 'storage', 'mail-preview');
loadEnvironment({ path: path.join(repositoryRoot, '.env'), quiet: true });

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForApi(url, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API dừng sớm.\n${output.join('')}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // API đang khởi động.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`API không sẵn sàng.\n${output.join('')}`);
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { response, body };
}

async function previewFiles() {
  return new Set(await readdir(previewDirectory).catch(() => []));
}

async function waitForPreview(previousFiles) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const files = await previewFiles();
    const created = [...files].find((file) => !previousFiles.has(file));
    if (created) return created;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Không tìm thấy email preview sau đăng ký.');
}

const port = await findFreePort();
let legacyPort = await findFreePort();
while (legacyPort === port) legacyPort = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const legacyBaseUrl = `http://127.0.0.1:${legacyPort}`;
const email = `phase4-${randomUUID()}@example.test`;
const password = 'Mat-khau-test-2026!';
const output = [];
let previewFile;
const existingPreviews = await previewFiles();
const database = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiRoot,
  env: {
    ...process.env,
    NEST_PORT: String(port),
    MAIL_MODE: 'preview',
    APP_WEB_URL: baseUrl,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));
const legacyChild = spawn(process.execPath, ['server/index.js'], {
  cwd: legacyApiRoot,
  env: { ...process.env, PORT: String(legacyPort) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
legacyChild.stdout.on('data', (chunk) => output.push(chunk.toString()));
legacyChild.stderr.on('data', (chunk) => output.push(chunk.toString()));

try {
  await waitForApi(`${baseUrl}/api/v1/health`, child, output);
  await waitForApi(`${legacyBaseUrl}/api/health`, legacyChild, output);

  const registered = await jsonRequest(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Tài khoản kiểm thử',
      email,
      password,
      passwordConfirmation: password,
      acceptTerms: true,
    }),
  });
  assert.equal(registered.response.status, 201);
  assert.match(registered.body.message, /kiểm tra email/i);
  assert.equal('password' in registered.body, false);

  const pendingLogin = await jsonRequest(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(pendingLogin.response.status, 403);

  previewFile = await waitForPreview(existingPreviews);
  const html = await readFile(path.join(previewDirectory, previewFile), 'utf8');
  const tokenMatch = html.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(tokenMatch);

  const verified = await jsonRequest(`${baseUrl}/api/v1/auth/email/verify`, {
    method: 'POST',
    body: JSON.stringify({ token: tokenMatch[1] }),
  });
  assert.equal(verified.response.status, 201);
  assert.equal(verified.body.user.email, email);
  assert.equal(verified.body.user.role, 'reader');
  assert.equal(verified.body.user.emailVerified, true);
  assert.equal('passwordHash' in verified.body.user, false);
  const cookie = verified.response.headers.getSetCookie()[0]?.split(';')[0];
  assert.match(cookie, /^to_toan_session=/);

  const me = await jsonRequest(`${baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.user.email, email);

  const legacyBookmarks = await jsonRequest(`${legacyBaseUrl}/api/bookmarks`, {
    headers: { Cookie: cookie },
  });
  assert.equal(legacyBookmarks.response.status, 200);
  assert.deepEqual(legacyBookmarks.body.bookmarks, []);

  const logout = await jsonRequest(`${baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(logout.response.status, 204);
  const afterLogout = await jsonRequest(`${baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(afterLogout.response.status, 401);

  const login = await jsonRequest(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.response.status, 200);
  assert.match(login.response.headers.getSetCookie()[0], /HttpOnly/i);

  process.stdout.write('Auth E2E thành công: đăng ký, email, xác minh, session, đăng xuất, đăng nhập và cầu nối Express.\n');
} finally {
  child.kill();
  legacyChild.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  await Promise.race([
    new Promise((resolve) => legacyChild.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  await database.execute('DELETE FROM users WHERE email = ?', [email]);
  await database.end();
  if (previewFile) await unlink(path.join(previewDirectory, previewFile)).catch(() => undefined);
}
