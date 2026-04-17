import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  // GitHub Pages project page: https://stefanninkov.github.io/fk-dunav/.
  // Custom domain (Phase 9) will flip this back to '/' via env.
  base: mode === 'production' ? (process.env.VITE_BASE_PATH ?? '/fk-dunav/') : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
}));
