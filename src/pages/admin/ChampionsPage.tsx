import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { championDoc, championsCol } from '@/lib/firestore/refs';
import type { Champion } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Champions history editor. Doc id is the year as string so the collection
 * sorts naturally and there's never more than one entry per edition. The
 * public /sampioni page renders the same collection chronologically.
 */
export function ChampionsPage() {
  const uid = useAuthStore((s) => s.uid);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [editing, setEditing] = useState<Champion | 'new' | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(championsCol(), orderBy('year', 'desc')),
      (snap) => setChampions(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, []);

  async function remove(year: string) {
    if (!confirm(sr.common.delete + '?')) return;
    await deleteDoc(championDoc(year));
  }

  if (!uid) return null;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.champions.title}</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex h-touch items-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500"
        >
          <Plus size={16} />
          {sr.admin.champions.newButton}
        </button>
      </header>

      {champions.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
          {sr.admin.champions.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {champions.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
            >
              <span className="tnum w-16 shrink-0 font-display text-lg font-700 text-brand-400">
                {c.year}
              </span>
              <div className="flex min-w-[10rem] flex-1 flex-col">
                <span className="font-500 text-ink-primary">{c.championTeamName}</span>
                {c.tournamentName ? (
                  <span className="text-xs text-ink-tertiary">{c.tournamentName}</span>
                ) : null}
              </div>
              {c.mvpPlayerName ? (
                <span className="text-xs text-ink-tertiary">MVP: {c.mvpPlayerName}</span>
              ) : null}
              <button
                type="button"
                onClick={() => setEditing(c)}
                className="rounded-md p-2 text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
                title={sr.common.edit}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => void remove(c.id)}
                className="rounded-md p-2 text-ink-tertiary hover:bg-surface-2 hover:text-danger"
                title={sr.common.delete}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ChampionDialog
          initial={editing === 'new' ? null : editing}
          uid={uid}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------

type FormState = {
  year: string;
  edition: string;
  tournamentName: string;
  championTeamName: string;
  championLogoUrl: string;
  runnerUpTeamName: string;
  thirdPlaceTeamName: string;
  mvpPlayerName: string;
  topScorerName: string;
  notes: string;
};

function toFormState(c: Champion | null): FormState {
  return {
    year: c?.year?.toString() ?? '',
    edition: c?.edition?.toString() ?? '',
    tournamentName: c?.tournamentName ?? '',
    championTeamName: c?.championTeamName ?? '',
    championLogoUrl: c?.championLogoUrl ?? '',
    runnerUpTeamName: c?.runnerUpTeamName ?? '',
    thirdPlaceTeamName: c?.thirdPlaceTeamName ?? '',
    mvpPlayerName: c?.mvpPlayerName ?? '',
    topScorerName: c?.topScorerName ?? '',
    notes: c?.notes ?? '',
  };
}

function ChampionDialog({
  initial,
  uid,
  onClose,
}: {
  initial: Champion | null;
  uid: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(toFormState(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setError(null);
    const yearNum = Number(form.year);
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      setError(sr.common.errorGeneric);
      return;
    }
    if (!form.championTeamName.trim()) {
      setError(sr.common.required);
      return;
    }
    setBusy(true);
    try {
      const docId = form.year;
      const editionNum = form.edition ? Number(form.edition) : NaN;
      const payload: Record<string, unknown> = {
        year: yearNum,
        championTeamName: form.championTeamName.trim(),
        createdAt: initial?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      };
      const put = (key: string, value: string | number | undefined) => {
        if (value === undefined) return;
        if (typeof value === 'string') {
          if (value) payload[key] = value;
        } else if (Number.isFinite(value)) {
          payload[key] = value;
        }
      };
      put('edition', Number.isInteger(editionNum) ? editionNum : undefined);
      put('tournamentName', form.tournamentName.trim());
      put('championLogoUrl', form.championLogoUrl.trim());
      put('runnerUpTeamName', form.runnerUpTeamName.trim());
      put('thirdPlaceTeamName', form.thirdPlaceTeamName.trim());
      put('mvpPlayerName', form.mvpPlayerName.trim());
      put('topScorerName', form.topScorerName.trim());
      put('notes', form.notes.trim());
      await setDoc(championDoc(docId), payload as unknown as Champion, { merge: true });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/80 px-4 py-10">
      <div className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-lg bg-surface-1 p-6 shadow-elevated">
        <header className="flex items-center justify-between">
          <h2 className="font-display text-lg font-600">
            {initial ? sr.common.edit : sr.admin.champions.newButton}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-ink-secondary hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={sr.admin.champions.form.year} required>
            <input
              type="number"
              value={form.year}
              onChange={(e) => set('year', e.target.value)}
              disabled={!!initial}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary disabled:opacity-70"
            />
          </Field>
          <Field label={sr.admin.champions.form.edition}>
            <input
              type="number"
              value={form.edition}
              onChange={(e) => set('edition', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
          <Field label={sr.admin.champions.form.tournamentName}>
            <input
              value={form.tournamentName}
              onChange={(e) => set('tournamentName', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
          <Field label={sr.admin.champions.form.championTeamName} required>
            <input
              value={form.championTeamName}
              onChange={(e) => set('championTeamName', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
          <Field label={sr.admin.champions.form.championLogoUrl}>
            <input
              value={form.championLogoUrl}
              onChange={(e) => set('championLogoUrl', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
          <Field label={sr.admin.champions.form.runnerUpTeamName}>
            <input
              value={form.runnerUpTeamName}
              onChange={(e) => set('runnerUpTeamName', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
          <Field label={sr.admin.champions.form.thirdPlaceTeamName}>
            <input
              value={form.thirdPlaceTeamName}
              onChange={(e) => set('thirdPlaceTeamName', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
          <Field label={sr.admin.champions.form.mvpPlayerName}>
            <input
              value={form.mvpPlayerName}
              onChange={(e) => set('mvpPlayerName', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
          <Field label={sr.admin.champions.form.topScorerName}>
            <input
              value={form.topScorerName}
              onChange={(e) => set('topScorerName', e.target.value)}
              className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
            />
          </Field>
        </div>

        <Field label={sr.admin.champions.form.notes}>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            className="w-full rounded-md border border-surface-4 bg-surface-2 px-3 py-2 text-ink-primary"
          />
        </Field>

        {error ? (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-surface-4 px-4 py-2 text-sm text-ink-secondary hover:bg-surface-2"
          >
            {sr.common.cancel}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
          >
            {sr.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-500 text-ink-secondary">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {children}
    </label>
  );
}
