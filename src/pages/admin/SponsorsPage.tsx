import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { sponsorsCol } from '@/lib/firestore/refs';
import type { Sponsor, SponsorTier } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { createSponsor, deleteSponsor } from '@/features/sponsors/sponsorActions';

const tierOptions: SponsorTier[] = ['gold', 'silver', 'bronze', 'friend'];

const schema = z.object({
  name: z.string().min(1, sr.common.required),
  logoUrl: z.string().url('URL slike').optional().or(z.literal('')),
  link: z.string().url('URL').optional().or(z.literal('')),
  tier: z.enum(['gold', 'silver', 'bronze', 'friend']),
  order: z.coerce.number().int().min(0),
});
type FormValues = z.infer<typeof schema>;

export function SponsorsPage() {
  const active = useTournamentStore((s) => s.active);
  const [items, setItems] = useState<Sponsor[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(sponsorsCol(active.id), orderBy('order', 'asc')),
      (snap) => setItems(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', logoUrl: '', link: '', tier: 'gold', order: items.length },
  });

  async function onSubmit(v: FormValues) {
    if (!active) return;
    await createSponsor(active.id, {
      name: v.name,
      logoUrl: v.logoUrl || undefined,
      link: v.link || undefined,
      tier: v.tier,
      order: v.order,
      active: true,
    });
    reset({ name: '', logoUrl: '', link: '', tier: v.tier, order: v.order + 1 });
  }

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.sponsors.title}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.sponsors.title}</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-3 rounded-lg bg-surface-1 p-4 shadow-card sm:grid-cols-5"
      >
        <input
          placeholder={sr.admin.sponsors.form.name}
          className={inputCls}
          {...register('name')}
        />
        <input
          placeholder={sr.admin.sponsors.form.logoUrl}
          className={inputCls}
          {...register('logoUrl')}
        />
        <input
          placeholder={sr.admin.sponsors.form.link}
          className={inputCls}
          {...register('link')}
        />
        <select className={inputCls} {...register('tier')}>
          {tierOptions.map((t) => (
            <option key={t} value={t}>
              {sr.admin.sponsors.tier[t]}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder={sr.admin.sponsors.form.order}
          className={inputCls}
          {...register('order')}
        />
        {(errors.name || errors.logoUrl || errors.link) && (
          <p className="text-xs text-danger sm:col-span-5">
            {errors.name?.message ?? errors.logoUrl?.message ?? errors.link?.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60 sm:col-span-5"
        >
          <Plus size={16} />
          {sr.common.create}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
          {sr.admin.sponsors.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
            >
              {s.logoUrl ? (
                <img src={s.logoUrl} alt={s.name} className="h-10 w-10 rounded object-contain" />
              ) : (
                <div className="h-10 w-10 rounded bg-surface-3" />
              )}
              <div className="flex flex-1 flex-col">
                <span className="font-500 text-ink-primary">{s.name}</span>
                <span className="text-xs text-ink-tertiary">
                  {sr.admin.sponsors.tier[s.tier]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Obrisati sponzora?')) void deleteSponsor(active.id, s.id);
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
