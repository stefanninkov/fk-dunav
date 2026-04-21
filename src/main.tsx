import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import './styles/index.css';
import { router } from './app/router';
import { initSentry, SentryErrorBoundary } from './lib/sentry';
import { CrashFallback } from './components/ui/CrashFallback';

initSentry();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <SentryErrorBoundary fallback={<CrashFallback />}>
      <RouterProvider router={router} />
    </SentryErrorBoundary>
  </StrictMode>,
);
