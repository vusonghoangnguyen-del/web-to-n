import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { deflateSync } from 'node:zlib';
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
const database = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const children = [];
const users = [];
const projects = [];

function run(args, env = {}) {
  const output = [];
  const child = spawn(process.execPath, args, { cwd: apiRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (part) => output.push(part.toString()));
  child.stderr.on('data', (part) => output.push(part.toString()));
  children.push(child);
  return { child, output };
}

async function account() {
  const id = randomUUID().replaceAll('-', '');
  const [result] = await database.execute(`INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at) VALUES (?, 'LaTeX Build E2E', ?, 'unused', 'reader', 'active', CURRENT_TIMESTAMP)`, [`build_${id.slice(0, 15)}`, `build-${id}@example.test`]);
  users.push(result.insertId);
  const token = randomBytes(32).toString('base64url');
  await database.execute(`INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at) VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR), CURRENT_TIMESTAMP)`, [randomUUID(), result.insertId, createHash('sha256').update(token).digest('hex')]);
  return `to_toan_session=${token}`;
}

async function request(url, method, cookie, payload) {
  const response = await fetch(url, { method, headers: { Cookie: cookie, ...(payload ? { 'Content-Type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
  return { response, body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : null };
}

async function waitForBuild(url, cookie) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const { body } = await request(url, 'GET', cookie);
    if (['success', 'failed'].includes(body.build.status)) return body.build;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Build did not finish in 60 seconds');
}

function pngChunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, content, checksum]);
}

function tinyPng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0]))), pngChunk('IEND', Buffer.alloc(0))]);
}

