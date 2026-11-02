import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import process from 'node:process';
import mysql from 'mysql2/promise';
import { repoRoot } from '../server/paths.js';

loadEnv({ path: path.join(repoRoot, '.env') });

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Cách dùng: npm.cmd run admin:grant -- email@example.com');
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

try {
  const [result] = await connection.execute(
    "UPDATE users SET role = 'admin', status = 'active', email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE email = ?",
    [email],
  );
  if (!result.affectedRows) {
    console.error('Không tìm thấy tài khoản có email này. Hãy tạo tài khoản trên website trước.');
    process.exitCode = 2;
  } else {
    console.log(`Đã cấp quyền admin cho ${email}.`);
  }
} finally {
  await connection.end();
}
