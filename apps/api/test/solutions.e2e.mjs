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

async function createUserWithSession(database, label, role = 'reader') {
  const unique = randomUUID().replaceAll('-', '');
  const email = `solutions-${label}-${unique}@example.test`;
  const username = `s_${label}_${unique.slice(0, 12)}`;
  const [result] = await database.execute(
    `INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at)
     VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
    [username, `Solutions ${label}`, email, 'not-used-by-this-test', role],
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
const outsider = await createUserWithSession(database, 'outsider');
const moderator = await createUserWithSession(database, 'moderator', 'moderator');
const slug = `solutions-e2e-${randomUUID()}`;
const [problemResult] = await database.execute(
  `INSERT INTO problems (author_id, title, slug, content, difficulty, status, published_at)
   VALUES (?, ?, ?, ?, 'Khó', 'published', CURRENT_TIMESTAMP)`,
  [author.id, 'Bài toán kiểm thử lời giải', slug, 'Nội dung đủ dài cho bài toán kiểm thử lời giải.'],
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

  const created = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/solutions`, {
    method: 'POST',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({ content: 'Đây là lời giải ban đầu có nội dung đủ dài để gửi duyệt.' }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.solution.status, 'pending');
  const solutionId = created.body.solution.id;

  const duplicate = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/solutions`, {
    method: 'POST',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({ content: 'Đây là lời giải trùng trong lúc lời giải trước vẫn đang chờ duyệt.' }),
  });
  assert.equal(duplicate.response.status, 409);

  const forbiddenEdit = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}`, {
    method: 'PATCH',
    headers: { Cookie: outsider.cookie },
    body: JSON.stringify({ content: 'Người khác không được phép chỉnh sửa nội dung lời giải này.' }),
  });
  assert.equal(forbiddenEdit.response.status, 403);

  const edited = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}`, {
    method: 'PATCH',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({
      content: 'Đây là lời giải đã chỉnh sửa, bổ sung các bước biến đổi chi tiết hơn.',
      changeSummary: 'Bổ sung các bước biến đổi',
    }),
  });
  assert.equal(edited.response.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.solution.edited, true);

  const history = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}/history`, {
    headers: { Cookie: author.cookie },
  });
  assert.equal(history.response.status, 200);
  assert.equal(history.body.revisions.length, 2);
  assert.equal(history.body.revisions[0].version, 2);

  const moderation = await jsonRequest(`${baseUrl}/api/v1/solutions/moderation?status=pending`, {
    headers: { Cookie: moderator.cookie },
  });
  assert.equal(moderation.response.status, 200, `${JSON.stringify(moderation.body)}\n${output.join('')}`);
  assert.ok(moderation.body.solutions.some((solution) => solution.id === solutionId));

  const invalidRejection = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}/review`, {
    method: 'PATCH',
    headers: { Cookie: moderator.cookie },
    body: JSON.stringify({ status: 'rejected' }),
  });
  assert.equal(invalidRejection.response.status, 400);

  const rejected = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}/review`, {
    method: 'PATCH',
    headers: { Cookie: moderator.cookie },
    body: JSON.stringify({ status: 'rejected', reviewNote: 'Cần giải thích rõ bước suy luận cuối.' }),
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.solution.status, 'rejected');

  const resubmitted = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}`, {
    method: 'PATCH',
    headers: { Cookie: author.cookie },
    body: JSON.stringify({
      content: 'Lời giải hoàn chỉnh đã giải thích rõ bước suy luận cuối cùng theo góp ý.',
      changeSummary: 'Sửa theo góp ý của kiểm duyệt viên',
    }),
  });
  assert.equal(resubmitted.response.status, 200);
  assert.equal(resubmitted.body.solution.status, 'pending');
  assert.equal(resubmitted.body.solution.reviewNote, null);

  const verified = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}/review`, {
    method: 'PATCH',
    headers: { Cookie: moderator.cookie },
    body: JSON.stringify({ status: 'verified' }),
  });
  assert.equal(verified.response.status, 200);
  assert.equal(verified.body.solution.status, 'verified');

  const featured = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}/featured`, {
    method: 'PATCH',
    headers: { Cookie: moderator.cookie },
    body: JSON.stringify({ featured: true }),
  });
  assert.equal(featured.response.status, 200);
  assert.equal(featured.body.solution.isFeatured, true);

  const publicList = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/solutions`);
  assert.equal(publicList.response.status, 200);
  assert.equal(publicList.body.total, 1);
  assert.equal(publicList.body.solutions[0].id, solutionId);
  assert.equal(publicList.body.solutions[0].isFeatured, true);

  const mine = await jsonRequest(`${baseUrl}/api/v1/solutions/mine`, {
    headers: { Cookie: author.cookie },
  });
  assert.equal(mine.response.status, 200);
  assert.equal(mine.body.solutions[0].problem.id, String(problemId));

  const withdrawn = await jsonRequest(`${baseUrl}/api/v1/solutions/${solutionId}`, {
    method: 'DELETE',
    headers: { Cookie: author.cookie },
  });
  assert.equal(withdrawn.response.status, 204);
  const afterWithdraw = await jsonRequest(`${baseUrl}/api/v1/problems/${problemId}/solutions`);
  assert.equal(afterWithdraw.response.status, 200);
  assert.equal(afterWithdraw.body.total, 0);

  const [revisionRows] = await database.execute(
    'SELECT version, status FROM solution_revisions WHERE solution_id = ? ORDER BY version',
    [solutionId],
  );
  assert.equal(revisionRows.length, 6);
  assert.equal(revisionRows.at(-1).status, 'withdrawn');

  process.stdout.write('Solutions E2E thành công: gửi, sửa, phân quyền, lịch sử, từ chối, gửi lại, kiểm chứng, nổi bật và rút lời giải.\n');
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  await database.execute('DELETE FROM problems WHERE id = ?', [problemId]);
  await database.execute('DELETE FROM users WHERE id IN (?, ?, ?)', [author.id, outsider.id, moderator.id]);
  await database.end();
}
