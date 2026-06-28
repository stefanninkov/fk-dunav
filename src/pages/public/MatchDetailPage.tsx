import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { matchDoc, matchEventsCol } from '@/lib/firestore/refs';
import type { Match, MatchEvent } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { FollowMatchButton } from '@/features/push/FollowMatchButton';
import { useScorePop } from '@/features/match/useScorePop';

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const active = useTournamentStore((s) => s.active);
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);

  useEffect(() => {
    if (!active || !matchId) return;
    const unsubMatch = onSnapshot(matchDoc(active.id, matchId), (snap) => {
      setMatch(snap.exists() ? snap.data() : null);
    });
    const unsubEvents = onSnapshot(
      query(
        matchEventsCol(active.id, matchId),
        where('deleted', '==', false),
        orderBy('minute', 'asc'),
      ),
      (snap) => setEvents(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubMatch();
      unsubEvents();
    };
  }, [active, matchId]);

  if (!active) {
    return <PagePlaceholder title="Utakmica" description="Čeka se aktivan turnir." />;
  }
  if (!match) {
    return <PagePlaceholder title="Utakmica" description={sr.common.loading} />;
  }

  const live = match.status === 'live';
  const finished = match.status === 'finished';

  return <MatchDetailBody match={match} events={events} live={live} finished={finished} matchId={matchId!} />;
}

function MatchDetailBody({
  match,
  events,
  live,
  finished,
  matchId,
}: {
  match: Match;
  events: MatchEvent[];
  live: boolean;
  finished: boolean;
  matchId: string;
}) {
  const scoreARef = useScorePop(match.score.a);
  const scoreBRef = useScorePop(match.score.b);

  return (
    <section className="mx-auto max-w-[900px] px-page-x py-10 lg:px-page-x-lg">
      <NavLink to="/uzivo" className="text-sm text-ink-secondary hover:text-ink-primary">
        ← {sr.nav.live}
      </NavLink>

      <header className="mt-4 rounded-lg bg-surface-1 p-6 shadow-card">
        {live ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-live-soft px-2 py-0.5 text-xs font-600 text-live">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
            {sr.match.status.live} · {match.clock.displayMinute}'
          </span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
            {sr.match.status[match.status]}
          </span>
        )}

        <div className="mt-4 flex items-center justify-between gap-4">
          <NavLink
            to={`/tim/${match.teamA.teamId}`}
            className="flex-1 font-display text-xl font-600 hover:text-brand-300 sm:text-2xl"
          >
            {match.teamA.name}
          </NavLink>
          <span className="tnum font-display text-5xl font-700 text-ink-primary sm:text-6xl">
            <span ref={scoreARef} className="inline-block">
              {match.score.a}
            </span>
            :
            <span ref={scoreBRef} className="inline-block">
              {match.score.b}
            </span>
          </span>
          <NavLink
            to={`/tim/${match.teamB.teamId}`}
            className="flex-1 text-right font-display text-xl font-600 hover:text-brand-300 sm:text-2xl"
          >
            {match.teamB.name}
          </NavLink>
        </div>

        {match.shootoutScore ? (
          <p className="mt-2 text-center text-sm text-ink-secondary">
            Penali: {match.shootoutScore.a}:{match.shootoutScore.b}
          </p>
        ) : null}

        <p className="mt-2 text-center text-xs text-ink-tertiary">
          {match.scheduledStart.toDate().toLocaleString('sr-RS', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · {match.field}
        </p>

        {live ? (
          <div className="mt-4 flex justify-center">
            <FollowMatchButton matchId={matchId} />
          </div>
        ) : null}
      </header>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-600">Tok utakmice</h2>
        {events.length === 0 ? (
          <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
            {finished ? 'Nema zabeleženih događaja.' : 'Utakmica još nije započeta.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => {
              const teamName =
                e.team === 'a' ? match.teamA.name : e.team === 'b' ? match.teamB.name : '';
              const label =
                e.type === 'goal'
                  ? '⚽ GOL'
                  : e.type === 'yellowCard'
                    ? '🟨 Žuti karton'
                    : e.type === 'redCard'
                      ? '🟥 Crveni karton'
                      : e.type === 'matchStart'
                        ? 'Početak'
                        : e.type === 'matchEnd'
                          ? 'Kraj'
                          : e.type === 'halfEnd'
                            ? 'Poluvreme'
                            : e.type === 'halfStart'
                              ? 'II poluvreme'
                              : e.type;
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 text-sm shadow-card"
                >
                  <span className="tnum w-10 font-600 text-ink-secondary">{e.minute}'</span>
                  <span className="flex-1 text-ink-primary">
                    <span className="text-ink-tertiary">{teamName}</span> {label}
                    {e.playerName ? ` — ${e.playerName}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
