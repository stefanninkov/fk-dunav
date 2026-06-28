import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { groupsCol, teamsCol } from '@/lib/firestore/refs';
import type { Group, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function TeamsPage() {
  const active = useTournamentStore((s) => s.active);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null), orderBy('name', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    const unsubGroups = onSnapshot(
      query(groupsCol(active.id), orderBy('order', 'asc')),
      (snap) => setGroups(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubTeams();
      unsubGroups();
    };
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.teams} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.teams}</h1>

      {teams === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : teams.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.empty}</p>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {groups.map((g) => {
            const list = teams.filter((t) => t.groupId === g.id);
            if (list.length === 0) return null;
            return (
              <section key={g.id}>
                <h2 className="mb-3 font-display text-xl font-600">{g.name}</h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => (
                    <li key={t.id}>
                      <NavLink
                        to={`/tim/${t.id}`}
                        className="flex items-center gap-3 rounded-lg bg-surface-1 p-4 shadow-card transition-shadow hover:shadow-card-hov"
                      >
                        {t.logoUrl ? (
                          <img src={t.logoUrl} alt={t.name} className="h-10 w-10 rounded" />
                        ) : (
                          <div
                            className="h-10 w-10 rounded"
                            style={{ backgroundColor: t.color ?? 'var(--color-surface-3)' }}
                          />
                        )}
                        <div className="flex flex-col">
                          <span className="font-500 text-ink-primary">{t.name}</span>
                          {t.captainName ? (
                            <span className="text-xs text-ink-tertiary">Kapiten: {t.captainName}</span>
                          ) : null}
                        </div>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
