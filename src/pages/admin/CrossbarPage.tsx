import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { crossbarCol } from '@/lib/firestore/refs';
import type { CrossbarParticipant } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import {
  createCrossbarParticipant,
  deleteCrossbarParticipant,
} from '@/features/crossbar/crossbarActions';

const schema = z.object({
  name: z.string().min(1, sr.common.required),
  teamName: z.string().optional(),
  qualifyingScore: z.coerce.number().int().min(0).optional(),
  finalRank: z.coerce.number().int().min(1).optional(),
});
type FormValues = z.infer<typeof schema>;

export function CrossbarPage() {
  const active = useTournamentStore((s) => s.active);
  const [items, setItems] = useState<CrossbarParticipant[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(crossbarCol(active.id), orderBy('finalRank', 'asc')),
      (snap) => setItems(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', teamName: '', qualifyingScore: undefined, finalRank: undefined },
  });

  async function onSubmit(v: FormValues) {
    if (!active) return;
    await createCrossbarParticipant(active.id, {
      name: v.name,
      teamName: v.teamName || undefined,
      qualifyingScore: v.qualifyingScore,
      finalRank: v.finalRank,
    });
    reset({ name: '', teamName: '', qualifyingScore: undefined, finalRank: undefined });
  }

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.crossbar.title}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.crossbar.title}</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-2 rounded-lg bg-surface-1 p-4 shadow-card sm:grid-cols-5"
      >
        <input
          placeholder={sr.admin.crossbar.form.name}
          className={inputCls}
          {...register('name')}
        />
        <input
          placeholder={sr.admin.crossbar.form.teamName}
          className={inputCls}
          {...register('teamName')}
        />
        <input
          type="number"
          placeholder={sr.admin.crossbar.form.qualifyingScore}
          className={inputCls}
          {...register('qualifyingScore')}
        />
        <input
          type="number"
          placeholder={sr.admin.crossbar.form.finalRank}
          className={inputCls}
          {...register('finalRank')}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          {sr.common.create}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
          {sr.admin.crossbar.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
            >
              {p.finalRank ? (
                <span className="tnum w-8 font-display text-lg font-700 text-brand-400">
                  {p.finalRank}.
                </span>
              ) : null}
              <div className="flex flex-1 flex-col">
                <span className="font-500 text-ink-primary">{p.name}</span>
                {p.teamName ? (
                  <span className="text-xs text-ink-tertiary">{p.teamName}</span>
                ) : null}
              </div>
              {p.qualifyingScore !== undefined ? (
                <span className="tnum text-sm text-ink-secondary">{p.qualifyingScore}/5</span>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Obrisati u\u010Desnika?'))
                    void deleteCrossbarParticipant(active.id, p.id);
                }}
                className="rounded-md p-2 text-ink-tertiary hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const inputCls =
  'h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500';
