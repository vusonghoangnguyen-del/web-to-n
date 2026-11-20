import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import mysql from 'mysql2/promise';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnvironment({ path: path.join(repositoryRoot, '.env'), quiet: true });
const days = Number(process.env.LATEX_RETENTION_DAYS || 90);
if (!Number.isInteger(days) || days < 1) throw new Error('LATEX_RETENTION_DAYS phải là số nguyên dương.');
const apply = process.argv.includes('--apply');
const root = path.resolve(process.env.LATEX_STORAGE_DIR || path.join(repositoryRoot, 'storage/latex-builds'));
const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const database = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
});

try {
  const where = "b.created_at < ? AND b.status IN ('success','failed','cancelled') AND NOT EXISTS (SELECT 1 FROM problems p WHERE p.latex_build_id = b.id)";
  if (!apply) {
    const [[row]] = await database.execute(`SELECT COUNT(*) AS count FROM latex_builds b WHERE ${where}`, [cutoff]);
    console.log(`Có ${row.count} build cũ hơn ${days} ngày. Chạy lại với --apply để xóa.`);
    process.exitCode = 0;
  }
  let removed = 0;
  while (apply) {
    const [rows] = await database.execute(
      `SELECT b.id, b.pdf_path FROM latex_builds b WHERE ${where} ORDER BY b.id LIMIT 500`, [cutoff],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      const [deleted] = await database.execute('DELETE FROM latex_builds WHERE id = ? AND NOT EXISTS (SELECT 1 FROM problems WHERE latex_build_id = ?)', [row.id, row.id]);
      if (deleted.affectedRows === 0) continue;
      if (row.pdf_path) {
        const filename = path.resolve(root, row.pdf_path);
        if (!filename.startsWith(root + path.sep)) throw new Error(`Đường dẫn PDF không hợp lệ: build ${row.id}`);
        await rm(filename, { force: true });
      }
      removed++;
    }
  }
  if (apply) console.log(`Đã xóa ${removed} build cũ hơn ${days} ngày.`);
} finally {
  await database.end();
}
