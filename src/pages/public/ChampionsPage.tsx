import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Trophy } from 'lucide-react';

import { championsCol } from '@/lib/firestore/refs';
import type { Champion } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';

/**
 * Public /sampioni. Chronological list of past tournament winners. Data
 * is admin-entered via /admin/sampioni.
 */
export function ChampionsPage() {
  const [champions, setChampions] = useState<Champion[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(championsCol(), orderBy('year', 'desc')),
      (snap) => setChampions(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, []);

  return (
    <section className="mx-auto max-w-[1000px] px-page-x py-10 lg:px-page-x-lg">
      <header>
        <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.champions}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Lista šampiona iz prethodnih izdanja turnira.
        </p>
      </header>

      {champions.length === 0 ? (
        <p className="mt-10 rounded-md bg-surface-1 px-4 py-10 text-center text-sm text-ink-tertiary">
          {sr.admin.champions.empty}
        </p>
      ) : (
        <ol className="mt-10 flex flex-col gap-4">
          {champions.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-5 rounded-xl bg-surface-1 px-5 py-5 shadow-card sm:gap-6"
            >
              <div className="flex flex-col items-center">
                <span className="font-display text-3xl font-700 text-brand-400">{c.year}</span>
                {c.edition ? (
                  <span className="tnum text-xs text-ink-tertiary">{c.edition}. izdanje</span>
                ) : null}
              </div>

              {c.championLogoUrl ? (
                <img
                  src={c.championLogoUrl}
                  alt={c.championTeamName}
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'var(--color-accent-gold)',
                    color: 'var(--color-ink-inverse)',
                  }}
                >
                  <Trophy size={22} />
                </span>
              )}

              <div className="flex min-w-[12rem] flex-1 flex-col">
                {c.tournamentName ? (
                  <span className="text-xs uppercase tracking-wide text-ink-tertiary">
                    {c.tournamentName}
                  </span>
                ) : null}
                <span className="font-display text-xl font-700 text-ink-primary">
                  {c.championTeamName}
                </span>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-secondary">
                  {c.runnerUpTeamName ? (
                    <span>
                      <span className="text-ink-tertiary">
                        {sr.admin.awards.ids.runnerUp}:
                      </span>{' '}
                      {c.runnerUpTeamName}
                    </span>
                  ) : null}
                  {c.thirdPlaceTeamName ? (
                    <span>
                      <span className="text-ink-tertiary">
                        {sr.admin.awards.ids.thirdPlace}:
                      </span>{' '}
                      {c.thirdPlaceTeamName}
                    </span>
                  ) : null}
                  {c.mvpPlayerName ? (
                    <span>
                      <span className="text-ink-tertiary">
                        {sr.admin.awards.ids.mvp}:
                      </span>{' '}
                      {c.mvpPlayerName}
                    </span>
                  ) : null}
                  {c.topScorerName ? (
                    <span>
                      <span className="text-ink-tertiary">
                        {sr.admin.awards.ids.topScorer}:
                      </span>{' '}
                      {c.topScorerName}
                    </span>
                  ) : null}
                </div>
                {c.notes ? (
                  <p className="mt-2 text-sm text-ink-secondary">{c.notes}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
