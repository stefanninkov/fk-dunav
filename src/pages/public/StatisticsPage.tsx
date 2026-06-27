import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

import { awardsCol, fanPollsCol } from '@/lib/firestore/refs';
import type { Award, AwardId, FanPoll } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { FanPollCard } from '@/features/voting/components/FanPollCard';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

const awardOrder: AwardId[] = [
  'champion',
  'runnerUp',
  'thirdPlace',
  'mvp',
  'topScorer',
  'bestGoalkeeper',
  'crossbarWinner',
];

/**
 * /statistika — tournament awards summary + crossbar + open fan polls.
 * Kup Šanka and Lutrija live in their own top-level tabs so they have
 * room to breathe (drum animation, leaderboard interactions).
 */
export function StatisticsPage() {
  const active = useTournamentStore((s) => s.active);
  const [awards, setAwards] = useState<Record<string, Award>>({});
  const [polls, setPolls] = useState<FanPoll[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsubA = onSnapshot(awardsCol(active.id), (snap) => {
      const map: Record<string, Award> = {};
      for (const d of snap.docs) map[d.id] = d.data();
      setAwards(map);
    });
    const unsubPolls = onSnapshot(fanPollsCol(active.id), (snap) =>
      setPolls(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubA();
      unsubPolls();
    };
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.statistics} description="Čeka se aktivan turnir." />;
  }

  const awardList = awardOrder
    .map((id) => [id, awards[id]] as const)
    .filter(([, a]) => !!a);

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.statistics}</h1>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl font-600">Nagrade</h2>
          {awardList.length === 0 ? (
            <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
              Objavljuje se na kraju turnira.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {awardList.map(([id, a]) => (
                <li
                  key={id}
                  className="flex items-center gap-4 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
                >
                  <span className="w-36 shrink-0 text-xs uppercase tracking-wide text-ink-tertiary">
                    {sr.admin.awards.ids[id]}
                  </span>
                  <span className="font-500 text-ink-primary">
                    {a.playerName ?? a.teamName ?? '—'}
                  </span>
                  {a.teamName && a.playerName ? (
                    <span className="text-xs text-ink-tertiary">{a.teamName}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {polls.length > 0 ? (
          <section className="lg:col-span-2">
            <h2 className="mb-1 font-display text-xl font-600">Glasanje navijača</h2>
            <p className="mb-3 text-sm text-ink-tertiary">
              Jedan glas po uređaju — birajte dok su ankete otvorene.
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {polls.map((p) => (
                <FanPollCard key={p.id} tournamentId={active.id} poll={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
