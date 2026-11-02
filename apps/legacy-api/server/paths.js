import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const serverRoot = path.dirname(fileURLToPath(import.meta.url));
export const apiRoot = path.resolve(serverRoot, '..');
export const repoRoot = path.resolve(apiRoot, '..', '..');
export const webDist = path.resolve(repoRoot, 'apps', 'legacy-web', 'dist');
export const databaseRoot = path.resolve(apiRoot, 'database');
