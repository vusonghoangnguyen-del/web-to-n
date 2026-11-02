import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    open: true,
    port: 5173,
    proxy: {
      '/api/v1': 'http://127.0.0.1:3001',
      '/api': 'http://127.0.0.1:3000',
    },
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        problem: resolve(import.meta.dirname, 'problem.html'),
        checkEmail: resolve(import.meta.dirname, 'check-email.html'),
        verifyEmail: resolve(import.meta.dirname, 'verify-email.html'),
      },
    },
  },
});
