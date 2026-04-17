import { useState } from 'react';
import { Plus } from 'lucide-react';

import type { Group } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { createGroup } from '@/features/tournament/tournamentActions';

interface Props {
  tournamentId: string;
  groups: Group[];
}

export function GroupsPanel({ tournamentId, groups }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await createGroup(tournamentId, trimmed, groups.length);
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4 shadow-card">
      <h2 className="font-display text-sm font-600 text-ink-secondary uppercase tracking-wide">
        {sr.admin.groups.title}
      </h2>

      <div className="flex flex-wrap gap-2">
        {groups.length === 0 ? (
          <p className="text-sm text-ink-tertiary">{sr.admin.groups.empty}</p>
        ) : (
          groups.map((g) => (
            <span
              key={g.id}
              className="rounded-full bg-surface-2 px-3 py-1 text-sm text-ink-primary"
            >
              {g.name}
            </span>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={sr.admin.groups.newPlaceholder}
          className="h-touch flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || !name.trim()}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          {sr.admin.groups.addButton}
        </button>
      </div>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}
    </section>
  );
}
