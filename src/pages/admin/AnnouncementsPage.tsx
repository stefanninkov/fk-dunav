import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { announcementsCol } from '@/lib/firestore/refs';
import type { Announcement } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import {
  createAnnouncement,
  deleteAnnouncement,
} from '@/features/announcements/announcementActions';

const schema = z.object({
  title: z.string().min(1, sr.common.required),
  body: z.string().min(1, sr.common.required).max(280),
  severity: z.enum(['info', 'warning', 'urgent']),
});
type FormValues = z.infer<typeof schema>;

export function AnnouncementsPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(announcementsCol(active.id), orderBy('publishedAt', 'desc')),
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
    defaultValues: { title: '', body: '', severity: 'info' },
  });

  async function onSubmit(v: FormValues) {
    if (!active || !uid) return;
    await createAnnouncement(active.id, v, uid);
    reset({ title: '', body: '', severity: 'info' });
  }

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.announcements.title}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.announcements.title}</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-3 rounded-lg bg-surface-1 p-4 shadow-card sm:grid-cols-[2fr_1fr_auto]"
      >
        <div className="flex flex-col gap-2 sm:col-span-3">
          <input
            placeholder={sr.admin.announcements.form.title}
            className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
            {...register('title')}
          />
          {errors.title ? <span className="text-xs text-danger">{errors.title.message}</span> : null}
        </div>
        <textarea
          placeholder={sr.admin.announcements.form.body}
          className="sm:col-span-2 min-h-touch rounded-md border border-surface-4 bg-surface-2 px-3 py-2 text-ink-primary outline-none focus:border-brand-500"
          rows={2}
          {...register('body')}
        />
        <select
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
          {...register('severity')}
        >
          <option value="info">{sr.admin.announcements.severity.info}</option>
          <option value="warning">{sr.admin.announcements.severity.warning}</option>
          <option value="urgent">{sr.admin.announcements.severity.urgent}</option>
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60 sm:col-span-3"
        >
          <Plus size={16} />
          {sr.common.create}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
          {sr.admin.announcements.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
            >
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-500 ${
                      a.severity === 'urgent'
                        ? 'bg-danger-soft text-danger'
                        : a.severity === 'warning'
                          ? 'bg-warning-soft text-warning'
                          : 'bg-surface-3 text-ink-secondary'
                    }`}
                  >
                    {sr.admin.announcements.severity[a.severity]}
                  </span>
                  <h2 className="font-500 text-ink-primary">{a.title}</h2>
                </div>
                <p className="text-sm text-ink-secondary">{a.body}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Obrisati obaveštenje?')) void deleteAnnouncement(active.id, a.id);
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
