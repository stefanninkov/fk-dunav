import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';

import { kupSankaCol } from '@/lib/firestore/refs';
import type { KupSankaEntry } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import {
  createKupSankaEntry,
  deleteKupSankaEntry,
  setBokala,
  updateKupSankaEntry,
} from '@/features/kupSanka/kupSankaActions';

/**
 * Free-form participant tracker. Entries are not tied to tournament teams —
 * admin types any name (a visiting team, a friend, a group, etc.), tracks
 * bokala with +/- buttons. Sorted live by bokala desc so the leader is at
 * the top and the public Kup Šanka page + awards page can read the same
 * order.
 */
export function KupSankaPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [entries, setEntries] = useState<KupSankaEntry[]>([]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');

  useEffect(() => {
    if (!active) return;
    return onSnapshot(kupSankaCol(active.id), (snap) => {
      setEntries(
        snap.docs
          .map((d) => d.data())
          .sort((a, b) => b.bokala - a.bokala || a.name.localeCompare(b.name, 'sr')),
      );
    });
  }, [active]);

  async function add() {
    if (!active || !uid || !name.trim()) return;
    setBusy(true);
    try {
      await createKupSankaEntry(active.id, { name, note: note || undefined }, uid);
      setName('');
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  async function change(entry: KupSankaEntry, delta: number) {
    if (!active || !uid) return;
    await setBokala(active.id, entry.id, entry.bokala + delta, uid);
  }

  async function remove(id: string) {
    if (!active || !confirm(sr.admin.kupSanka.confirmDelete)) return;
    await deleteKupSankaEntry(active.id, id);
  }

  function startEdit(entry: KupSankaEntry) {
    setEditingId(entry.id);
    setEditName(entry.name);
    setEditNote(entry.note ?? '');
  }

  async function saveEdit() {
    if (!active || !uid || !editingId) return;
    await updateKupSankaEntry(
      active.id,
      editingId,
      { name: editName, note: editNote },
      uid,
    );
    setEditingId(null);
  }

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.kupSanka.title}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.kupSanka.title}</h1>

      <div className="grid grid-cols-1 gap-2 rounded-lg bg-surface-1 p-4 shadow-card sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={sr.admin.kupSanka.namePlaceholder}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={sr.admin.kupSanka.notePlaceholder}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !name.trim()}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          {sr.admin.kupSanka.newButton}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.kupSanka.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e, idx) => {
            const isEditing = editingId === e.id;
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
              >
                <span className="tnum w-6 font-display text-lg font-700 text-brand-400">
                  {idx + 1}.
                </span>
                {isEditing ? (
                  <>
                    <input
                      value={editName}
                      onChange={(ev) => setEditName(ev.target.value)}
                      className="h-10 min-w-[8rem] flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
                    />
                    <input
                      value={editNote}
                      onChange={(ev) => setEditNote(ev.target.value)}
                      placeholder={sr.admin.kupSanka.notePlaceholder}
                      className="h-10 min-w-[8rem] flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-600 text-ink-primary hover:bg-brand-500"
                    >
                      {sr.common.save}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2"
                    >
                      {sr.common.cancel}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-[8rem] flex-1 flex-col">
                      <span className="font-500 text-ink-primary">{e.name}</span>
                      {e.note ? (
                        <span className="text-xs text-ink-tertiary">{e.note}</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void change(e, -1)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border border-surface-4 text-ink-secondary hover:bg-surface-2"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="tnum w-10 text-center font-display text-xl font-700">
                      {e.bokala}
                    </span>
                    <button
                      type="button"
                      onClick={() => void change(e, 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-ink-primary hover:bg-brand-500"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      className="rounded-md p-2 text-ink-secondary hover:bg-surface-2"
                      title={sr.common.edit}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(e.id)}
                      className="rounded-md p-2 text-ink-tertiary hover:bg-surface-2 hover:text-danger"
                      title={sr.common.delete}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
