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

const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const unique = randomUUID().replaceAll('-', '');
const email = `phase5-${unique}@example.test`;
const username = `p5_${unique.slice(0, 16)}`;
const sessionToken = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
const cookie = `to_toan_session=${sessionToken}`;
const output = [];
let userId;
let problemId;

const database = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const [userResult] = await database.execute(
  `INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at)
   VALUES (?, ?, ?, ?, 'reader', 'active', CURRENT_TIMESTAMP)`,
  [username, 'Phase 5 E2E', email, 'not-used-by-this-test'],
);
userId = userResult.insertId;
await database.execute(
  `INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at)
   VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR), CURRENT_TIMESTAMP)`,
  [randomUUID(), userId, tokenHash],
);

const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiRoot,
  env: { ...process.env, NEST_PORT: String(port), MAIL_MODE: 'preview', APP_WEB_URL: baseUrl },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));

try {
  await waitForApi(`${baseUrl}/api/v1/health`, child, output);

  const created = await jsonRequest(`${baseUrl}/api/v1/problems`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      title: 'Định lý Viète trong phương trình bậc hai',
      body: 'Cho phương trình bậc hai có hai nghiệm. Hãy chứng minh hệ thức Viète.',
      source: 'E2E Phase 5',
      difficulty: 'Trung bình',
      categorySlugs: ['dai-so'],
      status: 'draft',
    }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.match(created.body.problem.slug, /^dinh-ly-viete-trong-phuong-trinh-bac-hai/);
  assert.equal(created.body.problem.status, 'draft');
  problemId = created.body.problem.id;
  const slug = created.body.problem.slug;

  const hiddenDraft = await jsonRequest(`${baseUrl}/api/v1/problems/${slug}`);
  assert.equal(hiddenDraft.response.status, 404);

  const mine = await jsonRequest(`${baseUrl}/api/v1/problems/mine?page=1&limit=10`, {
    headers: { Cookie: cookie },
  });
  assert.equal(mine.response.status, 200);
  assert.equal(mine.body.total, 1);
  assert.equal(mine.body.problems[0].id, problemId);

  const updated = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}`, {
    method: 'PATCH',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      body: 'Cho phương trình bậc hai có hai nghiệm phân biệt. Hãy chứng minh các hệ thức Viète.',
      status: 'pending',
      changeSummary: 'Bổ sung điều kiện hai nghiệm phân biệt',
    }),
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.problem.status, 'pending');

  const history = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/history`, {
    headers: { Cookie: cookie },
  });
  assert.equal(history.response.status, 200);
  assert.equal(history.body.revisions.length, 2);
  assert.equal(history.body.revisions[0].version, 2);

  await database.execute(
    "UPDATE problems SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?",
    [problemId],
  );
  const listed = await jsonRequest(
    `${baseUrl}/api/v1/problems?search=Viète&category=dai-so&difficulty=${encodeURIComponent('Trung bình')}`,
  );
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.total, 1);
  assert.equal(listed.body.problems[0].slug, slug);

  const detail = await jsonRequest(`${baseUrl}/api/v1/problems/${slug}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.problem.id, problemId);

  const removed = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  assert.equal(removed.response.status, 204);
  const afterDelete = await jsonRequest(`${baseUrl}/api/v1/problems/${slug}`);
  assert.equal(afterDelete.response.status, 404);

  process.stdout.write('Problems E2E thành công: draft, danh sách của tôi, sửa, lịch sử, slug, lọc, chi tiết và xóa mềm.\n');
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (problemId) await database.execute('DELETE FROM problems WHERE id = ?', [problemId]);
  await database.execute('DELETE FROM users WHERE id = ?', [userId]);
  await database.end();
}
