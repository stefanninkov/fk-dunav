import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Plus } from 'lucide-react';

import { tournamentsCol } from '@/lib/firestore/refs';
import type { Tournament } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { TournamentList } from '@/features/tournament/components/TournamentList';
import { TournamentForm } from '@/features/tournament/components/TournamentForm';

export function TournamentPage() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(tournamentsCol(), orderBy('year', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => setTournaments(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    return unsub;
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.tournament.title}</h1>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex h-touch items-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500"
        >
          <Plus size={18} />
          {sr.admin.tournament.newButton}
        </button>
      </header>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      {tournaments === null ? (
        <p className="text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : (
        <TournamentList tournaments={tournaments} />
      )}

      {formOpen ? <TournamentForm onClose={() => setFormOpen(false)} /> : null}
    </section>
  );
}
