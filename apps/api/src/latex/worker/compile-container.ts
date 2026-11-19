import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { LatexCompiler } from '../../database/entities/latex-project.entity';
import { latexImage, latexLuaTimeoutMs, latexMaxLogChars, latexMaxPdfBytes, latexStorageRoot, latexTimeoutMs } from '../build-config';
import { readProjectZip } from '../latex-zip';

type CompileInput = { projectId: string; buildId: string; compiler: LatexCompiler; source: string; archive?: Buffer | null };
type CompileResult = { success: boolean; pdfPath: string | null; log: string; errorMessage: string | null };

const modes: Record<LatexCompiler, string> = {
  [LatexCompiler.PdfLatex]: '-pdf',
  [LatexCompiler.XeLatex]: '-pdfxe',
  [LatexCompiler.LuaLatex]: '-pdflua',
};

const secureCommands = '$pdflatex=q/pdflatex -no-shell-escape %O %S/; $xelatex=q/xelatex -no-shell-escape %O %S/; $lualatex=q/lualatex -no-shell-escape %O %S/;';

export async function compileContainer(input: CompileInput): Promise<CompileResult> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'to-toan-tex-'));
  const containerName = `to-toan-tex-${input.buildId}-${randomUUID().slice(0, 8)}`;
  try {
    if (input.archive) {
      const files = await readProjectZip(input.archive);
      for (const file of files) {
        const destination = path.join(directory, ...file.path.split('/'));
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, file.binary || Buffer.from(file.content, 'utf8'));
      }
    } else {
      await writeFile(path.join(directory, 'main.tex'), input.source, 'utf8');
    }
    const args = [
      'run', '--rm', '--pull=never', '--name', containerName,
      '--network', 'none', '--cpus', '1', '--memory', '512m', '--memory-swap', '512m',
      '--pids-limit', '128', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges=true', '--user', '1000:1000',
      '--tmpfs', '/tmp:rw,nosuid,nodev,size=64m',
      '--mount', `type=bind,source=${directory},target=/work`,
      '--workdir', '/work', '--env', 'HOME=/tmp', '--env', 'TEXMFVAR=/tmp/texmf-var',
      '--env', 'openin_any=p', '--env', 'openout_any=p',
      latexImage(),
      'latexmk', '-norc', modes[input.compiler], '-interaction=nonstopmode',
      '-halt-on-error', '-file-line-error', '-e', secureCommands, 'main.tex',
    ];
    const timeoutMs = input.compiler === LatexCompiler.LuaLatex ? latexLuaTimeoutMs : latexTimeoutMs;
    const execution = await runDocker(args, containerName, timeoutMs);
    const texLog = await readLog(path.join(directory, 'main.log'));
    const log = [execution.output, texLog].filter(Boolean).join('\n\n--- main.log ---\n').slice(0, latexMaxLogChars);
    if (execution.timedOut) return failure(`Biên dịch quá ${timeoutMs / 1000} giây và đã bị dừng.`, log);
    if (execution.exitCode !== 0) return failure(extractError(log), log);

    const pdf = path.join(directory, 'main.pdf');
    let pdfStat;
    try { pdfStat = await stat(pdf); }
    catch { return failure('Trình biên dịch không tạo ra PDF. Xem log để biết chi tiết.', log); }
    if (!pdfStat.isFile() || pdfStat.size < 8 || pdfStat.size > latexMaxPdfBytes) {
      return failure('PDF trống hoặc vượt giới hạn 20 MB.', log);
    }
    const file = await open(pdf, 'r');
    const header = Buffer.alloc(5);
    try { await file.read(header, 0, 5, 0); }
    finally { await file.close(); }
    if (header.toString('ascii') !== '%PDF-') return failure('Đầu ra không phải tệp PDF hợp lệ.', log);

    const relativePath = path.join(input.projectId, input.buildId, 'main.pdf');
    const destination = path.join(latexStorageRoot(), relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(pdf, destination);
    return { success: true, pdfPath: relativePath.replaceAll('\\', '/'), log, errorMessage: null };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function failure(errorMessage: string, log: string): CompileResult {
  return { success: false, pdfPath: null, log, errorMessage: errorMessage.slice(0, 500) };
}

function extractError(log: string): string {
  const texError = log.match(/^!\s+(.+)$/m)?.[1] || log.match(/^main\.tex:\d+:\s*(.+)$/m)?.[1];
  if (texError) return texError.trim().slice(0, 500);
  if (/Unable to find image|No such image/i.test(log)) return 'Chưa có TeX Live image. Chạy docker pull texlive/texlive:latest.';
  if (/docker.*(daemon|pipe)|failed to connect/i.test(log)) return 'Docker Desktop chưa chạy.';
  return 'Biên dịch LaTeX thất bại. Xem log để biết chi tiết.';
}

async function readLog(filePath: string): Promise<string> {
  try {
    const file = await open(filePath, 'r');
    const buffer = Buffer.alloc(latexMaxLogChars);
    try {
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally { await file.close(); }
  } catch { return ''; }
}

async function runDocker(args: string[], containerName: string, timeoutMs: number) {
  return new Promise<{ exitCode: number | null; timedOut: boolean; output: string }>((resolve) => {
    const child = spawn('docker', args, { windowsHide: true, shell: false });
    let output = '';
    let timedOut = false;
    let finished = false;
    let cleanupPromise: Promise<void> | null = null;
    const append = (chunk: Buffer) => { if (output.length < latexMaxLogChars) output += chunk.toString('utf8').slice(0, latexMaxLogChars - output.length); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => { append(Buffer.from(error.message)); });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      const cleanup = spawn('docker', ['rm', '-f', containerName], { windowsHide: true, shell: false, stdio: 'ignore' });
      cleanupPromise = new Promise((done) => {
        const guard = setTimeout(done, 5_000);
        cleanup.once('close', () => { clearTimeout(guard); done(); });
        cleanup.once('error', () => { clearTimeout(guard); done(); });
      });
    }, timeoutMs);
    child.on('close', async (exitCode) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      await cleanupPromise;
      resolve({ exitCode, timedOut, output });
    });
  });
}
