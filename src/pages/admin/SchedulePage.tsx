import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { groupsCol, matchesCol, teamsCol } from '@/lib/firestore/refs';
import type { Group, Match, Team, TeamSnapshot } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { createMatch } from '@/features/match/matchActions';

const schema = z
  .object({
    teamAId: z.string().min(1, sr.common.required),
    teamBId: z.string().min(1, sr.common.required),
    field: z.string().min(1, sr.common.required),
    groupId: z.string().min(1, sr.common.required),
    scheduledStart: z.string().min(1, sr.common.required),
  })
  .refine((v) => v.teamAId !== v.teamBId, {
    path: ['teamBId'],
    message: 'Timovi moraju biti različiti',
  });

type FormValues = z.infer<typeof schema>;

export function SchedulePage() {
  const active = useTournamentStore((s) => s.active);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setMatches(null);
      return;
    }
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null), orderBy('name', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    const unsubGroups = onSnapshot(
      query(groupsCol(active.id), orderBy('order', 'asc')),
      (snap) => setGroups(snap.docs.map((d) => d.data())),
    );
    const unsubMatches = onSnapshot(
      query(matchesCol(active.id), orderBy('scheduledStart', 'asc')),
      (snap) => setMatches(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    return () => {
      unsubTeams();
      unsubGroups();
      unsubMatches();
    };
  }, [active]);

  const grouped = useMemo(() => {
    const out = new Map<string, Match[]>();
    if (!matches) return out;
    for (const m of matches) {
      const day = m.scheduledStart.toDate().toISOString().slice(0, 10);
      const list = out.get(day) ?? [];
      list.push(m);
      out.set(day, list);
    }
    return out;
  }, [matches]);

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.schedule}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.schedule}</h1>
      </header>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      <AddMatchForm
        tournamentId={active.id}
        teams={teams}
        groups={groups}
        fields={active.config.fields}
      />

      {matches === null ? (
        <p className="text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-secondary">
          {sr.common.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...grouped.entries()].map(([day, dayMatches]) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="font-display text-sm font-600 text-ink-secondary">
                {new Date(day).toLocaleDateString('sr-RS', {
                  day: 'numeric',
                  month: 'long',
                  weekday: 'long',
                })}
              </h2>
              <ul className="flex flex-col gap-2">
                {dayMatches.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function MatchRow({ match }: { match: Match }) {
  const time = match.scheduledStart.toDate().toLocaleTimeString('sr-RS', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <li className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card">
      <span className="tnum w-14 text-ink-secondary">{time}</span>
      <span className="text-xs text-ink-tertiary">{match.field}</span>
      <div className="ml-2 flex-1 items-center text-ink-primary">
        <span className="font-500">{match.teamA.name}</span>
        <span className="mx-2 text-ink-tertiary">vs</span>
        <span className="font-500">{match.teamB.name}</span>
      </div>
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
        {sr.match.status[match.status]}
      </span>
    </li>
  );
}

function AddMatchForm({
  tournamentId,
  teams,
  groups,
  fields,
}: {
  tournamentId: string;
  teams: Team[];
  groups: Group[];
  fields: string[];
}) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      teamAId: teams[0]?.id,
      teamBId: teams[1]?.id,
      field: fields[0],
      groupId: groups[0]?.id,
      scheduledStart: '',
    },
  });

  async function onSubmit(v: FormValues) {
    setError(null);
    const a = teams.find((t) => t.id === v.teamAId);
    const b = teams.find((t) => t.id === v.teamBId);
    if (!a || !b) {
      setError('Neispravan tim');
      return;
    }
    // Firestore rejects undefined field values, so build the snapshot
    // conditionally — optional team fields are only added when populated.
    const snap = (team: Team): TeamSnapshot => {
      const out: TeamSnapshot = {
        teamId: team.id,
        name: team.name,
        groupId: team.groupId,
      };
      if (team.shortName) out.shortName = team.shortName;
      if (team.logoUrl) out.logoUrl = team.logoUrl;
      return out;
    };
    try {
      await createMatch(tournamentId, {
        phase: 'group',
        groupId: v.groupId,
        field: v.field,
        scheduledStart: new Date(v.scheduledStart),
        teamA: snap(a),
        teamB: snap(b),
      });
      reset({ ...v, scheduledStart: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    }
  }

  if (teams.length < 2 || groups.length === 0 || fields.length === 0) {
    return (
      <p className="rounded-md bg-surface-1 px-4 py-3 text-sm text-ink-secondary">
        Prvo dodaj grupe i bar dva tima.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-1 gap-2 rounded-lg bg-surface-1 p-4 shadow-card sm:grid-cols-6"
    >
      <select className={inputClass} {...register('teamAId')}>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select className={inputClass} {...register('teamBId')}>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select className={inputClass} {...register('field')}>
        {fields.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select className={inputClass} {...register('groupId')}>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <input type="datetime-local" className={inputClass} {...register('scheduledStart')} />
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
      >
        <Plus size={16} />
        {sr.common.create}
      </button>
      {(errors.teamBId || errors.scheduledStart || error) && (
        <p className="text-xs text-danger sm:col-span-6">
          {errors.teamBId?.message ?? errors.scheduledStart?.message ?? error}
        </p>
      )}
    </form>
  );
}

const inputClass =
  'h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500';
