import * as Sentry from '@sentry/react';

/**
 * Sentry client-side error monitoring. Initialized once at app bootstrap
 * before the React root mounts. DSN is wired via VITE_SENTRY_DSN — if it's
 * empty (dev, local), the SDK short-circuits and never sends events.
 *
 * Tracing + Replay are off: we only care about unhandled errors. If you
 * want them later, add `Sentry.browserTracingIntegration()` and
 * `Sentry.replayIntegration()`.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? 'production' : 'development',
    release: import.meta.env.VITE_RELEASE ?? undefined,
    // Sample 100% of errors — volume is low enough that we'd rather miss
    // nothing. If quota becomes a concern, drop to 0.5 or use dynamic
    // sampling.
    sampleRate: 1.0,
    // Tracing disabled for now (see file header).
    tracesSampleRate: 0,
    // Ignore errors we don't own or care about.
    ignoreErrors: [
      // Offline-driven Firestore errors: expected; we show an in-app
      // offline banner and the write will replay on reconnect.
      'Failed to get document because the client is offline',
      // ResizeObserver loop warnings are benign and spammy.
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',
    ],
  });
}

/**
 * Error boundary for React render errors. Wrap the router in this so a
 * component crash doesn't white-screen the whole app — Sentry captures
 * the error and the user sees a simple retry card.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

export { Sentry };
