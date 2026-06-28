import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  // Sourcemap upload runs only in CI on a real production build, gated by
  // SENTRY_AUTH_TOKEN. Locally + in dev we skip — the plugin would emit a
  // warning otherwise. The release name is derived from the commit SHA so
  // each deploy maps cleanly to a Sentry release.
  const release =
    process.env.VITE_RELEASE ?? process.env.GITHUB_SHA?.slice(0, 7);
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  return {
    // GitHub Pages project page: https://stefanninkov.github.io/fk-dunav/.
    // Custom domain (Phase 9) will flip this back to '/' via env.
    base: isProd ? (process.env.VITE_BASE_PATH ?? '/fk-dunav/') : '/',
    plugins: [
      react(),
      tailwindcss(),
      // Must be the LAST plugin per Sentry docs so it sees the final build
      // output. No-ops without the token (warn but don't fail the build).
      sentryAuthToken && sentryOrg && sentryProject
        ? sentryVitePlugin({
            org: sentryOrg,
            project: sentryProject,
            authToken: sentryAuthToken,
            release: { name: release },
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/assets/*.js.map'],
            },
            telemetry: false,
          })
        : null,
    ].filter(Boolean) as ReturnType<typeof react>[],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    define: release
      ? {
          // Expose the release tag to runtime so initSentry can attach it
          // to every captured event.
          'import.meta.env.VITE_RELEASE': JSON.stringify(release),
        }
      : undefined,
    build: {
      sourcemap: true,
      target: 'es2022',
      rollupOptions: {
        output: {
          // Manual chunks pull heavy vendor deps out of the main bundle so
          // public-page visitors don't redownload everything whenever a UI
          // file changes, and so browsers can parallelize across chunks.
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
            if (id.includes('@firebase/app-check') || id.includes('firebase/app-check')) {
              return 'firebase-appcheck';
            }
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
              return 'react-vendor';
            }
            if (id.includes('/gsap/')) {
              return 'gsap';
            }
            if (id.includes('/@sentry/')) {
              return 'sentry';
            }
            if (id.includes('/lucide-react/')) {
              return 'icons';
            }
            // react-hook-form + zod are admin-only — kept in a single
            // chunk loaded on demand with the admin pages that use them.
            if (id.includes('/react-hook-form/') || id.includes('/zod/')) {
              return 'forms';
            }
          },
        },
      },
    },
  };
});
