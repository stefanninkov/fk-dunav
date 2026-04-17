import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { playersCol, teamsCol } from '@/lib/firestore/refs';
import type { Player, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { createPlayer, setPlayerActive } from '@/features/player/playerActions';

const playerSchema = z.object({
  firstName: z.string().min(1, sr.common.required),
  lastName: z.string().min(1, sr.common.required),
  teamId: z.string().min(1, sr.common.required),
});
type PlayerForm = z.infer<typeof playerSchema>;

export function PlayersPage() {
  const active = useTournamentStore((s) => s.active);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [filterTeamId, setFilterTeamId] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setTeams([]);
      setPlayers(null);
      return;
    }
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null), orderBy('name', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    const unsubPlayers = onSnapshot(
      query(playersCol(active.id), orderBy('lastName', 'asc')),
      (snap) => setPlayers(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    return () => {
      unsubTeams();
      unsubPlayers();
    };
  }, [active]);

  const filtered = useMemo(() => {
    if (!players) return null;
    if (filterTeamId === 'all') return players;
    return players.filter((p) => p.teamId === filterTeamId);
  }, [players, filterTeamId]);

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.players}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.players}</h1>
        <select
          value={filterTeamId}
          onChange={(e) => setFilterTeamId(e.target.value)}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-sm text-ink-primary"
        >
          <option value="all">Svi timovi</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </header>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      <AddPlayerInline tournamentId={active.id} teams={teams} />

      {filtered === null ? (
        <p className="text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-secondary">
          {sr.common.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PlayerRow key={p.id} tournamentId={active.id} player={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AddPlayerInline({ tournamentId, teams }: { tournamentId: string; teams: Team[] }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlayerForm>({
    resolver: zodResolver(playerSchema),
    defaultValues: { firstName: '', lastName: '', teamId: teams[0]?.id ?? '' },
  });

  async function onSubmit(v: PlayerForm) {
    const team = teams.find((t) => t.id === v.teamId);
    if (!team) {
      setError('Izaberi tim');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPlayer(tournamentId, {
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        teamId: team.id,
        teamName: team.name,
      });
      reset({ firstName: '', lastName: '', teamId: team.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  if (teams.length === 0) {
    return (
      <p className="rounded-md bg-surface-1 px-4 py-3 text-sm text-ink-secondary">
        Prvo dodaj timove da bi mogao da uneseš igrače.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-2 rounded-lg bg-surface-1 p-4 shadow-card sm:flex-row"
    >
      <input
        placeholder="Ime"
        className="h-touch flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        {...register('firstName')}
      />
      <input
        placeholder="Prezime"
        className="h-touch flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        {...register('lastName')}
      />
      <select
        className="h-touch flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
        {...register('teamId')}
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
      >
        <Plus size={16} />
        {sr.common.create}
      </button>
      {(errors.firstName || errors.lastName || error) && (
        <p className="ml-2 self-center text-xs text-danger sm:col-span-4">
          {errors.firstName?.message ?? errors.lastName?.message ?? error}
        </p>
      )}
    </form>
  );
}

function PlayerRow({ tournamentId, player }: { tournamentId: string; player: Player }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await setPlayerActive(tournamentId, player.id, !player.active);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card">
      <div className="flex flex-col">
        <span className={`font-500 ${player.active ? 'text-ink-primary' : 'text-ink-tertiary line-through'}`}>
          {player.displayName}
        </span>
        <span className="text-xs text-ink-tertiary">{player.teamName}</span>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
      >
        {player.active ? 'Deaktiviraj' : 'Aktiviraj'}
      </button>
    </li>
  );
}
