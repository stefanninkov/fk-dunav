import { useEffect, useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import {
  matchesCol,
  playersCol,
  teamDoc,
} from '@/lib/firestore/refs';
import type { Match, Player, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const active = useTournamentStore((s) => s.active);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!active || !teamId) return;
    const unsubTeam = onSnapshot(teamDoc(active.id, teamId), (snap) => {
      setTeam(snap.exists() ? snap.data() : null);
    });
    const unsubPlayers = onSnapshot(
      query(
        playersCol(active.id),
        where('teamId', '==', teamId),
        where('active', '==', true),
      ),
      (snap) => setPlayers(snap.docs.map((d) => d.data())),
    );
    const unsubMatches = onSnapshot(
      query(matchesCol(active.id), orderBy('scheduledStart', 'asc')),
      (snap) => setMatches(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubTeam();
      unsubPlayers();
      unsubMatches();
    };
  }, [active, teamId]);

  const teamMatches = useMemo(
    () =>
      teamId
        ? matches.filter(
            (m) => m.teamA.teamId === teamId || m.teamB.teamId === teamId,
          )
        : [],
    [matches, teamId],
  );

  if (!active) {
    return <PagePlaceholder title={sr.nav.teams} description="Čeka se aktivan turnir." />;
  }
  if (!team) {
    return <PagePlaceholder title={sr.nav.teams} description={sr.common.loading} />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <NavLink to="/timovi" className="text-sm text-ink-secondary hover:text-ink-primary">
        ← {sr.nav.teams}
      </NavLink>

      <header className="mt-4 flex items-center gap-4">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="h-16 w-16 rounded" />
        ) : (
          <div
            className="h-16 w-16 rounded"
            style={{ backgroundColor: team.color ?? 'var(--color-surface-3)' }}
          />
        )}
        <div>
          <h1 className="font-display text-3xl font-700">{team.name}</h1>
          {team.captainName ? (
            <p className="text-sm text-ink-tertiary">Kapiten: {team.captainName}</p>
          ) : null}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-600">Roster</h2>
          {players.length === 0 ? (
            <p className="text-sm text-ink-secondary">Nema unosa u sastavu.</p>
          ) : (
            <ul className="flex flex-col gap-1 rounded-lg bg-surface-1 p-3 shadow-card">
              {players.map((p) => (
                <li key={p.id}>
                  <NavLink
                    to={`/igrac/${p.id}`}
                    className="flex items-center gap-3 rounded px-2 py-2 text-ink-primary hover:bg-surface-2"
                  >
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-xs">
                        {p.firstName[0]}
                        {p.lastName[0]}
                      </span>
                    )}
                    <span>{p.displayName}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-600">Utakmice</h2>
          {teamMatches.length === 0 ? (
            <p className="text-sm text-ink-secondary">Nema zakazanih utakmica.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {teamMatches.map((m) => {
                const isHome = m.teamA.teamId === teamId;
                const opp = isHome ? m.teamB : m.teamA;
                const finished = m.status === 'finished';
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 text-sm shadow-card"
                  >
                    <span className="w-20 text-xs text-ink-tertiary">
                      {m.scheduledStart.toDate().toLocaleDateString('sr-RS', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span className="flex-1">
                      <span className="text-ink-tertiary">{isHome ? 'vs' : '@'}</span>{' '}
                      {opp.name}
                    </span>
                    {finished ? (
                      <span className="tnum font-display font-700">
                        {isHome ? m.score.a : m.score.b}:{isHome ? m.score.b : m.score.a}
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
                        {sr.match.status[m.status]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
