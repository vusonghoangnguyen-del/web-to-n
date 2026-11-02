import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { repoRoot } from '../server/paths.js';

loadEnv({ path: path.join(repoRoot, '.env') });

const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
const marker = randomUUID().slice(0, 12);
const username = `smoke_${marker}`;
const email = `to-toan-smoke-${marker}@example.test`;
const password = `Smoke-${randomUUID()}`;
const passwordHash = await bcrypt.hash(password, 12);
const sessionToken = randomBytes(32).toString('base64url');
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
let userId;
let problemId;
let videoId;

async function request(path, method = 'GET', body, cookie) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

try {
  assert.equal((await request('/api/health')).data.database, 'connected');
  const [createdUser] = await connection.execute(
    "INSERT INTO users (username, name, email, password_hash, status, email_verified_at) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)",
    [username, 'Smoke Test', email, passwordHash],
  );
  userId = createdUser.insertId;
  await connection.execute(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))`,
    [randomUUID(), userId, createHash('sha256').update(sessionToken).digest('hex')],
  );
  const cookie = `to_toan_session=${sessionToken}`;
  const submitted = await request('/api/problems', 'POST', { title: `Bài kiểm tra ${marker}`, body: 'Đề bài dùng để kiểm tra các chức năng cơ bản của hệ thống.', tag: 'logic', difficulty: 'Dễ' }, cookie);
  assert.equal(submitted.status, 201);
  problemId = submitted.data.problem.id;
  assert.equal((await request('/api/problems?search=' + marker)).data.total, 0);
  assert.equal((await request('/api/bookmarks/1', 'PUT')).status, 401);
  assert.equal((await request('/api/admin/videos', 'POST', { title: 'Không có quyền', topic: 'Logic', duration: '01:00', url: 'https://example.com/video' }, cookie)).status, 403);

  await connection.execute("UPDATE users SET role = 'admin' WHERE id = ?", [userId]);
  assert.equal((await request(`/api/admin/problems/${problemId}/status`, 'PATCH', { status: 'published' }, cookie)).status, 200);
  const listed = await request('/api/problems?search=' + marker + '&category=logic');
  assert.equal(listed.data.total, 1);
  assert.equal((await request('/api/problems?search=' + marker + '&difficulty=Kh%C3%B3')).data.total, 0);
  assert.equal((await request(`/api/bookmarks/${problemId}`, 'PUT', undefined, cookie)).status, 204);
  assert.equal((await request(`/api/bookmarks/${problemId}`, 'PUT', undefined, cookie)).status, 204);
  assert.ok((await request('/api/bookmarks', 'GET', undefined, cookie)).data.bookmarks.some((item) => Number(item.id) === Number(problemId)));
  assert.equal((await request(`/api/bookmarks/${problemId}`, 'DELETE', undefined, cookie)).status, 204);

  const comment = await request(`/api/problems/${problemId}/comments`, 'POST', { content: 'Mình thử giải theo hướng khác.' }, cookie);
  assert.equal(comment.status, 201);
  assert.ok((await request('/api/admin/comments', 'GET', undefined, cookie)).data.comments.some((item) => Number(item.id) === Number(comment.data.comment.id)));
  assert.equal((await request(`/api/admin/comments/${comment.data.comment.id}`, 'DELETE', undefined, cookie)).status, 204);
  const solution = await request(`/api/problems/${problemId}/solutions`, 'POST', { content: 'Lời giải kiểm thử có đủ các bước trình bày rõ ràng cho bài toán.' }, cookie);
  assert.equal(solution.status, 201);
  assert.equal((await request(`/api/admin/solutions/${solution.data.solution.id}/status`, 'PATCH', { status: 'verified' }, cookie)).status, 200);
  assert.equal((await request(`/api/problems/${problemId}/solutions`)).data.solutions.length, 1);

  const video = await request('/api/admin/videos', 'POST', { title: `Bài giảng ${marker}`, topic: 'Logic', duration: '12:30', url: 'https://example.com/lesson' }, cookie);
  assert.equal(video.status, 201);
  videoId = video.data.video.id;
  assert.ok((await request('/api/videos')).data.videos.some((item) => Number(item.id) === Number(videoId)));
  assert.equal((await request('/api/newsletter', 'POST', { email })).status, 201);
  console.log('Smoke test thành công: đăng bài, duyệt, tìm kiếm, lưu bài, bình luận, lời giải, video, đăng ký email.');
} finally {
  if (videoId) await connection.execute('DELETE FROM videos WHERE id = ?', [videoId]);
  if (problemId) await connection.execute('DELETE FROM problems WHERE id = ?', [problemId]);
  await connection.execute('DELETE FROM newsletter_subscriptions WHERE email = ?', [email]);
  if (userId) await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
  await connection.end();
}
