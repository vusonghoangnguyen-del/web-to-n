import path from 'node:path';

export const latexQueueName = 'latex-builds';
export const latexRedisUrl = () => process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const latexImage = () => process.env.LATEX_IMAGE || 'texlive/texlive:latest';
export const latexStorageRoot = () => path.resolve(process.env.LATEX_STORAGE_DIR || path.resolve(__dirname, '../../../../storage/latex-builds'));
export const latexTimeoutMs = 30_000;
export const latexLuaTimeoutMs = 90_000;
export const latexMaxPdfBytes = 20 * 1024 * 1024;
export const latexMaxLogChars = 500_000;
