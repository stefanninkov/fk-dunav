// This file intentionally exports `router` (a non-component) alongside
// small Suspense-fallback helpers. Fast refresh doesn't matter here.
/* eslint-disable react-refresh/only-export-components */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppRoot } from './AppRoot';
import { PublicLayout } from '@/components/layout/PublicLayout';

import { HomePage } from '@/pages/public/HomePage';
import { KupSankaPage as PublicKupSankaPage } from '@/pages/public/KupSankaPage';
import { CrossbarPublicPage } from '@/pages/public/CrossbarPage';
import { GroupsPage } from '@/pages/public/GroupsPage';
import { SchedulePage } from '@/pages/public/SchedulePage';
import { ResultsPage } from '@/pages/public/ResultsPage';
import { LivePage } from '@/pages/public/LivePage';
import { KnockoutPage } from '@/pages/public/KnockoutPage';
import { StatisticsPage } from '@/pages/public/StatisticsPage';
import { GalleryPage } from '@/pages/public/GalleryPage';
import { TeamsPage } from '@/pages/public/TeamsPage';
import { TeamDetailPage } from '@/pages/public/TeamDetailPage';
import { PlayerDetailPage } from '@/pages/public/PlayerDetailPage';
import { SponsorsPage } from '@/pages/public/SponsorsPage';
import { RulesPage } from '@/pages/public/RulesPage';
import { AboutPage } from '@/pages/public/AboutPage';
import { ChampionsPage } from '@/pages/public/ChampionsPage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';
import { MatchDetailPage } from '@/pages/public/MatchDetailPage';
import { PublicAwardsPage } from '@/pages/public/PublicAwardsPage';
import { LotteryLivePage } from '@/pages/public/LotteryLivePage';

import { AuthGuard } from '@/components/guards/AuthGuard';
import { CapabilityGuard } from '@/components/guards/CapabilityGuard';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';
import type { Capability } from '@/lib/firestore/types';

/**
 * Admin routes are lazy-loaded so the public bundle doesn't ship React Hook
 * Form, the admin-only dialogs, or the match editor. Each admin page is its
 * own chunk; the AdminLayout chunk pulls in the sidebar nav shared by all of
 * them. A visitor who never opens /admin/* downloads none of this.
 */
const AdminLayout = lazy(() =>
  import('@/components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const LoginPage = lazy(() =>
  import('@/pages/admin/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const AdminHomePage = lazy(() =>
  import('@/pages/admin/AdminHomePage').then((m) => ({ default: m.AdminHomePage })),
);
const TournamentPage = lazy(() =>
  import('@/pages/admin/TournamentPage').then((m) => ({ default: m.TournamentPage })),
);
const AdminTeamsPage = lazy(() =>
  import('@/pages/admin/TeamsPage').then((m) => ({ default: m.TeamsPage })),
);
const AdminSchedulePage = lazy(() =>
  import('@/pages/admin/SchedulePage').then((m) => ({ default: m.SchedulePage })),
);
const AdminMatchesPage = lazy(() =>
  import('@/pages/admin/AdminMatchesPage').then((m) => ({ default: m.AdminMatchesPage })),
);
const AdminMatchEditorPage = lazy(() =>
  import('@/pages/admin/AdminMatchEditorPage').then((m) => ({
    default: m.AdminMatchEditorPage,
  })),
);
const AdminBracketPage = lazy(() =>
  import('@/pages/admin/BracketPage').then((m) => ({ default: m.BracketPage })),
);
const AdminAwardsPage = lazy(() =>
  import('@/pages/admin/AwardsPage').then((m) => ({ default: m.AwardsPage })),
);
const AdminAnnouncementsPage = lazy(() =>
  import('@/pages/admin/AnnouncementsPage').then((m) => ({
    default: m.AnnouncementsPage,
  })),
);
const AdminSponsorsPage = lazy(() =>
  import('@/pages/admin/SponsorsPage').then((m) => ({ default: m.SponsorsPage })),
);
const AdminKupSankaPage = lazy(() =>
  import('@/pages/admin/KupSankaPage').then((m) => ({ default: m.KupSankaPage })),
);
const AdminCrossbarPage = lazy(() =>
  import('@/pages/admin/CrossbarPage').then((m) => ({ default: m.CrossbarPage })),
);
const ContentAdminPage = lazy(() =>
  import('@/pages/admin/ContentPage').then((m) => ({ default: m.ContentAdminPage })),
);
const AdminGalleryPage = lazy(() =>
  import('@/pages/admin/AdminGalleryPage').then((m) => ({ default: m.AdminGalleryPage })),
);
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const AdminVotingPage = lazy(() =>
  import('@/pages/admin/VotingPage').then((m) => ({ default: m.VotingPage })),
);
const AdminChampionsPage = lazy(() =>
  import('@/pages/admin/ChampionsPage').then((m) => ({ default: m.ChampionsPage })),
);
const AdminLotteryPage = lazy(() =>
  import('@/pages/admin/LotteryPage').then((m) => ({ default: m.LotteryPage })),
);
const AdminHelpPage = lazy(() =>
  import('@/pages/admin/HelpPage').then((m) => ({ default: m.HelpPage })),
);

function AdminFallback() {
  return <PagePlaceholder title={sr.admin.nav.dashboard} description={sr.common.loading} />;
}

function lazyRoute(node: React.ReactNode) {
  return <Suspense fallback={<AdminFallback />}>{node}</Suspense>;
}

/**
 * Wrap a lazy admin page with a capability gate. `cap=undefined` means the
 * route is admin-only (staff users get redirected back to /admin).
 */
function capRoute(node: React.ReactNode, cap?: Capability) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <CapabilityGuard cap={cap}>{node}</CapabilityGuard>
    </Suspense>
  );
}

