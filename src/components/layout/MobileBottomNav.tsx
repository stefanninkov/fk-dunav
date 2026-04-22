import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Award,
  Home,
  Image as ImageIcon,
  ListOrdered,
  Menu,
  X,
} from 'lucide-react';

import { sr } from '@/i18n/sr';
import { awardsPaths, resultsPaths } from './publicNav';

/**
 * Fixed bottom tab bar shown on mobile only (hidden from lg:). Five
 * primary destinations; the "Više" tab opens a full-width sheet with the
 * remaining links.
 *
 * Uživo stays in the top navbar (always visible) per the product call —
 * live matches are a glance-value destination that shouldn't compete
 * with primary navigation for thumb real estate.
 */

const primary: {
  to: string;
  label: string;
  icon: typeof Home;
  // Highlight when ANY of these paths is active (for group tabs).
  matchPaths?: Set<string>;
}[] = [
  { to: '/', label: sr.nav.home, icon: Home },
  { to: '/grupe', label: sr.nav.group.results, icon: ListOrdered, matchPaths: resultsPaths },
  { to: '/nagrade', label: sr.nav.group.awards, icon: Award, matchPaths: awardsPaths },
  { to: '/galerija', label: sr.nav.gallery, icon: ImageIcon },
];

const moreLinks: { to: string; label: string }[] = [
  { to: '/statistika', label: sr.nav.statistics },
  { to: '/sponzori', label: sr.nav.sponsors },
  { to: '/pravilnik', label: sr.nav.rules },
  { to: '/o-turniru', label: sr.nav.about },
  { to: '/sampioni', label: sr.nav.champions },
];

export function MobileBottomNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  // Close the "more" sheet when the route changes.
  useEffect(() => setSheetOpen(false), [location.pathname]);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-4 bg-surface-1/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto grid max-w-[640px] grid-cols-5">
          {primary.map((item) => (
            <BottomTab key={item.to} {...item} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.65rem] font-500 text-ink-secondary transition-colors active:bg-surface-2 active:text-ink-primary"
            >
              <Menu size={20} />
              <span>{sr.nav.more ?? 'Više'}</span>
            </button>
          </li>
        </ul>
      </nav>

      {sheetOpen ? (
        <MoreSheet onClose={() => setSheetOpen(false)} />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

function BottomTab({
  to,
  label,
  icon: Icon,
  matchPaths,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  matchPaths?: Set<string>;
}) {
  const { pathname } = useLocation();
  const isActive = matchPaths ? matchPaths.has(pathname) : pathname === to;

  return (
    <li>
      <NavLink
        to={to}
        className={[
          'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.65rem] font-500 transition-colors active:bg-surface-2',
          isActive ? 'text-brand-400' : 'text-ink-secondary',
        ].join(' ')}
      >
        <Icon size={20} />
        <span className="truncate px-1">{label}</span>
      </NavLink>
    </li>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-surface-0/95 backdrop-blur lg:hidden"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex items-center justify-between border-b border-surface-4 px-4 py-3">
        <span className="font-display text-base font-600">{sr.nav.more ?? 'Više'}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zatvori"
          className="flex h-touch w-touch items-center justify-center rounded-md text-ink-secondary hover:bg-surface-2"
        >
          <X size={22} />
        </button>
      </header>
      <ul className="flex-1 overflow-y-auto p-2">
        {moreLinks.map((l) => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'block rounded-md px-4 py-4 text-base font-500',
                  isActive ? 'bg-surface-2 text-ink-primary' : 'text-ink-primary',
                ].join(' ')
              }
            >
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
