import { NavLink, useLocation } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';

import logoUrl from '@/assets/logo.svg';
import { sr } from '@/i18n/sr';
import { useUIStore } from '@/stores/useUIStore';
import { awardsPaths, resultsPaths } from './publicNav';

/**
 * Desktop nav is a flat stream of tabs with two group parents
 * (Rezultati, Nagrade) whose children live in a sub-tab bar rendered
 * by PublicLayout on matching routes.
 *
 * On mobile the top bar stays deliberately slim: logo + a prominent
 * Uživo pill + sound toggle. All other destinations live in the fixed
 * MobileBottomNav so one-thumb reach is easy.
 */

type DesktopEntry =
  | { to: string; label: string; accent?: boolean; group?: undefined }
  | { to: string; label: string; group: 'results' | 'awards'; accent?: undefined };

const desktopNav: DesktopEntry[] = [
  { to: '/uzivo', label: sr.nav.live, accent: true },
  { to: '/grupe', label: sr.nav.group.results, group: 'results' },
  { to: '/nagrade', label: sr.nav.group.awards, group: 'awards' },
  { to: '/statistika', label: sr.nav.statistics },
  { to: '/galerija', label: sr.nav.gallery },
  { to: '/sponzori', label: sr.nav.sponsors },
];

function useGroupActive(group: 'results' | 'awards' | undefined): boolean {
  const { pathname } = useLocation();
  if (!group) return false;
  const set = group === 'results' ? resultsPaths : awardsPaths;
  return set.has(pathname);
}

export function Header() {
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const toggleSound = useUIStore((s) => s.toggleSound);

  return (
    <header className="sticky top-0 z-30 border-b border-surface-4 bg-surface-0/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-page-x py-3 lg:px-page-x-lg">
        <NavLink to="/" className="flex items-center gap-3">
          <img src={logoUrl} alt={sr.brand.name} className="h-10 w-10" />
          <div className="hidden flex-col sm:flex">
            <span className="font-display text-base font-700 leading-tight">
              {sr.brand.name}
            </span>
            <span className="text-xs text-ink-secondary">{sr.brand.tournament}</span>
          </div>
        </NavLink>

        {/* Desktop nav — hidden below lg */}
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {desktopNav.map((link) => (
            <DesktopLink key={link.to} link={link} />
          ))}
        </nav>

        {/* Mobile-only Uživo pill, always visible in top bar */}
        <NavLink
          to="/uzivo"
          className={({ isActive }) =>
            [
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-700 lg:hidden',
              'bg-live-soft text-live transition-colors active:opacity-80',
              isActive ? 'ring-2 ring-live' : '',
            ].join(' ')
          }
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-live"
          />
          {sr.nav.live}
        </NavLink>

        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Isključi zvuk' : 'Uključi zvuk'}
          className="flex h-touch w-touch items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary lg:ml-2"
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------

function DesktopLink({ link }: { link: DesktopEntry }) {
  const groupActive = useGroupActive(link.group);
  return (
    <NavLink
      to={link.to}
      className={({ isActive }) => {
        const active = groupActive || isActive;
        return [
          'rounded-md px-3 py-2 text-sm font-500 transition-colors',
          link.accent ? 'text-live' : 'text-ink-secondary hover:text-ink-primary',
          active && !link.accent ? 'bg-surface-2 text-ink-primary' : '',
          active && link.accent ? 'bg-live-soft' : '',
        ].join(' ');
      }}
    >
      {link.label}
    </NavLink>
  );
}
