import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Plus } from 'lucide-react';

import { groupsCol, teamsCol } from '@/lib/firestore/refs';
import type { Group, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { GroupsPanel } from '@/features/team/components/GroupsPanel';
import { TeamList } from '@/features/team/components/TeamList';
import { TeamEditor } from '@/features/team/components/TeamEditor';
import { GroupDrawPanel } from '@/features/team/components/GroupDrawPanel';

export function TeamsPage() {
  const active = useTournamentStore((s) => s.active);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setGroups(null);
      setTeams(null);
      return;
    }
    const unsubGroups = onSnapshot(
      query(groupsCol(active.id), orderBy('order', 'asc')),
      (snap) => setGroups(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null), orderBy('name', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    return () => {
      unsubGroups();
      unsubTeams();
    };
  }, [active]);

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.teams.title}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.teams.title}</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex h-touch items-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={18} />
          {sr.admin.teams.newButton}
        </button>
      </header>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      <GroupsPanel
        tournamentId={active.id}
        groups={groups ?? []}
        teams={teams ?? []}
      />

      {teams === null ? (
        <p className="text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : (
        <TeamList
          teams={teams}
          groups={groups ?? []}
          tournamentId={active.id}
          onEdit={(team) => setEditing(team)}
        />
      )}

      {teams !== null ? (
        <GroupDrawPanel
          tournamentId={active.id}
          groups={groups ?? []}
          teams={teams}
        />
      ) : null}

      {editing ? (
        <TeamEditor
          tournamentId={active.id}
          groups={groups ?? []}
          team={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