/**
 * BASE_URL is the Vite build-time base path ('/fk-dunav/' on GitHub Pages
 * project page, '/' in dev or on a custom domain). React Router needs this
 * as basename so it strips the prefix when matching routes.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export const router = createBrowserRouter(
  [
    {
      element: <AppRoot />,
      children: [
        {
          element: <PublicLayout />,
          children: [
            { path: '/', element: <HomePage /> },
            { path: '/grupe', element: <GroupsPage /> },
            { path: '/raspored', element: <SchedulePage /> },
            { path: '/rezultati', element: <ResultsPage /> },
            { path: '/uzivo', element: <LivePage /> },
            { path: '/nokaut', element: <KnockoutPage /> },
            { path: '/statistika', element: <StatisticsPage /> },
            { path: '/galerija', element: <GalleryPage /> },
            { path: '/timovi', element: <TeamsPage /> },
            { path: '/tim/:teamId', element: <TeamDetailPage /> },
            { path: '/igrac/:playerId', element: <PlayerDetailPage /> },
            { path: '/utakmica/:matchId', element: <MatchDetailPage /> },
            { path: '/nagrade', element: <PublicAwardsPage /> },
            { path: '/lutrija', element: <LotteryLivePage /> },
            { path: '/kup-sanka', element: <PublicKupSankaPage /> },
            { path: '/precka', element: <CrossbarPublicPage /> },
            { path: '/sponzori', element: <SponsorsPage /> },
            { path: '/pravilnik', element: <RulesPage /> },
            { path: '/o-turniru', element: <AboutPage /> },
            { path: '/sampioni', element: <ChampionsPage /> },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
        {
          path: '/admin/login',
          element: lazyRoute(<LoginPage />),
        },
        {
          path: '/admin',
          element: lazyRoute(
            <AuthGuard>
              <AdminLayout />
            </AuthGuard>,
          ),
          children: [
            { index: true, element: lazyRoute(<AdminHomePage />) },
            { path: 'turnir', element: capRoute(<TournamentPage />) },
            { path: 'timovi', element: capRoute(<AdminTeamsPage />, 'teams') },
            { path: 'raspored', element: capRoute(<AdminSchedulePage />, 'matches') },
            { path: 'utakmice', element: capRoute(<AdminMatchesPage />, 'matches') },
            { path: 'utakmice/:matchId', element: capRoute(<AdminMatchEditorPage />, 'matches') },
            { path: 'bracket', element: capRoute(<AdminBracketPage />, 'matches') },
            { path: 'nagrade', element: capRoute(<AdminAwardsPage />, 'side_events') },
            { path: 'obavestenja', element: capRoute(<AdminAnnouncementsPage />, 'content') },
            { path: 'sponzori', element: capRoute(<AdminSponsorsPage />, 'content') },
            { path: 'kup-sanka', element: capRoute(<AdminKupSankaPage />, 'side_events') },
            { path: 'precka', element: capRoute(<AdminCrossbarPage />, 'side_events') },
            { path: 'sadrzaj', element: capRoute(<ContentAdminPage />, 'content') },
            { path: 'galerija', element: capRoute(<AdminGalleryPage />, 'photos') },
            { path: 'korisnici', element: capRoute(<AdminUsersPage />) },
            { path: 'glasanje', element: capRoute(<AdminVotingPage />, 'content') },
            { path: 'sampioni', element: capRoute(<AdminChampionsPage />) },
            { path: 'lutrija', element: capRoute(<AdminLotteryPage />, 'side_events') },
            { path: 'pomoc', element: lazyRoute(<AdminHelpPage />) },
            { path: '*', element: <Navigate to="/admin" replace /> },
          ],
        },
      ],
    },
  ],
  { basename },
);
