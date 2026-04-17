import { Outlet } from 'react-router-dom';

import { Header } from './Header';
import { Footer } from './Footer';
import { OfflineBadge } from '@/components/ui/OfflineBadge';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-0 text-ink-primary">
      <OfflineBadge />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
