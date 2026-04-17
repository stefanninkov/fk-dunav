import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import {
  awardsCol,
  crossbarCol,
  kupSankaCol,
  lotteryCol,
} from '@/lib/firestore/refs';
import type {
  Award,
  AwardId,
  CrossbarParticipant,
  KupSankaEntry,
  LotteryPrize,
} from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { LotteryBoard } from '@/features/lottery/components/LotteryBoard';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

const awardOrder: AwardId[] = [
  'champion',
  'runnerUp',
  'thirdPlace',
  'mvp',
  'topScorer',
  'crossbarWinner',
  'teamOfTournament',
];

export function StatisticsPage() {
  const active = useTournamentStore((s) => s.active);
  const [lottery, setLottery] = useState<LotteryPrize[]>([]);
  const [awards, setAwards] = useState<Record<string, Award>>({});
  const [kupSanka, setKupSanka] = useState<KupSankaEntry[]>([]);
  const [crossbar, setCrossbar] = useState<CrossbarParticipant[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsubL = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setLottery(snap.docs.map((d) => d.data())),
    );
    const unsubA = onSnapshot(awardsCol(active.id), (snap) => {
      const map: Record<string, Award> = {};
      for (const d of snap.docs) map[d.id] = d.data();
      setAwards(map);
    });
    const unsubK = onSnapshot(kupSankaCol(active.id), (snap) =>
      setKupSanka(
        snap.docs
          .map((d) => d.data())
          .sort((a, b) => b.bokala - a.bokala),
      ),
    );
    const unsubC = onSnapshot(
      query(crossbarCol(active.id), orderBy('finalRank', 'asc')),
      (snap) => setCrossbar(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubL();
      unsubA();
      unsubK();
      unsubC();
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

        <section>
          <h2 className="mb-3 font-display text-xl font-600">{sr.admin.kupSanka.title}</h2>
          {kupSanka.length === 0 ? (
            <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
              Još nema unosa.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {kupSanka.map((e, idx) => (
                <li
                  key={e.teamId}
                  className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
                >
                  <span className="tnum w-6 font-display text-lg font-700 text-brand-400">
                    {idx + 1}.
                  </span>
                  <span className="flex-1 text-ink-primary">{e.teamName}</span>
                  <span className="tnum font-display text-lg font-700">{e.bokala}</span>
                  <span className="text-xs text-ink-tertiary">bokala</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-600">{sr.side.crossbar.title}</h2>
          {crossbar.length === 0 ? (
            <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
              Objavljuje se kada se održi.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {crossbar.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
                >
                  {p.finalRank ? (
                    <span className="tnum w-8 font-display text-lg font-700 text-brand-400">
                      {p.finalRank}.
                    </span>
                  ) : null}
                  <div className="flex flex-1 flex-col">
                    <span className="font-500 text-ink-primary">{p.name}</span>
                    {p.teamName ? (
                      <span className="text-xs text-ink-tertiary">{p.teamName}</span>
                    ) : null}
                  </div>
                  {p.qualifyingScore !== undefined ? (
                    <span className="tnum text-sm text-ink-secondary">
                      {p.qualifyingScore}/5
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-1 font-display text-xl font-600">{sr.side.lottery.title}</h2>
          <p className="mb-3 text-sm text-ink-tertiary">{sr.side.lottery.subtitle}</p>
          <LotteryBoard prizes={lottery} />
        </section>
      </div>
    </section>
  );
}
