import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { checkProjectFiles, maxBinaryBytes, maxFiles, maxProjectBytes, maxZipBytes, projectFileFromBuffer, ProjectFile } from './latex-files';

export async function readProjectZip(data: Buffer): Promise<ProjectFile[]> {
  if (!data.length || data.length > maxZipBytes) throw new BadRequestException('ZIP không được vượt quá 20 MB.');
  const entries = await new Promise<{ name: string; data: Buffer }[]>((resolve, reject) => {
    yauzl.fromBuffer(data, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (openError, zip) => {
      if (openError || !zip) { reject(new BadRequestException('Không đọc được tệp ZIP.')); return; }
      if (zip.entryCount > maxFiles + 100) { zip.close(); reject(new BadRequestException('ZIP có quá nhiều mục.')); return; }
      const items: { name: string; data: Buffer }[] = [];
      let total = 0;
      let done = false;
      const fail = (cause: unknown) => {
        if (done) return;
        done = true;
        zip.close();
        reject(cause instanceof BadRequestException ? cause : new BadRequestException('ZIP bị lỗi hoặc không hợp lệ.'));
      };
      zip.on('error', fail);
      zip.on('end', () => { if (!done) { done = true; resolve(items); } });
      zip.on('entry', (entry) => {
        void (async () => {
          if (entry.fileName.endsWith('/')) { zip.readEntry(); return; }
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (mode === 0o120000) throw new BadRequestException('ZIP không được chứa symbolic link.');
          if (items.length >= maxFiles) throw new BadRequestException(`Dự án chỉ được tối đa ${maxFiles} tệp.`);
          if (entry.uncompressedSize > maxBinaryBytes || total + entry.uncompressedSize > maxProjectBytes) {
            throw new BadRequestException('Tệp hoặc tổng dữ liệu trong ZIP vượt giới hạn.');
          }
          const stream = await new Promise<NodeJS.ReadableStream>((ok, no) => zip.openReadStream(entry, (error, value) => error || !value ? no(error) : ok(value)));
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const part of stream) {
            const chunk = Buffer.from(part);
            size += chunk.length;
            if (size > maxBinaryBytes || total + size > maxProjectBytes) throw new BadRequestException('Dữ liệu giải nén vượt giới hạn.');
            chunks.push(chunk);
          }
          total += size;
          items.push({ name: entry.fileName, data: Buffer.concat(chunks, size) });
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  });
  if (!entries.length) throw new BadRequestException('ZIP không có tệp nào.');
  const names = entries.map((entry) => entry.name);
  const root = names[0].split('/')[0];
  const stripRoot = !names.includes('main.tex') && names.every((name) => name.startsWith(`${root}/`));
  const normalized = entries.map(({ name, data }) => ({ name: stripRoot ? name.slice(root.length + 1) : name, data }));
  if (!normalized.some((entry) => entry.name === 'main.tex')) {
    const candidates = normalized.filter((entry) => !entry.name.includes('/') && entry.name.toLowerCase().endsWith('.tex'));
    if (candidates.length !== 1) throw new BadRequestException('Không xác định được tệp chính. ZIP cần main.tex hoặc đúng một tệp .tex ở thư mục gốc.');
    candidates[0].name = 'main.tex';
  }
  const files = normalized.map((entry) => projectFileFromBuffer(entry.name, entry.data));
  checkProjectFiles(files);
  return files;
}

export async function writeProjectZip(files: ProjectFile[]): Promise<Buffer> {
  checkProjectFiles(files);
  const zip = new yazl.ZipFile();
  for (const file of files) zip.addBuffer(file.binary || Buffer.from(file.content, 'utf8'), file.path, { mtime: new Date('1980-01-01T00:00:00Z') });
  const result = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    zip.outputStream.on('data', (part: Buffer) => {
      total += part.length;
      if (total > maxProjectBytes + 2_000_000) {
        (zip.outputStream as Readable).destroy(new Error('ZIP vượt giới hạn.'));
        return;
      }
      chunks.push(part);
    });
    zip.outputStream.on('error', reject);
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks, total)));
  });
  zip.end();
  return result;
}
