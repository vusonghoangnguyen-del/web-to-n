import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import mysql from 'mysql2/promise';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(testDirectory, '..');
const repositoryRoot = path.resolve(apiRoot, '..', '..');
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

async function createUserWithSession(database, label) {
  const unique = randomUUID().replaceAll('-', '');
  const email = `comments-${label}-${unique}@example.test`;
  const username = `c_${label}_${unique.slice(0, 12)}`;
  const [result] = await database.execute(
    `INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at)
     VALUES (?, ?, ?, ?, 'reader', 'active', CURRENT_TIMESTAMP)`,
    [username, `Comments ${label}`, email, 'not-used-by-this-test'],
  );
  const token = randomBytes(32).toString('base64url');
  await database.execute(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at)
     VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR), CURRENT_TIMESTAMP)`,
    [randomUUID(), result.insertId, createHash('sha256').update(token).digest('hex')],
  );
  return { id: result.insertId, cookie: `to_toan_session=${token}` };
}

const database = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
const author = await createUserWithSession(database, 'author');
const reporter = await createUserWithSession(database, 'reporter');
const slug = `comments-e2e-${randomUUID()}`;
const [problemResult] = await database.execute(
  `INSERT INTO problems (author_id, title, slug, content, difficulty, status, published_at)
   VALUES (?, ?, ?, ?, 'Dễ', 'published', CURRENT_TIMESTAMP)`,
  [author.id, 'Bài toán kiểm thử bình luận', slug, 'Nội dung đủ dài cho bài toán kiểm thử bình luận.'],
);
const problemId = problemResult.insertId;
const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const output = [];
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiRoot,
  env: { ...process.env, NEST_PORT: String(port), MAIL_MODE: 'preview', APP_WEB_URL: baseUrl },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));

try {
  await waitForApi(`${baseUrl}/api/v1/health`, child, output);

  const root = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/comments`, {
    method: 'POST',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({ content: 'Bình luận gốc cho bài toán.' }),
  });
  assert.equal(root.response.status, 201, JSON.stringify(root.body));
  assert.equal(root.body.comment.parentId, null);

  const reply = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/comments`, {
    method: 'POST',
    headers: { Cookie: reporter.cookie },
    body: JSON.stringify({ content: 'Một câu trả lời cho bình luận.', parentId: root.body.comment.id }),
  });
  assert.equal(reply.response.status, 201, JSON.stringify(reply.body));
  assert.equal(reply.body.comment.parentId, root.body.comment.id);

  const edited = await jsonRequest(`${baseUrl}/api/v1/comments/${root.body.comment.id}`, {
    method: 'PATCH',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({ content: 'Bình luận gốc đã được chỉnh sửa.' }),
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.body.comment.edited, true);

  const forbiddenEdit = await jsonRequest(`${baseUrl}/api/v1/comments/${root.body.comment.id}`, {
    method: 'PATCH',
    headers: { Cookie: reporter.cookie },
    body: JSON.stringify({ content: 'Không được phép sửa bình luận này.' }),
  });
  assert.equal(forbiddenEdit.response.status, 403);

  const report = await jsonRequest(`${baseUrl}/api/v1/comments/${reply.body.comment.id}/reports`, {
    method: 'POST',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({ reason: 'inappropriate', details: 'Nội dung kiểm thử báo cáo.' }),
  });
  assert.equal(report.response.status, 201);
  const duplicateReport = await jsonRequest(`${baseUrl}/api/v1/comments/${reply.body.comment.id}/reports`, {
    method: 'POST',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({ reason: 'spam' }),
  });
  assert.equal(duplicateReport.response.status, 409);

  const firstPage = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/comments?page=1&limit=1`);
  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.body.total, 2);
  assert.equal(firstPage.body.comments.length, 1);
  assert.equal(firstPage.body.hasMore, true);

  const removed = await jsonRequest(`${baseUrl}/api/v1/comments/${root.body.comment.id}`, {
    method: 'DELETE',
    headers: { Cookie: author.cookie },
  });
  assert.equal(removed.response.status, 204);
  const afterDelete = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/comments?page=1&limit=10`);
  assert.equal(afterDelete.body.comments[0].deleted, true);
  assert.equal(afterDelete.body.comments[0].content, '[Bình luận đã được xóa]');
  assert.equal(afterDelete.body.comments[1].deleted, false);

  process.stdout.write('Comments E2E thành công: bình luận, trả lời, sửa, phân quyền, báo cáo, phân trang và xóa mềm.\n');
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  await database.execute('DELETE FROM problems WHERE id = ?', [problemId]);
  await database.execute('DELETE FROM users WHERE id IN (?, ?)', [author.id, reporter.id]);
  await database.end();
}
