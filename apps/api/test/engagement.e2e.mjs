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
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API dừng sớm.\n${output.join('')}`);
    try { if ((await fetch(url)).ok) return; } catch { /* API đang khởi động. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`API không sẵn sàng.\n${output.join('')}`);
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function createUser(database, label) {
  const unique = randomUUID().replaceAll('-', '');
  const [result] = await database.execute(
    `INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at)
     VALUES (?, ?, ?, 'not-used', 'reader', 'active', CURRENT_TIMESTAMP)`,
    [`e_${label}_${unique.slice(0, 12)}`, `Engagement ${label}`, `engagement-${label}-${unique}@example.test`],
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
const first = await createUser(database, 'first');
const second = await createUser(database, 'second');
const [problemResult] = await database.execute(
  `INSERT INTO problems (author_id, title, slug, content, difficulty, status, published_at)
   VALUES (?, 'Bài kiểm thử tương tác', ?, 'Nội dung bài toán kiểm thử tương tác cộng đồng.', 'Dễ', 'published', CURRENT_TIMESTAMP)`,
  [first.id, `engagement-e2e-${randomUUID()}`],
);
const problemId = problemResult.insertId;
const [solutionResult] = await database.execute(
  `INSERT INTO solutions (problem_id, author_id, content, status, reviewed_at)
   VALUES (?, ?, 'Lời giải đã kiểm chứng dùng để kiểm thử lượt thích.', 'verified', CURRENT_TIMESTAMP)`,
  [problemId, first.id],
);
const solutionId = solutionResult.insertId;
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
  const auth = (user, method = 'PUT') => ({ method, headers: { Cookie: user.cookie } });

  assert.equal((await request(`${baseUrl}/api/v1/bookmarks/${problemId}`, auth(first))).response.status, 200);
  assert.equal((await request(`${baseUrl}/api/v1/bookmarks/${problemId}`, auth(first))).response.status, 200);
  const bookmarks = await request(`${baseUrl}/api/v1/bookmarks`, auth(first, 'GET'));
  assert.equal(bookmarks.response.status, 200);
  assert.equal(bookmarks.body.bookmarks.length, 1);

  await request(`${baseUrl}/api/v1/follows/problems/${problemId}`, auth(first));
  await request(`${baseUrl}/api/v1/follows/problems/${problemId}`, auth(second));
  const comment = await request(`${baseUrl}/api/v1/problems/${problemId}/comments`, {
    method: 'POST',
    headers: { Cookie: second.cookie },
    body: JSON.stringify({ content: 'Bình luận mới để kiểm thử thông báo theo dõi.' }),
  });
  assert.equal(comment.response.status, 201, JSON.stringify(comment.body));
  const notifications = await request(`${baseUrl}/api/v1/notifications`, auth(first, 'GET'));
  assert.equal(notifications.response.status, 200);
  assert.equal(notifications.body.unreadCount, 1);
  assert.equal(notifications.body.notifications[0].type, 'new_comment');
  await request(`${baseUrl}/api/v1/notifications/read`, auth(first, 'PATCH'));
  const readNotifications = await request(`${baseUrl}/api/v1/notifications`, auth(first, 'GET'));
  assert.equal(readNotifications.body.unreadCount, 0);
  await request(`${baseUrl}/api/v1/problems/${problemId}/reaction`, auth(first));
  await request(`${baseUrl}/api/v1/problems/${problemId}/reaction`, auth(second));
  await request(`${baseUrl}/api/v1/solutions/${solutionId}/reaction`, auth(first));
  await request(`${baseUrl}/api/v1/solutions/${solutionId}/reaction`, auth(first));

  const summary = await request(`${baseUrl}/api/v1/problems/${problemId}/engagement`);
  assert.equal(summary.response.status, 200, JSON.stringify(summary.body));
  assert.equal(summary.body.reactionCount, 2);
  assert.equal(summary.body.followerCount, 2);
  assert.equal(summary.body.solutionReactions[String(solutionId)], 1);

  const mine = await request(`${baseUrl}/api/v1/problems/${problemId}/engagement/mine`, auth(first, 'GET'));
  assert.deepEqual(
    { bookmarked: mine.body.bookmarked, followed: mine.body.followed, problemLiked: mine.body.problemLiked },
    { bookmarked: true, followed: true, problemLiked: true },
  );
  assert.deepEqual(mine.body.likedSolutionIds, [String(solutionId)]);

  const unlike = await request(`${baseUrl}/api/v1/problems/${problemId}/reaction`, auth(first, 'DELETE'));
  assert.equal(unlike.body.reactionCount, 1);
  const unfollow = await request(`${baseUrl}/api/v1/follows/problems/${problemId}`, auth(first, 'DELETE'));
  assert.equal(unfollow.body.followerCount, 1);
  await request(`${baseUrl}/api/v1/bookmarks/${problemId}`, auth(first, 'DELETE'));
  const emptyBookmarks = await request(`${baseUrl}/api/v1/bookmarks`, auth(first, 'GET'));
  assert.equal(emptyBookmarks.body.bookmarks.length, 0);

  process.stdout.write('Engagement E2E thành công: bookmark, thích bài/lời giải, theo dõi, thông báo, bộ đếm và chống dữ liệu trùng.\n');
} finally {
  child.kill();
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  await database.execute('DELETE FROM problems WHERE id = ?', [problemId]);
  await database.execute('DELETE FROM users WHERE id IN (?, ?)', [first.id, second.id]);
  await database.end();
}
