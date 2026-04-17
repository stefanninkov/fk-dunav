import { NavLink } from 'react-router-dom';

import { sr } from '@/i18n/sr';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-4 bg-surface-1">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-page-x py-8 sm:flex-row sm:items-center sm:justify-between lg:px-page-x-lg">
        <div className="flex items-center gap-3">
          <img src="/assets/logo.svg" alt={sr.brand.name} className="h-10 w-10" />
          <div className="flex flex-col">
            <span className="font-display text-sm font-600">{sr.brand.name}</span>
            <span className="text-xs text-ink-tertiary">© {year}</span>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-secondary">
          <NavLink to="/o-turniru" className="hover:text-ink-primary">
            {sr.nav.about}
          </NavLink>
          <NavLink to="/pravilnik" className="hover:text-ink-primary">
            {sr.nav.rules}
          </NavLink>
          <NavLink to="/sampioni" className="hover:text-ink-primary">
            {sr.nav.champions}
          </NavLink>
          <NavLink to="/sponzori" className="hover:text-ink-primary">
            {sr.nav.sponsors}
          </NavLink>
        </nav>
      </div>
    </footer>
  );
}
