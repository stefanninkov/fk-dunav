import { useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';

import {
  fanPollsCol,
  matchEventsCol,
  matchesCol,
} from '@/lib/firestore/refs';
import type { FanPoll, Match, MatchEvent } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { FanPollCard } from '@/features/voting/components/FanPollCard';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

interface ScorerRow {
  /** Stable key: playerId if known, else `name:${playerName}` so manual
   *  "Drugi" entries with the same spelling still aggregate. */
  key: string;
  playerId?: string;
  playerName: string;
  teamName?: string;
  goals: number;
}

/**
 * /statistika — auto-aggregated top-scorers list ("Lista strelaca")
 * built live from match goal events, plus any open fan polls.
 *
 * The page subscribes to every match doc in the active tournament and
 * spawns one events listener per match. When a reporter taps the goal
 * button in the live editor, the new event triggers an instant
 * re-aggregation here — the public scoreboard updates without anyone
 * touching an awards form.
 */
export function StatisticsPage() {
  const active = useTournamentStore((s) => s.active);
  const [matches, setMatches] = useState<Match[]>([]);
  const [polls, setPolls] = useState<FanPoll[]>([]);
  const [eventsByMatch, setEventsByMatch] = useState<Map<string, MatchEvent[]>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!active) return;
    const unsubMatches = onSnapshot(matchesCol(active.id), (snap) =>
      setMatches(snap.docs.map((d) => d.data())),
    );
    const unsubPolls = onSnapshot(fanPollsCol(active.id), (snap) =>
      setPolls(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubMatches();
      unsubPolls();
    };
  }, [active]);

  // One snapshot listener per match for its non-deleted events. We track
  // each subscription so renaming/removing a match cleanly tears the
  // corresponding listener down.
  const eventSubsRef = useRef<Map<string, () => void>>(new Map());
  useEffect(() => {
    if (!active) return;
    const wanted = new Set(matches.map((m) => m.id));
    // Drop subs for matches that disappeared (deleted from schedule).
    for (const [id, unsub] of eventSubsRef.current.entries()) {
      if (!wanted.has(id)) {
        unsub();
        eventSubsRef.current.delete(id);
        setEventsByMatch((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    }
    // Add subs for newly-arrived matches.
    for (const m of matches) {
      if (eventSubsRef.current.has(m.id)) continue;
      const unsub = onSnapshot(
        query(matchEventsCol(active.id, m.id), where('deleted', '==', false)),
        (snap) => {
          const list = snap.docs.map((d) => d.data());
          setEventsByMatch((prev) => {
            const next = new Map(prev);
            next.set(m.id, list);
            return next;
          });
        },
      );
      eventSubsRef.current.set(m.id, unsub);
    }
  }, [active, matches]);

  // Tear down every events listener on unmount.
  useEffect(() => {
    const subs = eventSubsRef.current;
    return () => {
      for (const unsub of subs.values()) unsub();
      subs.clear();
    };
  }, []);

  const scorers = useMemo<ScorerRow[]>(() => {
    const map = new Map<string, ScorerRow>();
    for (const [matchId, events] of eventsByMatch.entries()) {
      const match = matches.find((m) => m.id === matchId);
      if (!match) continue;
      for (const ev of events) {
        if (ev.type !== 'goal') continue;
        if (ev.ownGoal) continue; // own goals don't count toward a scorer tally
        const name = (ev.playerName ?? '').trim() || 'Nepoznato';
        const teamName =
          ev.team === 'a'
            ? match.teamA.name
            : ev.team === 'b'
              ? match.teamB.name
              : undefined;
        const key = ev.playerId ? `id:${ev.playerId}` : `name:${name}`;
        const existing = map.get(key);
        if (existing) {
          existing.goals += 1;
          if (!existing.teamName && teamName) existing.teamName = teamName;
        } else {
          map.set(key, {
            key,
            playerId: ev.playerId,
            playerName: name,
            teamName,
            goals: 1,
          });
        }
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        b.goals - a.goals ||
        a.playerName.localeCompare(b.playerName, 'sr'),
    );
  }, [eventsByMatch, matches]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.statistics} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.statistics}</h1>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl font-600">Lista strelaca</h2>
          {scorers.length === 0 ? (
            <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
              Još nema postignutih golova.
            </p>
          ) : (
            <ScorersTable scorers={scorers} />
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

// ---------------------------------------------------------------------------

function ScorersTable({ scorers }: { scorers: ScorerRow[] }) {
  // Dense rank (1, 1, 3, 3, 5, …) so two tied scorers share a position
  // but the count after the tie skips. Easier to read than competition
  // rank for a tournament leaderboard.
  let prevGoals = -1;
  let rank = 0;
  return (
    <ul className="flex flex-col gap-1.5">
      {scorers.map((s, idx) => {
        if (s.goals !== prevGoals) {
          rank = idx + 1;
          prevGoals = s.goals;
        }
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
            key={s.key}
            className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
          >
            <span
              className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-700"
              style={{ backgroundColor: medalBg, color: 'var(--color-ink-inverse)' }}
            >
              {rank}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-500 text-ink-primary">
                {s.playerName}
              </span>
              {s.teamName ? (
                <span className="truncate text-xs text-ink-tertiary">{s.teamName}</span>
              ) : null}
            </div>
            <span className="tnum font-display text-xl font-700 text-ink-primary">
              {s.goals}
            </span>
            <span className="text-xs text-ink-tertiary">
              {s.goals === 1 ? 'gol' : 'golova'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
