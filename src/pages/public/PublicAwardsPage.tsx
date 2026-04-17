import { useEffect, useMemo, useState } from 'react';
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

/**
 * All awards in one place: tournament awards (/awards/{id}) + Kup Šanka
 * winner (top team) + Prečka (crossbar) winner (finalRank === 1) +
 * Lutrija revealed prizes. This is the page linked from the main nav
 * as "Nagrade".
 */

const tournamentAwardOrder: AwardId[] = [
  'champion',
  'runnerUp',
  'thirdPlace',
  'mvp',
  'topScorer',
  'crossbarWinner',
  'teamOfTournament',
];

export function PublicAwardsPage() {
  const active = useTournamentStore((s) => s.active);
  const [awards, setAwards] = useState<Record<string, Award>>({});
  const [lottery, setLottery] = useState<LotteryPrize[]>([]);
  const [kupSanka, setKupSanka] = useState<KupSankaEntry[]>([]);
  const [crossbar, setCrossbar] = useState<CrossbarParticipant[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsubA = onSnapshot(awardsCol(active.id), (snap) => {
      const map: Record<string, Award> = {};
      for (const d of snap.docs) map[d.id] = d.data();
      setAwards(map);
    });
    const unsubL = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setLottery(snap.docs.map((d) => d.data())),
    );
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
      unsubA();
      unsubL();
      unsubK();
      unsubC();
    };
  }, [active]);

  const tournamentRows = useMemo(
    () =>
      tournamentAwardOrder
        .map((id) => [id, awards[id]] as const)
        .filter(([, a]) => !!a),
    [awards],
  );

  const kupSankaWinner = kupSanka[0];
  const crossbarWinner = crossbar.find((p) => p.finalRank === 1);

  if (!active) {
    return <PagePlaceholder title="Nagrade" description="Čeka se aktivan turnir." />;
  }

  const anyContent =
    tournamentRows.length > 0 ||
    !!kupSankaWinner ||
    !!crossbarWinner ||
    lottery.some((p) => p.revealed);

  return (
    <section className="mx-auto max-w-[1000px] px-page-x py-10 lg:px-page-x-lg">
      <header>
        <h1 className="font-display text-3xl font-700 sm:text-4xl">Nagrade</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Svi pobednici turnira i sporednih takmičenja na jednom mestu.
        </p>
      </header>

      {!anyContent ? (
        <p className="mt-8 rounded-md bg-surface-1 px-4 py-10 text-center text-sm text-ink-tertiary">
          Nagrade se objavljuju na kraju turnira.
        </p>
      ) : null}

      <div className="mt-10 flex flex-col gap-10">
        {tournamentRows.length > 0 ? (
          <section>
            <h2 className="mb-3 font-display text-xl font-600">Turnir</h2>
            <ul className="flex flex-col gap-2">
              {tournamentRows.map(([id, a]) => (
                <li
                  key={id}
                  className="flex items-center gap-4 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
                >
                  <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-ink-tertiary">
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
          </section>
        ) : null}

        {kupSankaWinner ? (
          <section>
            <h2 className="mb-3 font-display text-xl font-600">{sr.admin.kupSanka.title}</h2>
            <div className="flex items-center gap-4 rounded-lg bg-surface-1 px-4 py-4 shadow-card">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display font-700"
                style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-ink-inverse)' }}
              >
                1
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-xs uppercase tracking-wide text-ink-tertiary">Pobednik</span>
                <span className="font-display text-lg font-600 text-ink-primary">
                  {kupSankaWinner.teamName}
                </span>
              </div>
              <span className="tnum font-display text-2xl font-700 text-ink-primary">
                {kupSankaWinner.bokala}
              </span>
              <span className="text-xs text-ink-tertiary">bokala</span>
            </div>
          </section>
        ) : null}

        {crossbarWinner ? (
          <section>
            <h2 className="mb-3 font-display text-xl font-600">{sr.side.crossbar.title}</h2>
            <div className="flex items-center gap-4 rounded-lg bg-surface-1 px-4 py-4 shadow-card">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display font-700"
                style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-ink-inverse)' }}
              >
                1
              </span>
              <div className="flex flex-1 flex-col">
                <span className="font-500 text-ink-primary">{crossbarWinner.name}</span>
                {crossbarWinner.teamName ? (
                  <span className="text-xs text-ink-tertiary">{crossbarWinner.teamName}</span>
                ) : null}
              </div>
              {crossbarWinner.qualifyingScore !== undefined ? (
                <span className="tnum text-sm text-ink-secondary">
                  {crossbarWinner.qualifyingScore}/5 prečki
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        {lottery.some((p) => p.revealed) ? (
          <section>
            <h2 className="mb-1 font-display text-xl font-600">{sr.side.lottery.title}</h2>
            <p className="mb-3 text-sm text-ink-tertiary">{sr.side.lottery.subtitle}</p>
            <LotteryBoard prizes={lottery} />
          </section>
        ) : null}
      </div>
    </section>
  );
}
