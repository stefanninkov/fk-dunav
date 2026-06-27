import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BadgeDollarSign,
  Beer,
  CalendarDays,
  FileText,
  HelpCircle,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Target,
  Ticket,
  Trophy,
  UserCog,
  Users,
  Vote,
  X,
} from 'lucide-react';

import logoUrl from '@/assets/logo.svg';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { sr } from '@/i18n/sr';
import type { Capability } from '@/lib/firestore/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { OfflineBadge } from '@/components/ui/OfflineBadge';

/**
 * Nav items with an optional `cap` — the sidebar hides any item whose cap
 * the current user doesn't hold. Items with no cap are admin-only; items
 * marked `always: true` show up for every signed-in user (dashboard only).
 */
interface NavItemDef {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  cap?: Capability;
  always?: boolean;
}

const allNavItems: NavItemDef[] = [
  { to: '/admin', label: sr.admin.nav.dashboard, icon: LayoutDashboard, end: true, always: true },
  { to: '/admin/pomoc', label: 'Pomoć', icon: HelpCircle, always: true },
  { to: '/admin/utakmice', label: sr.admin.nav.matches, icon: ListOrdered, cap: 'matches' },
  { to: '/admin/raspored', label: sr.admin.nav.schedule, icon: CalendarDays, cap: 'matches' },
  { to: '/admin/bracket', label: sr.admin.nav.bracket, icon: Trophy, cap: 'matches' },
  { to: '/admin/timovi', label: sr.admin.nav.teams, icon: Users, cap: 'teams' },
  { to: '/admin/galerija', label: sr.admin.nav.gallery, icon: ImageIcon, cap: 'photos' },
  { to: '/admin/obavestenja', label: sr.admin.nav.announcements, icon: Megaphone, cap: 'content' },
  { to: '/admin/sponzori', label: sr.admin.nav.sponsors, icon: BadgeDollarSign, cap: 'content' },
  { to: '/admin/sadrzaj', label: 'Sadržaj', icon: FileText, cap: 'content' },
  { to: '/admin/glasanje', label: sr.admin.nav.voting, icon: Vote, cap: 'content' },
  { to: '/admin/kup-sanka', label: sr.admin.nav.kupSanka, icon: Beer, cap: 'side_events' },
  { to: '/admin/precka', label: sr.admin.nav.crossbar, icon: Target, cap: 'side_events' },
  { to: '/admin/nagrade', label: sr.admin.nav.awards, icon: Award, cap: 'side_events' },
  { to: '/admin/lutrija', label: sr.nav.lottery, icon: Ticket, cap: 'side_events' },
  { to: '/admin/turnir', label: sr.admin.nav.tournament, icon: Settings },
  { to: '/admin/korisnici', label: sr.admin.nav.users, icon: UserCog },
  { to: '/admin/sampioni', label: sr.admin.nav.champions, icon: History },
];

function visibleNavItems(role: 'admin' | 'staff' | null, caps: Capability[]): NavItemDef[] {
  if (role === 'admin') return allNavItems;
  if (role !== 'staff') return allNavItems.filter((i) => i.always);
  const capSet = new Set(caps);
  return allNavItems.filter((i) => i.always || (i.cap && capSet.has(i.cap)));
}

export function AdminLayout() {
  const navigate = useNavigate();
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const caps = useAuthStore((s) => s.caps);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const navItems = visibleNavItems(role, caps);

  // Close the drawer on route change.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/admin/login', { replace: true });
  }

  const activeLabel =
    navItems.find((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to),
    )?.label ?? 'Admin';

  return (
    <div className="flex min-h-screen flex-col bg-surface-0 text-ink-primary lg:flex-row">
      <OfflineBadge />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-surface-4 bg-surface-0/95 px-3 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Meni"
          className="flex h-touch w-touch items-center justify-center rounded-md text-ink-primary hover:bg-surface-2"
        >
          <Menu size={22} />
        </button>
        <img src={logoUrl} alt={sr.brand.name} className="h-8 w-8" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-sm font-600 leading-tight">
            {activeLabel}
          </span>
          <span className="text-[0.7rem] text-ink-tertiary">Admin</span>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Zatvori meni"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside
            className="relative z-50 flex h-full w-[18rem] max-w-[85%] flex-col border-r border-surface-4 bg-surface-1 shadow-elevated"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center gap-3 border-b border-surface-4 px-4 py-4">
              <img src={logoUrl} alt={sr.brand.name} className="h-10 w-10" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-sm font-600 leading-tight">
                  {sr.brand.name}
                </span>
                <span className="text-xs text-ink-tertiary">Admin</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Zatvori"
                className="flex h-touch w-touch items-center justify-center rounded-md text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <ul className="flex flex-col gap-0.5">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        [
                          'flex min-h-touch items-center gap-3 rounded-md px-3 py-3 text-sm font-500',
                          isActive
                            ? 'bg-brand-900 text-ink-primary'
                            : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary',
                        ].join(' ')
                      }
                    >
                      <Icon size={18} />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-surface-4 px-4 py-3">
              <div className="mb-2 truncate text-xs text-ink-tertiary">
                {email} · {role ?? '—'}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
              >
                <LogOut size={16} />
                {sr.admin.logout}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-4 bg-surface-1 lg:flex">
        <div className="flex items-center gap-3 border-b border-surface-4 px-4 py-4">
          <img src={logoUrl} alt={sr.brand.name} className="h-10 w-10" />
          <div className="flex flex-col">
            <span className="font-display text-sm font-600 leading-tight">{sr.brand.name}</span>
            <span className="text-xs text-ink-tertiary">Admin</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-500',
                      isActive
                        ? 'bg-brand-900 text-ink-primary'
                        : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary',
                    ].join(' ')
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-surface-4 px-4 py-3">
          <div className="mb-2 text-xs text-ink-tertiary">
            {email} · {role ?? '—'}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
          >
            <LogOut size={16} />
            {sr.admin.logout}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1440px] px-page-x py-4 lg:px-page-x-lg lg:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
