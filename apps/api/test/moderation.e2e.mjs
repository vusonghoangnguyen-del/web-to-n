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

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(() => resolve(address.port)); });
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  return { response, body: await response.json().catch(() => ({})) };
}

async function userWithSession(database, label, role) {
  const unique = randomUUID().replaceAll('-', '');
  const [result] = await database.execute(
    `INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at) VALUES (?, ?, ?, 'unused', ?, 'active', CURRENT_TIMESTAMP)`,
    [`m_${label}_${unique.slice(0, 10)}`, `Moderation ${label}`, `moderation-${label}-${unique}@example.test`, role],
  );
  const token = randomBytes(32).toString('base64url');
  await database.execute(`INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at) VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR), CURRENT_TIMESTAMP)`,
    [randomUUID(), result.insertId, createHash('sha256').update(token).digest('hex')]);
  return { id: result.insertId, cookie: `to_toan_session=${token}` };
}

const database = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const reader = await userWithSession(database, 'reader', 'reader');
const moderator = await userWithSession(database, 'moderator', 'moderator');
const [problemResult] = await database.execute(`INSERT INTO problems (author_id, title, slug, content, difficulty, status) VALUES (?, 'Bài kiểm thử moderation', ?, 'Nội dung bài toán kiểm thử moderation đủ dài.', 'Trung bình', 'pending')`, [reader.id, `moderation-${randomUUID()}`]);
const problemId = problemResult.insertId;
const [commentResult] = await database.execute(`INSERT INTO comments (problem_id, user_id, content, status) VALUES (?, ?, 'Bình luận dùng để kiểm thử báo cáo.', 'visible')`, [problemId, reader.id]);
const commentId = commentResult.insertId;
const [reportResult] = await database.execute(`INSERT INTO comment_reports (comment_id, reporter_id, reason, details, status) VALUES (?, ?, 'spam', 'Nội dung kiểm thử', 'pending')`, [commentId, moderator.id]);
const reportId = reportResult.insertId;
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const output = [];
const child = spawn(process.execPath, ['dist/main.js'], { cwd: apiRoot, env: { ...process.env, NEST_PORT: String(port), MAIL_MODE: 'preview', APP_WEB_URL: baseUrl }, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));

try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/api/v1/health`)).ok) break; } catch {}
    if (attempt === 99) throw new Error(output.join(''));
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const forbidden = await request(`${baseUrl}/api/v1/moderation/stats`, { headers: { Cookie: reader.cookie } });
  assert.equal(forbidden.response.status, 403);
  const reviewed = await request(`${baseUrl}/api/v1/moderation/problems/${problemId}`, { method: 'PATCH', headers: { Cookie: moderator.cookie }, body: JSON.stringify({ status: 'published' }) });
  assert.equal(reviewed.response.status, 200, JSON.stringify(reviewed.body));
  const resolved = await request(`${baseUrl}/api/v1/moderation/reports/${reportId}`, { method: 'PATCH', headers: { Cookie: moderator.cookie }, body: JSON.stringify({ status: 'reviewed', hideComment: true }) });
  assert.equal(resolved.response.status, 200, JSON.stringify(resolved.body));
  const audits = await request(`${baseUrl}/api/v1/moderation/audit-logs?limit=20`, { headers: { Cookie: moderator.cookie } });
  assert.equal(audits.response.status, 200, JSON.stringify(audits.body));
  assert.ok(audits.body.auditLogs.some((log) => log.action === 'problem.review' && log.targetId === String(problemId)));
  assert.ok(audits.body.auditLogs.some((log) => log.action === 'comment-report.resolve' && log.targetId === String(reportId)));
  const [[comment]] = await database.execute('SELECT status, content FROM comments WHERE id = ?', [commentId]);
  assert.equal(comment.status, 'hidden');
  assert.equal(comment.content, 'Bình luận dùng để kiểm thử báo cáo.');
  process.stdout.write('Moderation E2E thành công: quyền, duyệt bài, xử lý báo cáo, ẩn bình luận và audit log.\n');
} finally {
  child.kill();
  await database.execute('DELETE FROM audit_logs WHERE actor_id IN (?, ?)', [reader.id, moderator.id]);
  await database.execute('DELETE FROM problems WHERE id = ?', [problemId]);
  await database.execute('DELETE FROM users WHERE id IN (?, ?)', [reader.id, moderator.id]);
  await database.end();
}
