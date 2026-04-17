import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppRoot } from './AppRoot';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';

import { HomePage } from '@/pages/public/HomePage';
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

import { LoginPage } from '@/pages/admin/LoginPage';
import { AdminHomePage } from '@/pages/admin/AdminHomePage';
import { TournamentPage } from '@/pages/admin/TournamentPage';
import { TeamsPage as AdminTeamsPage } from '@/pages/admin/TeamsPage';
import { PlayersPage as AdminPlayersPage } from '@/pages/admin/PlayersPage';
import { SchedulePage as AdminSchedulePage } from '@/pages/admin/SchedulePage';
import { AdminMatchesPage } from '@/pages/admin/AdminMatchesPage';
import { AdminMatchEditorPage } from '@/pages/admin/AdminMatchEditorPage';
import { BracketPage as AdminBracketPage } from '@/pages/admin/BracketPage';
import { AwardsPage as AdminAwardsPage } from '@/pages/admin/AwardsPage';
import { AnnouncementsPage as AdminAnnouncementsPage } from '@/pages/admin/AnnouncementsPage';
import { SponsorsPage as AdminSponsorsPage } from '@/pages/admin/SponsorsPage';
import { KupSankaPage as AdminKupSankaPage } from '@/pages/admin/KupSankaPage';
import { CrossbarPage as AdminCrossbarPage } from '@/pages/admin/CrossbarPage';
import { ContentAdminPage } from '@/pages/admin/ContentPage';
import { AdminGalleryPage } from '@/pages/admin/AdminGalleryPage';
import { UsersPage as AdminUsersPage } from '@/pages/admin/UsersPage';
import { VotingPage as AdminVotingPage } from '@/pages/admin/VotingPage';
import { MatchDetailPage } from '@/pages/public/MatchDetailPage';
import { Archive2025Page } from '@/pages/public/Archive2025Page';

import { AuthGuard } from '@/components/guards/AuthGuard';

/**
 * BASE_URL is the Vite build-time base path ('/fk-dunav/' on GitHub Pages
 * project page, '/' in dev or on a custom domain). React Router needs this
 * as basename so it strips the prefix when matching routes.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export const router = createBrowserRouter([
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
          { path: '/2025', element: <Archive2025Page /> },
          { path: '/sponzori', element: <SponsorsPage /> },
          { path: '/pravilnik', element: <RulesPage /> },
          { path: '/o-turniru', element: <AboutPage /> },
          { path: '/sampioni', element: <ChampionsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: '/admin/login',
        element: <LoginPage />,
      },
      {
        path: '/admin',
        element: (
          <AuthGuard>
            <AdminLayout />
          </AuthGuard>
        ),
        children: [
          { index: true, element: <AdminHomePage /> },
          { path: 'turnir', element: <TournamentPage /> },
          { path: 'timovi', element: <AdminTeamsPage /> },
          { path: 'igraci', element: <AdminPlayersPage /> },
          { path: 'raspored', element: <AdminSchedulePage /> },
          { path: 'utakmice', element: <AdminMatchesPage /> },
          { path: 'utakmice/:matchId', element: <AdminMatchEditorPage /> },
          { path: 'bracket', element: <AdminBracketPage /> },
          { path: 'nagrade', element: <AdminAwardsPage /> },
          { path: 'obavestenja', element: <AdminAnnouncementsPage /> },
          { path: 'sponzori', element: <AdminSponsorsPage /> },
          { path: 'kup-sanka', element: <AdminKupSankaPage /> },
          { path: 'precka', element: <AdminCrossbarPage /> },
          { path: 'sadrzaj', element: <ContentAdminPage /> },
          { path: 'galerija', element: <AdminGalleryPage /> },
          { path: 'korisnici', element: <AdminUsersPage /> },
          { path: 'glasanje', element: <AdminVotingPage /> },
          // TODO(later phases): utakmice editor, galerija, obavestenja,
          // sponzori, kup-sanka, precka, nagrade, korisnici, glasanje,
          // sampioni.
          { path: '*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },
], { basename });
