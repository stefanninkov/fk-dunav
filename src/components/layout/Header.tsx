import { NavLink } from 'react-router-dom';
import { Volume2, VolumeX, Menu } from 'lucide-react';

import logoUrl from '@/assets/logo.svg';
import { sr } from '@/i18n/sr';
import { useUIStore } from '@/stores/useUIStore';

const navLinks = [
  { to: '/uzivo', label: sr.nav.live, accent: true },
  { to: '/grupe', label: sr.nav.groups },
  { to: '/raspored', label: sr.nav.schedule },
  { to: '/rezultati', label: sr.nav.results },
  { to: '/nokaut', label: sr.nav.knockout },
  { to: '/statistika', label: sr.nav.statistics },
  { to: '/nagrade', label: sr.nav.awards },
  { to: '/galerija', label: sr.nav.gallery },
  { to: '/timovi', label: sr.nav.teams },
  { to: '/sponzori', label: sr.nav.sponsors },
];

export function Header() {
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const toggleSound = useUIStore((s) => s.toggleSound);
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);

  return (
    <header className="sticky top-0 z-30 border-b border-surface-4 bg-surface-0/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-page-x py-3 lg:px-page-x-lg">
        <NavLink to="/" className="flex items-center gap-3">
          <img src={logoUrl} alt={sr.brand.name} className="h-10 w-10" />
          <div className="hidden flex-col sm:flex">
            <span className="font-display text-base font-700 leading-tight">{sr.brand.name}</span>
            <span className="text-xs text-ink-secondary">{sr.brand.tournament}</span>
          </div>
        </NavLink>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-2 text-sm font-500 transition-colors',
                  link.accent ? 'text-live' : 'text-ink-secondary hover:text-ink-primary',
                  isActive && !link.accent ? 'bg-surface-2 text-ink-primary' : '',
                  isActive && link.accent ? 'bg-live-soft' : '',
                ].join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Isključi zvuk' : 'Uključi zvuk'}
          className="ml-auto flex h-touch w-touch items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary lg:ml-2"
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          aria-label="Meni"
          className="flex h-touch w-touch items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary lg:hidden"
        >
          <Menu size={22} />
        </button>
      </div>

      {mobileNavOpen ? (
        <nav className="border-t border-surface-4 bg-surface-1 lg:hidden">
          <ul className="mx-auto flex max-w-[1200px] flex-col px-page-x py-2">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    [
                      'block rounded-md px-3 py-3 text-base font-500',
                      link.accent ? 'text-live' : 'text-ink-primary',
                      isActive ? 'bg-surface-2' : '',
                    ].join(' ')
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
