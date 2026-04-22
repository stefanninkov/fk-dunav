import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, Volume2, VolumeX } from 'lucide-react';

import logoUrl from '@/assets/logo.svg';
import { sr } from '@/i18n/sr';
import { useUIStore } from '@/stores/useUIStore';

/**
 * Header nav is a flat stream of links with two dropdown groups:
 *   - Rezultati: Grupe / Raspored / Rezultati / Nokaut / Timovi
 *   - Nagrade:   Nagrade / Lutrija / Kup Šanka / Prečka
 *
 * On desktop the groups open on hover (with a short delay for accidental
 * hovers) or on click; on mobile (when the hamburger is open) they render
 * as always-expanded sections so everything is reachable without an extra
 * tap.
 */

interface NavLeaf {
  to: string;
  label: string;
  accent?: boolean;
}

interface NavGroup {
  label: string;
  children: NavLeaf[];
}

type NavItem = NavLeaf | NavGroup;

const isGroup = (i: NavItem): i is NavGroup => 'children' in i;

const navItems: NavItem[] = [
  { to: '/uzivo', label: sr.nav.live, accent: true },
  {
    label: sr.nav.group.results,
    children: [
      { to: '/grupe', label: sr.nav.groups },
      { to: '/raspored', label: sr.nav.schedule },
      { to: '/rezultati', label: sr.nav.results },
      { to: '/nokaut', label: sr.nav.knockout },
      { to: '/timovi', label: sr.nav.teams },
    ],
  },
  {
    label: sr.nav.group.awards,
    children: [
      { to: '/nagrade', label: sr.nav.awards },
      { to: '/lutrija', label: sr.nav.lottery },
      { to: '/kup-sanka', label: sr.nav.kupSanka },
      { to: '/precka', label: sr.nav.crossbar },
    ],
  },
  { to: '/statistika', label: sr.nav.statistics },
  { to: '/galerija', label: sr.nav.gallery },
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
          {navItems.map((item, i) =>
            isGroup(item) ? (
              <DesktopGroup key={`g-${i}`} group={item} />
            ) : (
              <DesktopLeaf key={item.to} leaf={item} />
            ),
          )}
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
            {navItems.map((item, i) =>
              isGroup(item) ? (
                <MobileGroup
                  key={`g-${i}`}
                  group={item}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              ) : (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      [
                        'block rounded-md px-3 py-3 text-base font-500',
                        item.accent ? 'text-live' : 'text-ink-primary',
                        isActive ? 'bg-surface-2' : '',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Desktop

function DesktopLeaf({ leaf }: { leaf: NavLeaf }) {
  return (
    <NavLink
      to={leaf.to}
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-2 text-sm font-500 transition-colors',
          leaf.accent ? 'text-live' : 'text-ink-secondary hover:text-ink-primary',
          isActive && !leaf.accent ? 'bg-surface-2 text-ink-primary' : '',
          isActive && leaf.accent ? 'bg-live-soft' : '',
        ].join(' ')
      }
    >
      {leaf.label}
    </NavLink>
  );
}

function DesktopGroup({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const anyChildActive = group.children.some((c) => location.pathname === c.to);

  function openNow() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }
  function scheduleClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  // Auto-close when clicking outside or switching routes.
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-500 transition-colors',
          anyChildActive
            ? 'bg-surface-2 text-ink-primary'
            : 'text-ink-secondary hover:text-ink-primary',
        ].join(' ')}
      >
        {group.label}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1 min-w-[12rem] rounded-lg border border-surface-4 bg-surface-1 p-1 shadow-elevated">
          <ul className="flex flex-col">
            {group.children.map((child) => (
              <li key={child.to}>
                <NavLink
                  to={child.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [
                      'block rounded-md px-3 py-2 text-sm',
                      isActive
                        ? 'bg-surface-2 font-600 text-ink-primary'
                        : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary',
                    ].join(' ')
                  }
                >
                  {child.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile

function MobileGroup({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate: () => void;
}) {
  return (
    <li className="flex flex-col">
      <span className="mt-2 px-3 pb-1 text-xs uppercase tracking-[0.15em] text-ink-tertiary">
        {group.label}
      </span>
      <ul className="flex flex-col">
        {group.children.map((child) => (
          <li key={child.to}>
            <NavLink
              to={child.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'block rounded-md px-4 py-3 text-base font-500',
                  isActive ? 'bg-surface-2 text-ink-primary' : 'text-ink-primary',
                ].join(' ')
              }
            >
              {child.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </li>
  );
}
