import { rm } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import mysql from 'mysql2/promise';

loadEnvironment({ path: path.resolve('.env'), quiet: true });
const days = Number(process.env.LATEX_RETENTION_DAYS || 90);
if (!Number.isInteger(days) || days < 1) throw new Error('LATEX_RETENTION_DAYS phải là số nguyên dương.');
const apply = process.argv.includes('--apply');
const root = path.resolve(process.env.LATEX_STORAGE_DIR || 'storage/latex-builds');
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
  const where = "created_at < ? AND status IN ('success','failed','cancelled')";
  if (!apply) {
    const [[row]] = await database.execute(`SELECT COUNT(*) AS count FROM latex_builds WHERE ${where}`, [cutoff]);
    console.log(`Có ${row.count} build cũ hơn ${days} ngày. Chạy lại với --apply để xóa.`);
    process.exitCode = 0;
  }
  let removed = 0;
  while (apply) {
    const [rows] = await database.execute(
      `SELECT id, pdf_path FROM latex_builds WHERE ${where} ORDER BY id LIMIT 500`, [cutoff],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row.pdf_path) {
        const filename = path.resolve(root, row.pdf_path);
        if (!filename.startsWith(root + path.sep)) throw new Error(`Đường dẫn PDF không hợp lệ: build ${row.id}`);
        await rm(filename, { force: true });
      }
      await database.execute('DELETE FROM latex_builds WHERE id = ?', [row.id]);
      removed++;
    }
  }
  if (apply) console.log(`Đã xóa ${removed} build cũ hơn ${days} ngày.`);
} finally {
  await database.end();
}
