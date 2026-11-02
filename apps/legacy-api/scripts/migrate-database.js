import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptRoot, '..');

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

const rootPassword = await askHidden('Nhập mật khẩu MySQL root để cập nhật cấu trúc (sẽ không hiển thị): ');
const connection = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: rootPassword,
  database: 'to_toan',
  multipleStatements: true,
});

try {
  const sql = await fs.readFile(path.join(apiRoot, 'database', 'migrations', '001_comments.sql'), 'utf8');
  await connection.query(sql);
  console.log('Đã cập nhật database: thêm bảng comments.');
} finally {
  await connection.end();
}