try {
  const owner = await account();
  const other = await account();
  const api = run(['dist/main.js'], { NEST_PORT: String(port) });
  const worker = run(['dist/latex/worker/main.js']);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (api.child.exitCode !== null) throw new Error(api.output.join(''));
    if (worker.child.exitCode !== null) throw new Error(worker.output.join(''));
    try { if ((await fetch(`http://127.0.0.1:${port}/api/v1/health`)).ok && worker.output.join('').includes('LaTeX worker ready')) break; }
    catch { /* Wait for servers. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const source = String.raw`\documentclass{article}
\usepackage{amsmath,graphicx}
\title{A complete article}
\author{LaTeX integration test}
\begin{document}
\maketitle
\section{Proof}
\input{chapters/proof}
\includegraphics[width=1cm]{images/pixel.png}
See \cite{euler1748}.
\bibliographystyle{plain}
\bibliography{references}
\end{document}`;
  const created = await request(base, 'POST', owner, { title: 'A complete article', compiler: 'pdflatex', source });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const projectId = created.body.project.id;
  projects.push(projectId);
  const added = await request(`${base}/${projectId}/files`, 'POST', owner, { path: 'chapters/proof.tex', content: String.raw`\[ e^{i\pi}+1=0 \]` });
  assert.equal(added.response.status, 201, JSON.stringify(added.body));
  const auxiliary = added.body.project.files.find((file) => file.path === 'chapters/proof.tex');
  assert.ok(auxiliary);
  const bibliography = await request(`${base}/${projectId}/files`, 'POST', owner, { path: 'references.bib', content: '@book{euler1748, title={Introductio in analysin infinitorum}, author={Euler, Leonhard}, year={1748}}' });
  assert.equal(bibliography.response.status, 201, JSON.stringify(bibliography.body));
  assert.equal((await request(`${base}/${projectId}/files/${auxiliary.id}/raw`, 'GET', other)).response.status, 404);
  const pixel = tinyPng();
  const imageForm = new FormData();
  imageForm.set('path', 'images/pixel.png');
  imageForm.set('file', new Blob([pixel], { type: 'image/png' }), 'pixel.png');
  const imageResponse = await fetch(`${base}/${projectId}/files/upload`, { method: 'POST', headers: { Cookie: owner }, body: imageForm });
  const imageBody = await imageResponse.json();
  assert.equal(imageResponse.status, 201, JSON.stringify(imageBody));
  const image = imageBody.project.files.find((file) => file.path === 'images/pixel.png');
  assert.ok(image);
  const imageRaw = await fetch(`${base}/${projectId}/files/${image.id}/raw`, { headers: { Cookie: owner } });
  assert.equal(imageRaw.status, 200);
  assert.deepEqual(Buffer.from(await imageRaw.arrayBuffer()), pixel);
  const zip = await fetch(`${base}/${projectId}/export`, { headers: { Cookie: owner } });
  assert.equal(zip.status, 200);
  const imported = new FormData();
  imported.set('file', new Blob([await zip.arrayBuffer()], { type: 'application/zip' }), 'article.zip');
  const importedResponse = await fetch(`${base}/import-zip`, { method: 'POST', headers: { Cookie: owner }, body: imported });
  const importedBody = await importedResponse.json();
  assert.equal(importedResponse.status, 201, JSON.stringify(importedBody));
  assert.ok(importedBody.project.files.some((file) => file.path === 'chapters/proof.tex'));
  assert.ok(importedBody.project.files.some((file) => file.path === 'references.bib'));
  assert.ok(importedBody.project.files.some((file) => file.path === 'images/pixel.png'));
  projects.push(importedBody.project.id);
  assert.equal((await request(`${base}/${importedBody.project.id}`, 'GET', other)).response.status, 404);
  assert.equal((await request(`${base}/${projectId}/files`, 'POST', owner, { path: '../escape.tex', content: 'no' })).response.status, 400);
  assert.equal((await request(`${base}/${projectId}/files`, 'POST', owner, { path: 'aux.tex', content: 'no' })).response.status, 400);
  assert.equal((await request(`${base}/${projectId}/files`, 'POST', owner, { path: 'chapters/proof.tex', content: 'duplicate' })).response.status, 400);
  const compiled = await request(`${base}/${projectId}/compile`, 'POST', owner);
  assert.equal(compiled.response.status, 202, JSON.stringify(compiled.body));
  const buildId = compiled.body.build.id;
  const buildUrl = `${base}/${projectId}/builds/${buildId}`;
  assert.equal((await request(buildUrl, 'GET', other)).response.status, 404);
  const success = await waitForBuild(buildUrl, owner);
  assert.equal(success.status, 'success', JSON.stringify(success));
  assert.match(success.log, /latexmk/i);
  assert.match(success.log, /chapters\/proof/i);
  assert.match(success.log, /bibtex/i);
  const pdf = await request(`${buildUrl}/pdf`, 'GET', owner);
  assert.equal(pdf.response.status, 200);
  assert.match(pdf.response.headers.get('content-type'), /application\/pdf/);
  assert.equal(Buffer.from(await pdf.response.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await request(`${buildUrl}/pdf`, 'GET', other)).response.status, 404);

  const fileId = created.body.project.mainFile.id;
  await request(`${base}/${projectId}/files/${fileId}`, 'PUT', owner, { content: '\\documentclass{article}\n\\begin{document}\n\\notacommand\n\\end{document}' });
  const bad = await request(`${base}/${projectId}/compile`, 'POST', owner);
  assert.equal(bad.response.status, 202, JSON.stringify(bad.body));
  const failed = await waitForBuild(`${base}/${projectId}/builds/${bad.body.build.id}`, owner);
  assert.equal(failed.status, 'failed');
  assert.ok(failed.log.length > 0);
  assert.equal((await request(`${base}/${projectId}/builds/${bad.body.build.id}/pdf`, 'GET', owner)).response.status, 404);
  assert.equal((await request(`${base}/${projectId}`, 'DELETE', owner)).response.status, 204);
  projects.splice(projects.indexOf(projectId), 1);
  console.log('LaTeX build E2E: nhiều tệp, ZIP, PDF, lỗi biên dịch, log, phân quyền và xóa dự án đạt.');
} finally {
  for (const child of children) child.kill();
  await Promise.all(children.map((child) => child.exitCode !== null ? Promise.resolve() : Promise.race([new Promise((resolve) => child.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 2000))])));
  for (const id of projects) await database.execute('DELETE FROM latex_projects WHERE id = ?', [id]);
  for (const id of users) await database.execute('DELETE FROM users WHERE id = ?', [id]);
  await database.end();
}
