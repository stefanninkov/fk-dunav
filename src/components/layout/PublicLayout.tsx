import { Outlet, useLocation } from 'react-router-dom';

import { Header } from './Header';
import { Footer } from './Footer';
import { SubTabs } from './SubTabs';
import { MobileBottomNav } from './MobileBottomNav';
import {
  awardsPaths,
  awardsSubTabs,
  resultsPaths,
  resultsSubTabs,
} from './publicNav';
import { OfflineBadge } from '@/components/ui/OfflineBadge';
import { AnnouncementBanner } from '@/features/announcements/components/AnnouncementBanner';

/**
 * Public shell. Two grouped sections render a sub-tab bar beneath the
 * main header — the "tabs inside the tab" pattern so a visitor on
 * /grupe sees Grupe/Raspored/Rezultati/Nokaut/Timovi and /nagrade sees
 * Nagrade/Lutrija/Kup Šanka/Prečka without returning to the header.
 *
 * On mobile a fixed bottom tab bar handles primary navigation; the main
 * region gets bottom padding so content never hides behind it.
 */
export function PublicLayout() {
  const { pathname } = useLocation();
  const subTabs = resultsPaths.has(pathname)
    ? resultsSubTabs
    : awardsPaths.has(pathname)
      ? awardsSubTabs
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface-0 text-ink-primary">
      <OfflineBadge />
      <AnnouncementBanner />
      <Header />
      {subTabs ? <SubTabs items={subTabs} /> : null}
      <main
        className="flex-1 pb-20 lg:pb-0"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
