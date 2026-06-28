import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { groupsCol, matchesCol, teamsCol } from '@/lib/firestore/refs';
import type { Group, Match, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { computeStandings, sortStandings } from '@/lib/utils/standings';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function GroupsPage() {
  const active = useTournamentStore((s) => s.active);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    const unsubGroups = onSnapshot(
      query(groupsCol(active.id), orderBy('order', 'asc')),
      (snap) => setGroups(snap.docs.map((d) => d.data())),
    );
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null)),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    const unsubMatches = onSnapshot(matchesCol(active.id), (snap) => {
      setMatches(snap.docs.map((d) => d.data()));
      setLoading(false);
    });
    return () => {
      unsubGroups();
      unsubTeams();
      unsubMatches();
    };
  }, [active]);

  const tables = useMemo(() => {
    if (!active) return [];
    return groups.map((g) => {
      const groupTeams = teams.filter((t) => t.groupId === g.id);
      const raw = computeStandings({ teams: groupTeams, matches });
      return {
        group: g,
        rows: sortStandings({
          standings: raw,
          matches,
          order: active.config.tiebreakerOrder,
          manualOrder: g.manualOrder,
        }),
      };
    });
  }, [groups, teams, matches, active]);

  if (!active) {
    return (
      <PagePlaceholder
        title={sr.nav.groups}
        description="Čeka se aktivan turnir."
      />
    );
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.groups}</h1>

      {loading ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : groups.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.empty}</p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {tables.map(({ group, rows }) => (
            <StandingsTable
              key={group.id}
              group={group}
              rows={rows}
              qualifiers={active.config.qualifiersPerGroup}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StandingsTable({
  group,
  rows,
  qualifiers,
}: {
  group: Group;
  rows: ReturnType<typeof sortStandings>;
  qualifiers: number;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-600">{group.name}</h2>
      <div className="overflow-x-auto rounded-lg bg-surface-1 shadow-card">
        <table className="tnum w-full text-sm">
          <thead className="text-xs uppercase text-ink-tertiary">
            <tr>
              <Th className="pl-4">#</Th>
              <Th className="text-left">Tim</Th>
              <Th>O</Th>
              <Th>P</Th>
              <Th>N</Th>
              <Th>I</Th>
              <Th>GD:GP</Th>
              <Th>GR</Th>
              <Th>Bod</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.teamId}
                className="border-t border-surface-3 text-ink-primary"
              >
                <td
                  className={`pl-4 py-3 font-600 ${
                    r.rank <= qualifiers ? 'text-brand-400' : ''
                  }`}
                >
                  {r.rank}
                </td>
                <td className="py-3 text-left">
                  <div className="flex items-center gap-2">
                    {r.teamLogoUrl ? (
                      <img
                        src={r.teamLogoUrl}
                        alt=""
                        className="h-6 w-6 rounded"
                      />
                    ) : null}
                    <span>{r.teamName}</span>
                  </div>
                </td>
                <Td>{r.played}</Td>
                <Td>{r.wins}</Td>
                <Td>{r.draws}</Td>
                <Td>{r.losses}</Td>
                <Td>
                  {r.goalsFor}:{r.goalsAgainst}
                </Td>
                <Td>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</Td>
                <Td className="font-700">{r.points}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-tertiary">
        Plavom bojom označeni su timovi koji prolaze u nokaut fazu (prvih {qualifiers} iz grupe).
      </p>
    </section>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2 text-center font-500 ${className ?? ''}`}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3 text-center ${className ?? ''}`}>{children}</td>;
}
