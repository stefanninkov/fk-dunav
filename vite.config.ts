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
    rollupOptions: {
      output: {
        // Manual chunks pull heavy vendor deps out of the main bundle so
        // public-page visitors don't redownload everything whenever a UI
        // file changes, and so browsers can parallelize across chunks.
        //  - firebase-firestore: biggest single dep, used on every page
        //  - firebase-auth: admin-side only, but imported from AppRoot
        //  - firebase-storage: photo upload path (admin + anonymous)
        //  - react-vendor: react + react-dom + react-router
        //  - gsap: animation library, used by /uzivo + /lutrija
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) {
            return 'firebase-storage';
          }
          if (id.includes('@firebase/messaging') || id.includes('firebase/messaging')) {
            return 'firebase-messaging';
          }
          if (id.includes('@firebase/functions') || id.includes('firebase/functions')) {
            return 'firebase-functions';
          }
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
            return 'react-vendor';
          }
          if (id.includes('/gsap/')) {
            return 'gsap';
          }
          if (id.includes('/lucide-react/')) {
            return 'icons';
          }
          // react-hook-form + zod are admin-only — kept in a single chunk
          // loaded on demand with the admin pages that use them.
          if (id.includes('/react-hook-form/') || id.includes('/zod/')) {
            return 'forms';
          }
        },
      },
    },
  },
}));
