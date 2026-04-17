import { useEffect, useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import {
  matchDoc,
  matchEventsCol,
} from '@/lib/firestore/refs';
import type { Match, MatchEvent } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { useMatchClock } from '@/features/match/useMatchClock';
import {
  abandonMatch,
  endHalf,
  endMatch,
  logCard,
  logGoal,
  pauseMatch,
  resumeMatch,
  startMatch,
  startSecondHalf,
} from '@/features/match/matchActions';
import { ShootoutModal } from '@/features/match/components/ShootoutModal';

export function AdminMatchEditorPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shootoutOpen, setShootoutOpen] = useState(false);

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

  const liveMinute = useMatchClock(match);
  const displayMinute = useMemo(() => {
    if (!match) return 0;
    return match.clock.state === 'running' ? liveMinute : match.clock.displayMinute;
  }, [match, liveMinute]);

  if (!active || !match || !uid) {
    return <p className="text-sm text-ink-secondary">{sr.common.loading}</p>;
  }

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const halfMinutes = active.config.matchFormat.halfDurationSeconds / 60;

  return (
    <section className="flex flex-col gap-6">
      <NavLink to="/admin/utakmice" className="text-sm text-ink-secondary hover:text-ink-primary">
        ← {sr.admin.nav.matches}
      </NavLink>

      <header className="rounded-lg bg-surface-1 p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <TeamHeader name={match.teamA.name} />
          <div className="flex flex-col items-center">
            <span className="tnum font-display text-6xl font-700 text-ink-primary">
              {match.score.a}:{match.score.b}
            </span>
            <span className="mt-1 text-xs uppercase tracking-wide text-ink-tertiary">
              {sr.match.status[match.status]} · {displayMinute}'
              {match.clock.state === 'halftime' ? ` · ${sr.match.actions.halftime}` : ''}
            </span>
          </div>
          <TeamHeader name={match.teamB.name} alignEnd />
        </div>
      </header>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TeamPanel
          side="a"
          match={match}
          disabled={busy || match.status !== 'live'}
          onGoal={(name) =>
            act(() =>
              logGoal(active.id, match.id, uid, {
                team: 'a',
                minute: displayMinute,
                playerName: name,
              }),
            )
          }
          onCard={(type, name) =>
            act(() =>
              logCard(active.id, match.id, uid, {
                team: 'a',
                type,
                minute: displayMinute,
                playerName: name,
              }),
            )
          }
        />
        <TeamPanel
          side="b"
          match={match}
          disabled={busy || match.status !== 'live'}
          onGoal={(name) =>
            act(() =>
              logGoal(active.id, match.id, uid, {
                team: 'b',
                minute: displayMinute,
                playerName: name,
              }),
            )
          }
          onCard={(type, name) =>
            act(() =>
              logCard(active.id, match.id, uid, {
                team: 'b',
                type,
                minute: displayMinute,
                playerName: name,
              }),
            )
          }
        />
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-1 p-4 shadow-card">
        {match.status === 'scheduled' ? (
          <Btn busy={busy} onClick={() => act(() => startMatch(active.id, match.id, uid))}>
            {sr.match.actions.start}
          </Btn>
        ) : null}

        {match.status === 'live' && match.clock.state === 'running' ? (
          <>
            <Btn
              variant="ghost"
              busy={busy}
              onClick={() => act(() => pauseMatch(active.id, match.id, uid, displayMinute))}
            >
              {sr.match.actions.pause}
            </Btn>
            <Btn
              variant="ghost"
              busy={busy}
              onClick={() =>
                act(() => endHalf(active.id, match.id, uid, displayMinute))
              }
            >
              {sr.match.actions.halftime}
            </Btn>
          </>
        ) : null}

        {match.status === 'live' && match.clock.state === 'paused' ? (
          <Btn busy={busy} onClick={() => act(() => resumeMatch(active.id, match.id, uid))}>
            {sr.match.actions.resume}
          </Btn>
        ) : null}

        {match.status === 'live' && match.clock.state === 'halftime' ? (
          <Btn
            busy={busy}
            onClick={() =>
              act(() =>
                startSecondHalf(active.id, match.id, uid, halfMinutes * 60),
              )
            }
          >
            II poluvreme
          </Btn>
        ) : null}

        {match.status === 'live' ? (
          <>
            <Btn
              variant="danger"
              busy={busy}
              onClick={() => {
                const tied = match.score.a === match.score.b;
                if (match.phase === 'knockout' && tied) {
                  setShootoutOpen(true);
                  return;
                }
                if (!confirm('Završiti utakmicu?')) return;
                void act(() => endMatch(active.id, match.id, uid, displayMinute));
              }}
            >
              {sr.match.actions.end}
            </Btn>
            <Btn
              variant="ghost"
              busy={busy}
              onClick={() => {
                if (!confirm('Prekinuti utakmicu?')) return;
                void act(() => abandonMatch(active.id, match.id, uid, displayMinute));
              }}
            >
              Prekini
            </Btn>
          </>
        ) : null}
      </section>

      {shootoutOpen ? (
        <ShootoutModal
          tournamentId={active.id}
          match={match}
          uid={uid}
          displayMinute={displayMinute}
          onClose={() => setShootoutOpen(false)}
        />
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-sm font-600 text-ink-secondary">Tok utakmice</h2>
        {events.length === 0 ? (
          <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
            Još nema događaja.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <EventRow key={e.id} event={e} match={match} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function TeamHeader({ name, alignEnd }: { name: string; alignEnd?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col ${alignEnd ? 'items-end' : ''}`}>
      <span className="font-display text-lg font-600 text-ink-primary sm:text-2xl">{name}</span>
    </div>
  );
}

function TeamPanel({
  side,
  match,
  disabled,
  onGoal,
  onCard,
}: {
  side: 'a' | 'b';
  match: Match;
  disabled: boolean;
  onGoal: (playerName: string) => void;
  onCard: (type: 'yellowCard' | 'redCard', playerName: string) => void;
}) {
  const team = side === 'a' ? match.teamA : match.teamB;
  const [name, setName] = useState('');
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4 shadow-card">
      <h3 className="font-display text-sm font-600 text-ink-secondary">{team.name}</h3>
      <input
        placeholder="Ime strelca / kartonaša"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onGoal(name.trim());
            setName('');
          }}
          className="h-touch rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          ⚽ {sr.match.actions.addGoal}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onCard('yellowCard', name.trim());
            setName('');
          }}
          className="h-touch rounded-md bg-warning-soft px-4 font-600 text-warning disabled:opacity-60"
        >
          🟨
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onCard('redCard', name.trim());
            setName('');
          }}
          className="h-touch rounded-md bg-danger-soft px-4 font-600 text-danger disabled:opacity-60"
        >
          🟥
        </button>
      </div>
    </div>
  );
}

function EventRow({ event, match }: { event: MatchEvent; match: Match }) {
  const teamName =
    event.team === 'a' ? match.teamA.name : event.team === 'b' ? match.teamB.name : '';
  const label =
    event.type === 'goal'
      ? 'GOL'
      : event.type === 'yellowCard'
        ? 'Žuti karton'
        : event.type === 'redCard'
          ? 'Crveni karton'
          : event.type === 'matchStart'
            ? 'Početak'
            : event.type === 'matchEnd'
              ? 'Kraj'
              : event.type === 'halfEnd'
                ? 'Poluvreme'
                : event.type === 'halfStart'
                  ? 'II poluvreme'
                  : event.type;
  return (
    <li className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 text-sm shadow-card">
      <span className="tnum w-10 font-600 text-ink-secondary">{event.minute}'</span>
      <span className="flex-1 text-ink-primary">
        <span className="text-ink-tertiary">{teamName}</span> {label}
        {event.playerName ? ` — ${event.playerName}` : ''}
      </span>
    </li>
  );
}

function Btn({
  children,
  onClick,
  busy,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const cls =
    variant === 'primary'
      ? 'bg-brand-600 text-ink-primary hover:bg-brand-500'
      : variant === 'danger'
        ? 'bg-danger text-ink-primary hover:bg-danger/90'
        : 'border border-surface-4 text-ink-secondary hover:bg-surface-2';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`h-touch rounded-md px-4 font-600 disabled:opacity-60 ${cls}`}
    >
      {children}
    </button>
  );
}
