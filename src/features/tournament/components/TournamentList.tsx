import { useState } from 'react';

import type { Tournament } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import {
  activateTournament,
  archiveTournament,
} from '@/features/tournament/tournamentActions';

interface Props {
  tournaments: Tournament[];
}

export function TournamentList({ tournaments }: Props) {
  if (tournaments.length === 0) {
    return (
      <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-secondary">
        {sr.admin.tournament.noActive}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tournaments.map((t) => (
        <TournamentRow key={t.id} tournament={t} />
      ))}
    </ul>
  );
}

function TournamentRow({ tournament }: { tournament: Tournament }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    if (!confirm(sr.admin.tournament.activationNotice)) return;
    setBusy(true);
    setError(null);
    try {
      await activateTournament(tournament.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);
    setError(null);
    try {
      await archiveTournament(tournament.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-600 text-ink-primary">{tournament.name}</h2>
          <StatusBadge status={tournament.status} />
        </div>
        <p className="text-xs text-ink-tertiary">
          {tournament.year} · {tournament.edition}. izdanje · {tournament.location.name}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {error ? <span className="text-xs text-danger">{error}</span> : null}
        {tournament.status !== 'active' ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleActivate}
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
          >
            {sr.admin.tournament.activate}
          </button>
        ) : null}
        {tournament.status !== 'archived' ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleArchive}
            className="rounded-md border border-surface-4 px-3 py-2 text-sm text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
          >
            {sr.admin.tournament.archive}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Tournament['status'] }) {
  const map: Record<Tournament['status'], { label: string; className: string }> = {
    active: {
      label: sr.admin.tournament.activeBadge,
      className: 'bg-success-soft text-success',
    },
    draft: {
      label: sr.admin.tournament.draftBadge,
      className: 'bg-warning-soft text-warning',
    },
    archived: {
      label: sr.admin.tournament.archivedBadge,
      className: 'bg-surface-3 text-ink-tertiary',
    },
  };
  const { label, className } = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-500 ${className}`}>{label}</span>
  );
}
