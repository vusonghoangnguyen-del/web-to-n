import { BadRequestException } from '@nestjs/common';
import path from 'node:path';

export type ProjectFile = { path: string; content: string; binary: Buffer | null; mimeType: string; sizeBytes: number };

export const maxFiles = 100;
export const maxProjectBytes = 25 * 1024 * 1024;
export const maxTextBytes = 1_000_000;
export const maxBinaryBytes = 5 * 1024 * 1024;
export const maxZipBytes = 20 * 1024 * 1024;

const textMime: Record<string, string> = {
  '.tex': 'text/x-tex', '.bib': 'text/x-bibtex', '.sty': 'text/x-tex',
  '.cls': 'text/x-tex', '.bst': 'text/plain', '.bbx': 'text/plain',
  '.cbx': 'text/plain', '.def': 'text/plain', '.cfg': 'text/plain', '.txt': 'text/plain',
};
const binaryMime: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.eps': 'application/postscript',
};

export function cleanProjectPath(value: string): string {
  if (typeof value !== 'string' || !value || value.length > 255 || value.includes('\\') || value.startsWith('/') || value.includes('\0')) {
    throw new BadRequestException('Đường dẫn tệp không hợp lệ.');
  }
  const parts = value.split('/');
  if (parts.length > 10 || parts.some((part) => !part || part === '.' || part === '..' || part.length > 80 || part.startsWith('.') || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || !/^[\p{L}\p{N}_. -]+$/u.test(part))) {
    throw new BadRequestException('Đường dẫn tệp không hợp lệ.');
  }
  const extension = path.posix.extname(value).toLowerCase();
  if (!textMime[extension] && !binaryMime[extension]) {
    throw new BadRequestException(`Loại tệp ${extension || '(không có phần mở rộng)'} chưa được hỗ trợ.`);
  }
  return value;
}

export function isTextPath(filePath: string): boolean {
  return Boolean(textMime[path.posix.extname(filePath).toLowerCase()]);
}

export function projectFileFromBuffer(filePath: string, data: Buffer): ProjectFile {
  const clean = cleanProjectPath(filePath);
  const ext = path.posix.extname(clean).toLowerCase();
  const mimeType = textMime[ext] || binaryMime[ext];
  const limit = textMime[ext] ? maxTextBytes : maxBinaryBytes;
  if (data.length > limit) throw new BadRequestException(`${clean} vượt giới hạn ${Math.round(limit / 1024 / 1024)} MB.`);
  if (textMime[ext]) {
    let content: string;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { throw new BadRequestException(`${clean} cần dùng mã hóa UTF-8.`); }
    if (content.includes('\0')) throw new BadRequestException(`${clean} có ký tự không hợp lệ.`);
    return { path: clean, content, binary: null, mimeType, sizeBytes: data.length };
  }
  if (!validBinary(ext, data)) throw new BadRequestException(`${clean} không đúng định dạng ${ext}.`);
  return { path: clean, content: '', binary: data, mimeType, sizeBytes: data.length };
}

export function projectFileFromText(filePath: string, content: string): ProjectFile {
  const clean = cleanProjectPath(filePath);
  if (!isTextPath(clean) || typeof content !== 'string') throw new BadRequestException('Chỉ có thể soạn tệp văn bản LaTeX.');
  return projectFileFromBuffer(clean, Buffer.from(content, 'utf8'));
}

export function checkProjectFiles(files: ProjectFile[]): void {
  if (files.length > maxFiles) throw new BadRequestException(`Dự án chỉ được tối đa ${maxFiles} tệp.`);
  const seen = new Set<string>();
  let total = 0;
  for (const file of files) {
    const key = file.path.toLocaleLowerCase('en');
    if (seen.has(key)) throw new BadRequestException(`Tệp ${file.path} bị trùng.`);
    seen.add(key);
    total += file.sizeBytes;
  }
  if (total > maxProjectBytes) throw new BadRequestException('Tổng dung lượng dự án vượt 25 MB.');
  if (!seen.has('main.tex')) throw new BadRequestException('Dự án cần có main.tex.');
}

function validBinary(ext: string, data: Buffer): boolean {
  if (ext === '.png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === '.jpg' || ext === '.jpeg') return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (ext === '.pdf') return data.subarray(0, 5).toString('ascii') === '%PDF-';
  if (ext === '.eps') return data.subarray(0, 4).toString('ascii') === '%!PS';
  return false;
}
