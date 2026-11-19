import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import mysql from 'mysql2/promise';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnvironment({ path: path.resolve(apiRoot, '../..', '.env'), quiet: true });

const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const base = `http://127.0.0.1:${port}/api/v1/latex/projects`;
const database = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
const users = [];
const output = [];
let projectId;

async function testAccount() {
  const id = randomUUID().replaceAll('-', '');
  const [result] = await database.execute(
    `INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at)
     VALUES (?, 'LaTeX E2E', ?, 'unused', 'reader', 'active', CURRENT_TIMESTAMP)`,
    [`tex_${id.slice(0, 15)}`, `tex-${id}@example.test`],
  );
  users.push(result.insertId);
  const token = randomBytes(32).toString('base64url');
  await database.execute(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at)
     VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR), CURRENT_TIMESTAMP)`,
    [randomUUID(), result.insertId, createHash('sha256').update(token).digest('hex')],
  );
  return `to_toan_session=${token}`;
}

async function request(url, method = 'GET', cookie, payload) {
  const response = await fetch(url, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json().catch(() => ({})) };
}

const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiRoot,
  env: { ...process.env, NEST_PORT: String(port), MAIL_MODE: 'preview' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));

try {
  const owner = await testAccount();
  const other = await testAccount();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(output.join(''));
    try { if ((await fetch(`http://127.0.0.1:${port}/api/v1/health`)).ok) break; }
    catch { /* Server is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  assert.equal((await request(base)).status, 401);
  const oversizedUnicode = await request(base, 'POST', owner, { title: 'Quá lớn', compiler: 'xelatex', source: 'á'.repeat(550_000) });
  assert.equal(oversizedUnicode.status, 400);
  const created = await request(base, 'POST', owner, { title: 'Bản thảo Euler', compiler: 'xelatex', source: '\\documentclass{article}\n\\begin{document}Euler\\end{document}' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  projectId = created.body.project.id;
  assert.equal(created.body.project.mainFile.path, 'main.tex');
  assert.equal(created.body.project.compiler, 'xelatex');

  const listed = await request(base, 'GET', owner);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.projects.some((item) => item.id === projectId));
  assert.equal((await request(`${base}/${projectId}`, 'GET', other)).status, 404);

  const updated = await request(`${base}/${projectId}`, 'PATCH', owner, { title: 'Euler đã sửa', compiler: 'lualatex' });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.project.compiler, 'lualatex');

  const fileId = created.body.project.mainFile.id;
  assert.equal((await request(`${base}/${projectId}/files/${fileId}`, 'PUT', other, { content: 'secret' })).status, 404);
  const saved = await request(`${base}/${projectId}/files/${fileId}`, 'PUT', owner, { content: '\\[e^{i\\pi}+1=0\\]' });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const reopened = await request(`${base}/${projectId}`, 'GET', owner);
  assert.equal(reopened.body.project.title, 'Euler đã sửa');
  assert.equal(reopened.body.project.mainFile.content, '\\[e^{i\\pi}+1=0\\]');

  const largeSource = 'x'.repeat(120_000);
  const largeSave = await request(`${base}/${projectId}/files/${fileId}`, 'PUT', owner, { content: largeSource });
  assert.equal(largeSave.status, 200, JSON.stringify(largeSave.body).slice(0, 500));
  assert.equal((await request(`${base}/${projectId}`, 'GET', owner)).body.project.mainFile.content.length, largeSource.length);

  assert.equal((await request(`${base}/${projectId}`, 'DELETE', owner)).status, 204);
  projectId = undefined;
  assert.equal((await request(`${base}/${created.body.project.id}`, 'GET', owner)).status, 404);
  console.log('LaTeX E2E: tạo, liệt kê, phân quyền, lưu, mở lại và xóa thành công.');
} finally {
  child.kill();
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  if (projectId) await database.execute('DELETE FROM latex_projects WHERE id = ?', [projectId]);
  for (const id of users) await database.execute('DELETE FROM users WHERE id = ?', [id]);
  await database.end();
}
