import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { matchEventsCol, matchesCol } from '@/lib/firestore/refs';
import type { Match, MatchEvent } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function LivePage() {
  const active = useTournamentStore((s) => s.active);
  const [live, setLive] = useState<Match[] | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(matchesCol(active.id), where('status', '==', 'live')),
      (snap) => setLive(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.live} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.live}</h1>

      {live === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : live.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">
          Trenutno nema utakmica u toku. Pogledaj{' '}
          <NavLink to="/raspored" className="text-brand-400 hover:text-brand-300">
            raspored
          </NavLink>
          .
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {live.map((m) => (
            <li key={m.id}>
              <LiveMatchCard match={m} tournamentId={active.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One live match card. Subscribes to the match's goal events so the
 * scorer names render under the score in real time — same source the
 * match-detail page uses, just collapsed to a compact "Strelci" line.
 */
function LiveMatchCard({
  match,
  tournamentId,
}: {
  match: Match;
  tournamentId: string;
}) {
  const [goals, setGoals] = useState<MatchEvent[]>([]);

  useEffect(() => {
    // Same query shape as MatchDetailPage so we hit the auto-generated
    // subcollection index. Adding where('type', '==', 'goal') here
    // would require a (type, deleted, minute) composite index that
    // isn't deployed, and onSnapshot would silently swallow the
    // FAILED_PRECONDITION — which is exactly why scorers never showed.
    const unsub = onSnapshot(
      query(
        matchEventsCol(tournamentId, match.id),
        where('deleted', '==', false),
        orderBy('minute', 'asc'),
      ),
      (snap) => {
        const all = snap.docs.map((d) => d.data());
        setGoals(all.filter((e) => e.type === 'goal'));
      },
      (err) => {
        console.error('LiveMatchCard goal subscription failed', err);
      },
    );
    return unsub;
  }, [tournamentId, match.id]);

  const goalsByTeam = (side: 'a' | 'b') =>
    goals.filter((g) => g.team === side);

  return (
    <NavLink
      to={`/utakmica/${match.id}`}
      className="flex flex-col gap-3 rounded-lg bg-surface-1 p-5 shadow-card hover:shadow-glow"
    >
      <span className="inline-flex items-center gap-2 self-start rounded-full bg-live-soft px-2 py-0.5 text-xs font-600 text-live">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
        {sr.match.status.live} · {match.clock.displayMinute}'
      </span>
      <div className="flex items-center justify-between gap-4">
        <span className="flex-1 font-display text-xl font-600 text-ink-primary">
          {match.teamA.name}
        </span>
        <span className="tnum font-display text-4xl font-700 text-ink-primary">
          {match.score.a}:{match.score.b}
        </span>
        <span className="flex-1 text-right font-display text-xl font-600 text-ink-primary">
          {match.teamB.name}
        </span>
      </div>

      {goals.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 border-t border-surface-3 pt-2 text-xs text-ink-secondary">
          <ScorerList goals={goalsByTeam('a')} align="left" />
          <ScorerList goals={goalsByTeam('b')} align="right" />
        </div>
      ) : null}

      <span className="text-xs text-ink-tertiary">{match.field}</span>
    </NavLink>
  );
}

function ScorerList({
  goals,
  align,
}: {
  goals: MatchEvent[];
  align: 'left' | 'right';
}) {
  if (goals.length === 0) return <span />;
  return (
    <ul
      className={`flex flex-col gap-0.5 ${align === 'right' ? 'items-end text-right' : 'items-start'}`}
    >
      {goals.map((g) => (
        <li key={g.id} className="flex items-baseline gap-1.5">
          <span className="font-500 text-ink-primary">
            ⚽ {g.playerName ?? 'Nepoznato'}
          </span>
          {g.ownGoal ? (
            <span className="text-[0.65rem] uppercase tracking-wide text-danger">AG</span>
          ) : null}
          <span className="tnum text-ink-tertiary">{g.minute}'</span>
        </li>
      ))}
    </ul>
  );
}
