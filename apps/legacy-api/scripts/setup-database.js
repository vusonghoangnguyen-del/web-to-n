import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptRoot, '..');
const repoRoot = path.resolve(apiRoot, '..', '..');

function askHidden(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) throw new Error('Lệnh này cần chạy trong terminal tương tác.');
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let value = '';
    const onData = (key) => {
      if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (key === '\u0003') {
        process.exit(130);
      } else if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
      } else {
        value += key;
      }
    };
    process.stdin.on('data', onData);
  });
}

const rootPassword = await askHidden('Nhập mật khẩu MySQL root (sẽ không hiển thị): ');
const appPassword = crypto.randomBytes(24).toString('base64url');
const jwtSecret = crypto.randomBytes(48).toString('base64url');

const admin = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: rootPassword,
  multipleStatements: true,
});

try {
  await admin.query("CREATE DATABASE IF NOT EXISTS `to_toan` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
  const escapedPassword = admin.escape(appPassword);
  for (const host of ['localhost', '127.0.0.1']) {
    await admin.query(`CREATE USER IF NOT EXISTS 'to_toan_app'@'${host}' IDENTIFIED BY ${escapedPassword}`);
    await admin.query(`ALTER USER 'to_toan_app'@'${host}' IDENTIFIED BY ${escapedPassword}`);
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`to_toan\`.* TO 'to_toan_app'@'${host}'`);
  }
  await admin.query('FLUSH PRIVILEGES');

  const schema = await fs.readFile(path.join(apiRoot, 'database', 'schema.sql'), 'utf8');
  await admin.changeUser({ database: 'to_toan' });
  await admin.query(schema);

  const env = `NODE_ENV=development\nPORT=3000\n\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_NAME=to_toan\nDB_USER=to_toan_app\nDB_PASSWORD=${appPassword}\n\nJWT_SECRET=${jwtSecret}\n`;
  try {
    await fs.writeFile(path.join(repoRoot, '.env'), env, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('File .env đã tồn tại. Hãy đổi tên hoặc xóa file cũ rồi chạy lại.');
    }
    throw error;
  }
  console.log('Đã tạo database, schema, tài khoản ứng dụng và file .env.');
} finally {
  await admin.end();
}
