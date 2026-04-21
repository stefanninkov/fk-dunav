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

/**
 * Public /nagrade hub. Shows the full award line-up unconditionally — every
 * category has a placeholder row from the moment the tournament starts, so
 * visitors can see what's up for grabs. Winner name + team fills in live as
 * the admin records it.
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

const PENDING = 'Uskoro';

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

  const kupSankaWinner = kupSanka[0];
  const crossbarWinner = crossbar.find((p) => p.finalRank === 1);

  if (!active) {
    return <PagePlaceholder title={sr.nav.awards} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1000px] px-page-x py-10 lg:px-page-x-lg">
      <header>
        <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.awards}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Svi pobednici turnira i sporednih takmičenja na jednom mestu.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        <section>
          <h2 className="mb-3 font-display text-xl font-600">Turnir</h2>
          <ul className="flex flex-col gap-2">
            {tournamentAwardOrder.map((id) => {
              const a = awards[id];
              const winner = a?.playerName ?? a?.teamName ?? null;
              return (
                <li
                  key={id}
                  className={`flex items-center gap-4 rounded-lg px-4 py-3 shadow-card ${
                    winner ? 'bg-surface-1' : 'bg-surface-1/60'
                  }`}
                >
                  <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-ink-tertiary">
                    {sr.admin.awards.ids[id]}
                  </span>
                  <span
                    className={
                      winner
                        ? 'font-500 text-ink-primary'
                        : 'italic text-ink-tertiary'
                    }
                  >
                    {winner ?? PENDING}
                  </span>
                  {winner && a?.teamName && a?.playerName ? (
                    <span className="text-xs text-ink-tertiary">{a.teamName}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-600">{sr.admin.kupSanka.title}</h2>
          <div
            className={`flex items-center gap-4 rounded-lg px-4 py-4 shadow-card ${
              kupSankaWinner ? 'bg-surface-1' : 'bg-surface-1/60'
            }`}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display font-700"
              style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-ink-inverse)' }}
            >
              1
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-xs uppercase tracking-wide text-ink-tertiary">Pobednik</span>
              <span
                className={
                  kupSankaWinner
                    ? 'font-display text-lg font-600 text-ink-primary'
                    : 'font-display text-lg font-500 italic text-ink-tertiary'
                }
              >
                {kupSankaWinner?.teamName ?? PENDING}
              </span>
            </div>
            {kupSankaWinner ? (
              <>
                <span className="tnum font-display text-2xl font-700 text-ink-primary">
                  {kupSankaWinner.bokala}
                </span>
                <span className="text-xs text-ink-tertiary">bokala</span>
              </>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-600">{sr.side.crossbar.title}</h2>
          <div
            className={`flex items-center gap-4 rounded-lg px-4 py-4 shadow-card ${
              crossbarWinner ? 'bg-surface-1' : 'bg-surface-1/60'
            }`}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display font-700"
              style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-ink-inverse)' }}
            >
              1
            </span>
            <div className="flex flex-1 flex-col">
              <span
                className={
                  crossbarWinner
                    ? 'font-500 text-ink-primary'
                    : 'italic text-ink-tertiary'
                }
              >
                {crossbarWinner?.name ?? PENDING}
              </span>
              {crossbarWinner?.teamName ? (
                <span className="text-xs text-ink-tertiary">{crossbarWinner.teamName}</span>
              ) : null}
            </div>
            {crossbarWinner?.qualifyingScore !== undefined ? (
              <span className="tnum text-sm text-ink-secondary">
                {crossbarWinner.qualifyingScore}/5 prečki
              </span>
            ) : null}
          </div>
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
