import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { X } from 'lucide-react';

import { announcementsCol } from '@/lib/firestore/refs';
import type { Announcement } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';

const DISMISS_STORAGE_PREFIX = 'fk-dunav:announcement-dismissed:';

/**
 * Public-site sticky banner that surfaces the single latest non-expired
 * announcement. Users can dismiss it, in which case the id is remembered
 * in localStorage so it doesn't reappear until a new one is published.
 */
export function AnnouncementBanner() {
  const active = useTournamentStore((s) => s.active);
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(announcementsCol(active.id), orderBy('publishedAt', 'desc')),
      (snap) => setItems(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  useEffect(() => {
    try {
      const raw = Object.keys(window.localStorage)
        .filter((k) => k.startsWith(DISMISS_STORAGE_PREFIX))
        .map((k) => k.slice(DISMISS_STORAGE_PREFIX.length));
      setDismissed(raw);
    } catch {
      // noop — private mode / Safari sometimes blocks.
    }
  }, []);

  const now = Date.now();
  const pick = items.find((a) => {
    if (dismissed.includes(a.id)) return false;
    if (a.expiresAt && a.expiresAt.toMillis() < now) return false;
    return true;
  });

  if (!pick) return null;

  function dismiss() {
    if (!pick) return;
    try {
      window.localStorage.setItem(`${DISMISS_STORAGE_PREFIX}${pick.id}`, '1');
    } catch {
      /* noop */
    }
    setDismissed((list) => [...list, pick.id]);
  }

  const cls =
    pick.severity === 'urgent'
      ? 'bg-danger-soft text-danger'
      : pick.severity === 'warning'
        ? 'bg-warning-soft text-warning'
        : 'bg-brand-900 text-ink-primary';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 px-page-x py-2 text-sm lg:px-page-x-lg ${cls}`}
    >
      <span
        className="rounded-full bg-surface-0/30 px-2 py-0.5 text-xs font-600 uppercase tracking-wide"
        aria-hidden
      >
        {sr.admin.announcements.severity[pick.severity]}
      </span>
      <div className="flex-1">
        <span className="font-600">{pick.title}</span>
        <span className="ml-2 opacity-90">{pick.body}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={sr.common.close}
        className="rounded-md p-1 hover:bg-surface-0/20"
      >
        <X size={16} />
      </button>
    </div>
  );
}
