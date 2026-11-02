import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptDirectory, '..');
const repositoryRoot = path.resolve(apiRoot, '..', '..');
const cliPath = path.join(repositoryRoot, 'node_modules', 'typeorm', 'cli-ts-node-commonjs.js');
const dataSourcePath = path.join(apiRoot, 'src', 'database', 'data-source.ts');

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Lệnh migration cần chạy trong terminal tương tác.'));
      return;
    }

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

const commandArguments = process.argv.slice(2);
if (commandArguments.length === 0) throw new Error('Thiếu lệnh TypeORM migration.');

let rootPassword = await askHidden('Nhập mật khẩu MySQL root (không hiển thị): ');
const child = spawn(
  process.execPath,
  [cliPath, '-d', dataSourcePath, ...commandArguments],
  {
    cwd: apiRoot,
    env: {
      ...process.env,
      DB_USER: 'root',
      DB_PASSWORD: rootPassword,
    },
    stdio: 'inherit',
  },
);
rootPassword = '';

child.once('error', (error) => {
  throw error;
});
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
