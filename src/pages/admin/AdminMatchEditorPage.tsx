import { useEffect, useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Trash2, X } from 'lucide-react';

import {
  matchDoc,
  matchEventsCol,
  playersCol,
} from '@/lib/firestore/refs';
import type { Match, MatchEvent, Player } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { useMatchClock } from '@/features/match/useMatchClock';
import {
  abandonMatch,
  endHalf,
  endMatch,
  forfeitMatch,
  logCard,
  logGoal,
  pauseMatch,
  resumeMatch,
  softDeleteEvent,
  startMatch,
  startSecondHalf,
} from '@/features/match/matchActions';
import { ShootoutModal } from '@/features/match/components/ShootoutModal';

/**
 * Editor surface for the match reporter. Designed for one-handed phone use:
 *  - Big colored state badge so glance-tells you what phase the match is in.
 *  - Per-team player picker (with free-text fallback) — types are awful on
 *    a phone in a stadium, dropdown removes the typo class entirely.
 *  - Per-event delete button (soft-delete; rule-restricted to own events
 *    + only the deleted-flag field).
 *  - Confirms on every destructive transition (end / abandon / delete).
 */
export function AdminMatchEditorPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
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
    const unsubPlayers = onSnapshot(playersCol(active.id), (snap) =>
      setAllPlayers(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubMatch();
      unsubEvents();
      unsubPlayers();
    };
  }, [active, matchId]);

  const liveMinute = useMatchClock(match);
  const displayMinute = useMemo(() => {
    if (!match) return 0;
    return match.clock.state === 'running' ? liveMinute : match.clock.displayMinute;
  }, [match, liveMinute]);

  const playersByTeam = useMemo(() => {
    const m = new Map<string, Player[]>();
    for (const p of allPlayers) {
      if (!p.active) continue;
      const list = m.get(p.teamId) ?? [];
      list.push(p);
      m.set(p.teamId, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.lastName.localeCompare(b.lastName, 'sr'));
    }
    return m;
  }, [allPlayers]);

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
  const status = badgeForStatus(match);

  return (
    <section className="flex flex-col gap-6 pb-12">
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
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-700 uppercase tracking-wide ${status.cls}`}
            >
              {status.dot ? (
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 rounded-full ${status.dotCls}`}
                />
              ) : null}
              {status.label}
            </span>
            <span className="mt-1 text-xs text-ink-tertiary">
              {displayMinute}'
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
          players={playersByTeam.get(match.teamA.teamId) ?? []}
          disabled={busy || match.status !== 'live'}
          onGoal={(player, opts) =>
            act(() =>
              logGoal(active.id, match.id, uid, {
                team: opts?.ownGoal ? 'b' : 'a',
                minute: displayMinute,
                playerId: player.id,
                playerName: player.name,
                ownGoal: opts?.ownGoal,
              }),
            )
          }
          onCard={(type, player) =>
            act(() =>
              logCard(active.id, match.id, uid, {
                team: 'a',
                type,
                minute: displayMinute,
                playerId: player.id,
                playerName: player.name,
              }),
            )
          }
        />
        <TeamPanel
          side="b"
          match={match}
          players={playersByTeam.get(match.teamB.teamId) ?? []}
          disabled={busy || match.status !== 'live'}
          onGoal={(player, opts) =>
            act(() =>
              logGoal(active.id, match.id, uid, {
                team: opts?.ownGoal ? 'a' : 'b',
                minute: displayMinute,
                playerId: player.id,
                playerName: player.name,
                ownGoal: opts?.ownGoal,
              }),
            )
          }
          onCard={(type, player) =>
            act(() =>
              logCard(active.id, match.id, uid, {
                team: 'b',
                type,
                minute: displayMinute,
                playerId: player.id,
                playerName: player.name,
              }),
            )
          }
        />
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-1 p-4 shadow-card">
        {match.status === 'scheduled' ? (
          <>
            <Btn busy={busy} onClick={() => act(() => startMatch(active.id, match.id, uid))}>
              {sr.match.actions.start}
            </Btn>
            <Btn
              variant="ghost"
              busy={busy}
              onClick={() => {
                const choice = prompt(
                  `Predaja meča — koji tim nije došao?\n\nUkucaj "a" za "${match.teamA.name}" (gubi 0:3) ili "b" za "${match.teamB.name}" (gubi 3:0).`,
                );
                if (!choice) return;
                const c = choice.trim().toLowerCase();
                if (c !== 'a' && c !== 'b') return;
                const winnerSide: 'a' | 'b' = c === 'a' ? 'b' : 'a';
                const winnerName =
                  winnerSide === 'a' ? match.teamA.name : match.teamB.name;
                if (!confirm(`Potvrdi predaju: pobednik ${winnerName} 3:0?`)) return;
                void act(() => forfeitMatch(active.id, match.id, uid, winnerSide));
              }}
            >
              Predaja meča
            </Btn>
          </>
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
              onClick={() => {
                if (!confirm('Zatvoriti poluvreme?')) return;
                void act(() => endHalf(active.id, match.id, uid, displayMinute));
              }}
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
              act(() => startSecondHalf(active.id, match.id, uid, halfMinutes * 60))
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
                if (
                  !confirm(
                    `Završiti utakmicu sa rezultatom ${match.score.a}:${match.score.b}?`,
                  )
                )
                  return;
                void act(() => endMatch(active.id, match.id, uid, displayMinute));
              }}
            >
              {sr.match.actions.end}
            </Btn>
            <Btn
              variant="ghost"
              busy={busy}
              onClick={() => {
                if (!confirm('Prekinuti utakmicu? Akcija je trajna.')) return;
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
              <EventRow
                key={e.id}
                event={e}
                match={match}
                canDelete={e.createdBy === uid && match.status === 'live'}
                onDelete={() =>
                  act(() => softDeleteEvent(active.id, match.id, e, uid))
                }
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

// ---------------------------------------------------------------------------

interface PickedPlayer {
  id?: string;
  name: string;
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
  players,
  disabled,
  onGoal,
  onCard,
}: {
  side: 'a' | 'b';
  match: Match;
  players: Player[];
  disabled: boolean;
  onGoal: (player: PickedPlayer, opts?: { ownGoal?: boolean }) => void;
  onCard: (type: 'yellowCard' | 'redCard', player: PickedPlayer) => void;
}) {
  const team = side === 'a' ? match.teamA : match.teamB;
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setSheetOpen(true)}
        className="flex h-full min-h-[5rem] flex-col items-start justify-center gap-1 rounded-lg bg-surface-1 p-4 text-left shadow-card transition-colors active:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-xs uppercase tracking-wide text-ink-tertiary">
          {disabled ? 'Tim' : 'Klikni za događaj'}
        </span>
        <span className="font-display text-base font-700 text-ink-primary sm:text-lg">
          {team.name}
        </span>
        <span className="text-xs text-ink-tertiary">
          ⚽ gol · AG · 🟨 karton · 🟥 karton
        </span>
      </button>

      {sheetOpen ? (
        <PlayerActionSheet
          teamName={team.name}
          players={players}
          onClose={() => setSheetOpen(false)}
          onGoal={(p, opts) => {
            onGoal(p, opts);
            setSheetOpen(false);
          }}
          onCard={(type, p) => {
            onCard(type, p);
            setSheetOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Bottom-sheet roster picker. One row per player with three quick-tap
 * action buttons — Goal / Yellow / Red. A "Drugi (unesi ručno)" footer
 * row lets the reporter log an event for an off-roster player without
 * leaving the sheet.
 */
function PlayerActionSheet({
  teamName,
  players,
  onClose,
  onGoal,
  onCard,
}: {
  teamName: string;
  players: Player[];
  onClose: () => void;
  onGoal: (player: PickedPlayer, opts?: { ownGoal?: boolean }) => void;
  onCard: (type: 'yellowCard' | 'redCard', player: PickedPlayer) => void;
}) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherName, setOtherName] = useState('');

  function commitOther(kind: 'goal' | 'ownGoal' | 'yellow' | 'red') {
    const trimmed = otherName.trim();
    if (!trimmed) return;
    const picked: PickedPlayer = { name: trimmed };
    if (kind === 'goal') onGoal(picked);
    else if (kind === 'ownGoal') onGoal(picked, { ownGoal: true });
    else if (kind === 'yellow') onCard('yellowCard', picked);
    else onCard('redCard', picked);
    setOtherName('');
    setOtherOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-surface-1 shadow-elevated"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[0.65rem] uppercase tracking-wide text-ink-tertiary">
              {sr.match.actions.addGoal} · karton
            </span>
            <span className="font-display text-base font-700 text-ink-primary">
              {teamName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-ink-secondary hover:bg-surface-2"
            aria-label={sr.common.close}
          >
            <X size={18} />
          </button>
        </header>

        <ul className="flex-1 overflow-y-auto px-3 py-3">
          {players.length === 0 ? (
            <li className="rounded-md bg-surface-2 px-3 py-4 text-center text-sm italic text-ink-tertiary">
              Nema igrača u rosteru. Koristi <strong>Drugi</strong> ispod.
            </li>
          ) : (
            players.map((p) => {
              const picked: PickedPlayer = { id: p.id, name: p.displayName };
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 border-b border-surface-3 py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-primary">
                    {p.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onGoal(picked)}
                    className="h-10 min-w-[3rem] rounded-md bg-brand-600 px-3 text-sm font-700 text-ink-primary active:bg-brand-500"
                    aria-label={sr.match.actions.addGoal}
                  >
                    ⚽
                  </button>
                  <button
                    type="button"
                    onClick={() => onGoal(picked, { ownGoal: true })}
                    className="h-10 min-w-[3rem] rounded-md bg-surface-3 px-3 text-[0.7rem] font-700 uppercase tracking-wide text-ink-secondary active:bg-surface-2"
                    aria-label="Autogol"
                    title="Autogol"
                  >
                    AG
                  </button>
                  <button
                    type="button"
                    onClick={() => onCard('yellowCard', picked)}
                    className="h-10 min-w-[3rem] rounded-md bg-warning-soft px-3 text-sm font-700 text-warning active:opacity-90"
                    aria-label="Žuti karton"
                  >
                    🟨
                  </button>
                  <button
                    type="button"
                    onClick={() => onCard('redCard', picked)}
                    className="h-10 min-w-[3rem] rounded-md bg-danger-soft px-3 text-sm font-700 text-danger active:opacity-90"
                    aria-label="Crveni karton"
                  >
                    🟥
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="border-t border-surface-3 px-3 py-3">
          {otherOpen ? (
            <div className="flex flex-col gap-2">
              <input
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="Ime i prezime"
                autoFocus
                className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!otherName.trim()}
                  onClick={() => commitOther('goal')}
                  className="h-touch flex-1 rounded-md bg-brand-600 px-3 text-sm font-700 text-ink-primary disabled:opacity-60"
                >
                  ⚽ {sr.match.actions.addGoal}
                </button>
                <button
                  type="button"
                  disabled={!otherName.trim()}
                  onClick={() => commitOther('ownGoal')}
                  className="h-touch min-w-[3.5rem] rounded-md bg-surface-3 px-3 text-[0.7rem] font-700 uppercase tracking-wide text-ink-secondary disabled:opacity-60"
                  aria-label="Autogol"
                  title="Autogol"
                >
                  AG
                </button>
                <button
                  type="button"
                  disabled={!otherName.trim()}
                  onClick={() => commitOther('yellow')}
                  className="h-touch min-w-[3.5rem] rounded-md bg-warning-soft px-3 text-sm font-700 text-warning disabled:opacity-60"
                  aria-label="Žuti karton"
                >
                  🟨
                </button>
                <button
                  type="button"
                  disabled={!otherName.trim()}
                  onClick={() => commitOther('red')}
                  className="h-touch min-w-[3.5rem] rounded-md bg-danger-soft px-3 text-sm font-700 text-danger disabled:opacity-60"
                  aria-label="Crveni karton"
                >
                  🟥
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOtherOpen(true)}
              className="h-touch w-full rounded-md border border-dashed border-surface-4 text-sm text-ink-secondary hover:bg-surface-2"
            >
              + Drugi (unesi ručno)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  match,
  canDelete,
  onDelete,
}: {
  event: MatchEvent;
  match: Match;
  canDelete: boolean;
  onDelete: () => void;
}) {
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
      {canDelete ? (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Obrisati: ${label}${event.playerName ? ` — ${event.playerName}` : ''}?`)) return;
            onDelete();
          }}
          className="rounded-md p-2 text-ink-tertiary hover:bg-surface-2 hover:text-danger"
          aria-label="Obriši događaj"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
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

// ---------------------------------------------------------------------------

function badgeForStatus(match: Match): {
  label: string;
  cls: string;
  dot?: boolean;
  dotCls?: string;
} {
  if (match.status === 'scheduled') {
    return { label: 'Zakazana', cls: 'bg-surface-2 text-ink-secondary' };
  }
  if (match.status === 'finished') {
    return { label: 'Završena', cls: 'bg-surface-2 text-ink-secondary' };
  }
  if (match.status === 'abandoned') {
    return { label: 'Prekinuta', cls: 'bg-danger-soft text-danger' };
  }
  // live
  if (match.clock.state === 'paused') {
    return { label: 'Pauzirano', cls: 'bg-warning-soft text-warning' };
  }
  if (match.clock.state === 'halftime') {
    return { label: 'Poluvreme', cls: 'bg-warning-soft text-warning' };
  }
  return {
    label: 'Uživo',
    cls: 'bg-live-soft text-live',
    dot: true,
    dotCls: 'bg-live animate-pulse',
  };
}
