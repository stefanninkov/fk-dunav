import { useMemo, useState } from 'react';

import type { Match } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { endMatch } from '@/features/match/matchActions';

interface Kick {
  side: 'a' | 'b';
  scored: boolean;
}

interface Props {
  tournamentId: string;
  match: Match;
  uid: string;
  displayMinute: number;
  onClose: () => void;
}

/**
 * Shootout recording UI. Kicks alternate A/B; admin taps "gol" or
 * "promašaj" for each. When a side can no longer be caught by the
 * remaining kicks, the shootout ends and the winner + score are
 * written into match.shootoutScore via endMatch().
 */
export function ShootoutModal({
  tournamentId,
  match,
  uid,
  displayMinute,
  onClose,
}: Props) {
  const [kicks, setKicks] = useState<Kick[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(
    () =>
      kicks.reduce(
        (acc, k) => {
          if (k.scored) acc[k.side] += 1;
          return acc;
        },
        { a: 0, b: 0 } as { a: number; b: number },
      ),
    [kicks],
  );

  const roundsPerSide = useMemo(
    () =>
      kicks.reduce(
        (acc, k) => {
          acc[k.side] += 1;
          return acc;
        },
        { a: 0, b: 0 } as { a: number; b: number },
      ),
    [kicks],
  );

  const nextSide: 'a' | 'b' = kicks.length % 2 === 0 ? 'a' : 'b';

  // Shootout winner decided? Match format gives 5 regular kicks per side,
  // then sudden death. We check if the diff exceeds remaining kicks for
  // the trailing side.
  const winner = decideWinner(score, roundsPerSide);

  function add(scored: boolean) {
    setKicks((list) => [...list, { side: nextSide, scored }]);
  }
  function undo() {
    setKicks((list) => list.slice(0, -1));
  }

  async function finalize() {
    if (!winner) return;
    setBusy(true);
    setError(null);
    try {
      await endMatch(tournamentId, match.id, uid, displayMinute, score);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-surface-0/80 p-page-x backdrop-blur-sm"
    >
      <div className="my-8 flex w-full max-w-xl flex-col gap-4 rounded-lg bg-surface-1 p-6 shadow-elevated">
        <header className="flex items-center justify-between">
          <h2 className="font-display text-xl font-700">Penali — {match.teamA.name} vs {match.teamB.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-ink-secondary hover:bg-surface-2"
          >
            {sr.common.close}
          </button>
        </header>

        <div className="flex items-center justify-around rounded-lg bg-surface-2 p-4">
          <div className="flex flex-col items-center">
            <span className="font-500 text-ink-secondary">{match.teamA.name}</span>
            <span className="tnum font-display text-4xl font-700">{score.a}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs uppercase text-ink-tertiary">Udarac</span>
            <span className="tnum font-display text-2xl font-700 text-brand-400">
              {kicks.length + 1}. ({nextSide === 'a' ? match.teamA.name : match.teamB.name})
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-500 text-ink-secondary">{match.teamB.name}</span>
            <span className="tnum font-display text-4xl font-700">{score.b}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => add(true)}
            disabled={!!winner || busy}
            className="h-touch rounded-md bg-success-soft px-5 font-600 text-success hover:bg-success/20 disabled:opacity-60"
          >
            Gol
          </button>
          <button
            type="button"
            onClick={() => add(false)}
            disabled={!!winner || busy}
            className="h-touch rounded-md bg-danger-soft px-5 font-600 text-danger hover:bg-danger/20 disabled:opacity-60"
          >
            Promaši
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={kicks.length === 0 || busy}
            className="h-touch rounded-md border border-surface-4 px-5 font-500 text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
          >
            {sr.common.back}
          </button>
        </div>

        {kicks.length > 0 ? (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-ink-tertiary">Tok</span>
            <ul className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-1">
              {kicks.map((k, i) => (
                <div key={i} className="contents">
                  <span className="tnum text-right text-ink-tertiary">{i + 1}.</span>
                  <Cell side={k.side} here={k.side === 'a'} scored={k.scored} />
                  <Cell side={k.side} here={k.side === 'b'} scored={k.scored} />
                </div>
              ))}
            </ul>
          </div>
        ) : null}

        {winner ? (
          <p className="rounded-md bg-brand-900 px-4 py-3 text-center font-600 text-brand-200">
            Pobednik: {winner === 'a' ? match.teamA.name : match.teamB.name}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
        ) : null}

        <footer className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-surface-4 px-4 py-2 text-sm text-ink-secondary hover:bg-surface-2"
          >
            {sr.common.cancel}
          </button>
          <button
            type="button"
            onClick={finalize}
            disabled={!winner || busy}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
          >
            {sr.match.actions.end}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Cell({
  here,
  scored,
}: {
  side: 'a' | 'b';
  here: boolean;
  scored: boolean;
}) {
  if (!here) return <span />;
  return (
    <span className={scored ? 'text-success' : 'text-danger'}>
      {scored ? '⚽ gol' : '✗ promašaj'}
    </span>
  );
}

function decideWinner(
  score: { a: number; b: number },
  rounds: { a: number; b: number },
): 'a' | 'b' | null {
  const regularKicks = 5;
  const completedPairs = Math.min(rounds.a, rounds.b);

  // Still in the regular round and at least one side hasn't finished
  // their 5 kicks.
  if (completedPairs < regularKicks) {
    const remainingA = regularKicks - rounds.a;
    const remainingB = regularKicks - rounds.b;
    if (score.a - score.b > remainingB) return 'a';
    if (score.b - score.a > remainingA) return 'b';
    return null;
  }

  // Past 5 per side — sudden death once both have taken the same number.
  if (rounds.a === rounds.b && score.a !== score.b) {
    return score.a > score.b ? 'a' : 'b';
  }
  return null;
}
