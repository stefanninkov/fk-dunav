import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

import type { Group, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import {
  createGroup,
  deleteGroup,
  renameGroup,
} from '@/features/tournament/tournamentActions';

interface Props {
  tournamentId: string;
  groups: Group[];
  /** Used to block deleting a group that still has teams in it. */
  teams?: Team[];
}

/**
 * CRUD on the per-tournament group list. Inline edit (Pencil → input
 * + ✓ confirm) and delete (Trash2 → confirm dialog). Deleting a group
 * is blocked if any team is still assigned to it; the admin has to
 * reassign or drop those teams first.
 */
export function GroupsPanel({ tournamentId, groups, teams = [] }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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

  function startEdit(g: Group) {
    setEditingId(g.id);
    setEditName(g.name);
  }

  async function saveEdit(g: Group) {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === g.name) {
      setEditingId(null);
      return;
    }
    try {
      await renameGroup(tournamentId, g.id, trimmed);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    }
  }

  async function handleDelete(g: Group) {
    const memberCount = teams.filter(
      (t) => !t.deletedAt && t.groupId === g.id,
    ).length;
    if (memberCount > 0) {
      alert(
        `Grupa "${g.name}" ima ${memberCount} ${
          memberCount === 1 ? 'tim' : 'timova'
        }. Prvo prebaci ili obriši timove iz nje.`,
      );
      return;
    }
    if (!confirm(`Obrisati grupu "${g.name}"?`)) return;
    try {
      await deleteGroup(tournamentId, g.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4 shadow-card">
      <h2 className="font-display text-sm font-600 text-ink-secondary uppercase tracking-wide">
        {sr.admin.groups.title}
      </h2>

      {groups.length === 0 ? (
        <p className="text-sm text-ink-tertiary">{sr.admin.groups.empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const isEditing = editingId === g.id;
            return (
              <li
                key={g.id}
                className="flex items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1 py-1 text-sm text-ink-primary"
              >
                {isEditing ? (
                  <>
                    <input
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveEdit(g);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="h-8 rounded-md border border-surface-4 bg-surface-0 px-2 text-sm text-ink-primary outline-none focus:border-brand-500"
                      size={Math.max(6, editName.length)}
                    />
                    <button
                      type="button"
                      onClick={() => void saveEdit(g)}
                      aria-label={sr.common.save}
                      className="rounded-full p-1.5 text-brand-300 hover:bg-surface-3"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label={sr.common.cancel}
                      className="rounded-full p-1.5 text-ink-tertiary hover:bg-surface-3"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span>{g.name}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(g)}
                      aria-label={sr.common.edit}
                      className="rounded-full p-1.5 text-ink-tertiary hover:bg-surface-3 hover:text-ink-primary"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(g)}
                      aria-label={sr.common.delete}
                      className="rounded-full p-1.5 text-ink-tertiary hover:bg-surface-3 hover:text-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={sr.admin.groups.newPlaceholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) void handleAdd();
          }}
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
