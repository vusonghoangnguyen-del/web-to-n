import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { config as loadEnv } from 'dotenv';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnv({ path: path.join(repoRoot, '.env'), quiet: true });
if (!process.stdin.isTTY) throw new Error('Hãy chạy lệnh này trong PowerShell tương tác.');
for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Thiếu ${key} trong .env. Hãy thiết lập database trước.`);
}

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const email = (await prompt.question('Email admin: ')).trim().toLowerCase();
const username = (await prompt.question('Tên đăng nhập (3-30 chữ thường/số/_): ')).trim().toLowerCase();
prompt.close();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw new Error('Email không hợp lệ.');
if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error('Tên đăng nhập không hợp lệ.');

function askHidden(label) {
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    function onData(chunk) {
      for (const key of chunk) {
        if (key === '\r' || key === '\n') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        } else if (key === '\u0003') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          reject(new Error('Đã hủy.'));
          return;
        } else if (key === '\u007f' || key === '\b') {
          value = value.slice(0, -1);
        } else if (key >= ' ') {
          value += key;
        }
      }
    }
    process.stdin.on('data', onData);
  });
}

let password = await askHidden('Mật khẩu đăng nhập (8-128 ký tự, không hiện khi gõ): ');
let confirmation = await askHidden('Nhập lại mật khẩu: ');
if (password.length < 8 || password.length > 128) throw new Error('Mật khẩu cần từ 8 đến 128 ký tự.');
if (password !== confirmation) throw new Error('Hai mật khẩu không khớp.');
confirmation = '';
const hash = await bcrypt.hash(password, 12);
password = '';

const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
try {
  const [existing] = await db.execute('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1', [email, username]);
  if (existing.length) throw new Error('Email hoặc tên đăng nhập đã tồn tại. Nếu tài khoản đã được tạo, dùng lệnh admin:grant với email đó.');
  await db.execute(
    "INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at) VALUES (?, ?, ?, ?, 'admin', 'active', CURRENT_TIMESTAMP)",
    [username, username, email, hash],
  );
  console.log(`Đã tạo tài khoản admin ${username}. Đăng nhập bằng email hoặc tên đăng nhập vừa nhập.`);
} finally {
  await db.end();
}
