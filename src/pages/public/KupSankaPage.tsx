import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Beer } from 'lucide-react';

import { kupSankaCol } from '@/lib/firestore/refs';
import type { KupSankaEntry } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

/**
 * Public live Kup Šanka leaderboard. Reads the same free-form entries the
 * admin manages at /admin/kup-sanka and renders them ordered by bokala desc.
 * Updates in real time over onSnapshot.
 */
export function KupSankaPage() {
  const active = useTournamentStore((s) => s.active);
  const [entries, setEntries] = useState<KupSankaEntry[]>([]);

  useEffect(() => {
    if (!active) return;
    return onSnapshot(kupSankaCol(active.id), (snap) =>
      setEntries(
        snap.docs
          .map((d) => d.data())
          .sort((a, b) => b.bokala - a.bokala || a.name.localeCompare(b.name, 'sr')),
      ),
    );
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.kupSanka} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[900px] px-page-x py-10 lg:px-page-x-lg">
      <header>
        <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.kupSanka}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Uživo praćenje — ko vodi u ispijenim bokalima.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="mt-10 rounded-md bg-surface-1 px-4 py-10 text-center text-sm text-ink-tertiary">
          {sr.admin.kupSanka.empty}
        </p>
      ) : (
        <ol className="mt-10 flex flex-col gap-2">
          {entries.map((e, idx) => {
            const medalBg =
              idx === 0
                ? 'var(--color-accent-gold)'
                : idx === 1
                  ? 'var(--color-accent-silver)'
                  : idx === 2
                    ? 'var(--color-accent-bronze)'
                    : 'var(--color-brand-600)';
            return (
              <li
                key={e.id}
                className="flex items-center gap-4 rounded-lg bg-surface-1 px-4 py-4 shadow-card"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display font-700"
                  style={{ backgroundColor: medalBg, color: 'var(--color-ink-inverse)' }}
                >
                  {idx + 1}
                </span>
                <div className="flex min-w-[8rem] flex-1 flex-col">
                  <span className="font-display text-lg font-600 text-ink-primary">
                    {e.name}
                  </span>
                  {e.note ? (
                    <span className="text-xs text-ink-tertiary">{e.note}</span>
                  ) : null}
                </div>
                <Beer size={20} className="text-ink-tertiary" />
                <span className="tnum font-display text-2xl font-700 text-ink-primary">
                  {e.bokala}
                </span>
                <span className="text-xs text-ink-tertiary">{sr.admin.kupSanka.bokala}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
