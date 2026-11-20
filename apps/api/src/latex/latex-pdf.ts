import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { NotFoundException, StreamableFile } from '@nestjs/common';
import { LatexBuildEntity, LatexBuildStatus } from '../database/entities/latex-build.entity';
import { latexStorageRoot } from './build-config';

export async function compiledPdfPath(build: LatexBuildEntity): Promise<string> {
  if (build.status !== LatexBuildStatus.Success || !build.pdfPath) {
    throw new NotFoundException('Chưa có PDF cho bản biên dịch này.');
  }
  const root = latexStorageRoot();
  const absolute = path.resolve(root, build.pdfPath);
  if (!absolute.startsWith(root + path.sep)) throw new NotFoundException('Đường dẫn PDF không hợp lệ.');
  try {
    const file = await stat(absolute);
    if (!file.isFile()) throw new Error('Not a file');
  } catch { throw new NotFoundException('Không tìm thấy PDF trên ổ lưu trữ.'); }
  return absolute;
}

export async function streamCompiledPdf(build: LatexBuildEntity): Promise<StreamableFile> {
  const absolute = await compiledPdfPath(build);
  return new StreamableFile(createReadStream(absolute), {
    type: 'application/pdf',
    disposition: `inline; filename="latex-${build.id}.pdf"`,
  });
}
