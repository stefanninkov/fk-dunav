import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Target } from 'lucide-react';

import { crossbarCol } from '@/lib/firestore/refs';
import type { CrossbarParticipant } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

/**
 * Public Prečka (crossbar competition) page. Shows all participants
 * ordered by finalRank (when set) then by qualifyingScore desc, so the
 * leaderboard reads top-to-bottom during and after the event.
 */
export function CrossbarPublicPage() {
  const active = useTournamentStore((s) => s.active);
  const [participants, setParticipants] = useState<CrossbarParticipant[]>([]);

  useEffect(() => {
    if (!active) return;
    return onSnapshot(
      query(crossbarCol(active.id), orderBy('finalRank', 'asc')),
      (snap) => {
        const items = snap.docs.map((d) => d.data());
        // finalRank undefined → sort those by qualifyingScore desc under
        // the ranked ones.
        items.sort((a, b) => {
          const aRanked = a.finalRank ?? Infinity;
          const bRanked = b.finalRank ?? Infinity;
          if (aRanked !== bRanked) return aRanked - bRanked;
          return (b.qualifyingScore ?? 0) - (a.qualifyingScore ?? 0);
        });
        setParticipants(items);
      },
    );
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.side.crossbar.title} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[900px] px-page-x py-10 lg:px-page-x-lg">
      <header>
        <h1 className="font-display text-3xl font-700 sm:text-4xl">
          {sr.side.crossbar.title}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Rezultati takmičenja — bosonogo gađanje prečke.
        </p>
      </header>

      {participants.length === 0 ? (
        <p className="mt-10 rounded-md bg-surface-1 px-4 py-10 text-center text-sm text-ink-tertiary">
          {sr.admin.crossbar.empty}
        </p>
      ) : (
        <ol className="mt-10 flex flex-col gap-2">
          {participants.map((p, idx) => {
            const rank = p.finalRank ?? null;
            const medalBg =
              rank === 1
                ? 'var(--color-accent-gold)'
                : rank === 2
                  ? 'var(--color-accent-silver)'
                  : rank === 3
                    ? 'var(--color-accent-bronze)'
                    : 'var(--color-brand-600)';
            return (
              <li
                key={p.id}
                className="flex items-center gap-4 rounded-lg bg-surface-1 px-4 py-4 shadow-card"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display font-700"
                  style={{ backgroundColor: medalBg, color: 'var(--color-ink-inverse)' }}
                >
                  {rank ?? idx + 1}
                </span>
                <div className="flex min-w-[8rem] flex-1 flex-col">
                  <span className="font-display text-lg font-600 text-ink-primary">
                    {p.name}
                  </span>
                  {p.teamName ? (
                    <span className="text-xs text-ink-tertiary">{p.teamName}</span>
                  ) : null}
                </div>
                {p.qualifyingScore !== undefined ? (
                  <>
                    <Target size={18} className="text-ink-tertiary" />
                    <span className="tnum font-display text-xl font-700 text-ink-primary">
                      {p.qualifyingScore}
                    </span>
                    <span className="text-xs text-ink-tertiary">/5</span>
                  </>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
