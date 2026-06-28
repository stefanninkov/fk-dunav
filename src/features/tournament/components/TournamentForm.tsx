import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  createTournament,
  defaultSideCompetitions,
  defaultTournamentConfig,
} from '@/features/tournament/tournamentActions';

const schema = z.object({
  name: z.string().min(2, sr.common.required),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Samo mala slova, cifre i crtica'),
  subtitle: z.string().optional(),
  edition: z.coerce.number().int().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  startDate: z.string().min(1, sr.common.required),
  endDate: z.string().min(1, sr.common.required),
  locationName: z.string().min(2, sr.common.required),
  fieldsCsv: z.string().min(1, sr.common.required),
  qualifiersPerGroup: z.coerce.number().int().min(1).max(8),
  halves: z.coerce.number().int().min(1).max(4),
  halfMinutes: z.coerce.number().int().min(1).max(45),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
}

export function TournamentForm({ onClose }: Props) {
  const uid = useAuthStore((s) => s.uid);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: 'FK Dunav — 2. turnir u malom fudbalu na travi',
      slug: '2026',
      subtitle: sr.brand.tagline,
      edition: 2,
      year: 2026,
      startDate: '2026-06-27',
      endDate: '2026-06-28',
      locationName: 'FK Dunav stadion, Ostrovo',
      fieldsCsv: defaultTournamentConfig.fields.join(', '),
      qualifiersPerGroup: defaultTournamentConfig.qualifiersPerGroup,
      halves: defaultTournamentConfig.matchFormat.halves,
      halfMinutes: defaultTournamentConfig.matchFormat.halfDurationSeconds / 60,
    },
  });

  async function onSubmit(v: FormValues) {
    if (!uid) return;
    setSubmitError(null);
    try {
      const fields = v.fieldsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await createTournament(
        {
          name: v.name,
          slug: v.slug,
          subtitle: v.subtitle,
          edition: v.edition,
          year: v.year,
          startDate: new Date(v.startDate),
          endDate: new Date(v.endDate),
          location: { name: v.locationName },
          config: {
            ...defaultTournamentConfig,
            fields,
            qualifiersPerGroup: v.qualifiersPerGroup,
            matchFormat: {
              ...defaultTournamentConfig.matchFormat,
              halves: v.halves,
              halfDurationSeconds: v.halfMinutes * 60,
            },
          },
          sideCompetitions: defaultSideCompetitions,
        },
        uid,
      );
      onClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : sr.common.errorGeneric);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-surface-0/80 p-page-x backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="my-8 flex w-full max-w-2xl flex-col gap-4 rounded-lg bg-surface-1 p-6 shadow-elevated"
      >
        <header className="flex items-center justify-between">
          <h2 className="font-display text-xl font-700">{sr.admin.tournament.newButton}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
          >
            {sr.common.close}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={sr.admin.tournament.form.name} error={errors.name?.message}>
            <input className={inputClass} {...register('name')} />
          </Field>
          <Field label={sr.admin.tournament.form.slug} error={errors.slug?.message}>
            <input className={inputClass} {...register('slug')} />
          </Field>
          <Field
            label={sr.admin.tournament.form.subtitle}
            error={errors.subtitle?.message}
            className="sm:col-span-2"
          >
            <input className={inputClass} {...register('subtitle')} />
          </Field>
          <Field label={sr.admin.tournament.form.edition} error={errors.edition?.message}>
            <input type="number" className={inputClass} {...register('edition')} />
          </Field>
          <Field label={sr.admin.tournament.form.year} error={errors.year?.message}>
            <input type="number" className={inputClass} {...register('year')} />
          </Field>
          <Field label={sr.admin.tournament.form.startDate} error={errors.startDate?.message}>
            <input type="date" className={inputClass} {...register('startDate')} />
          </Field>
          <Field label={sr.admin.tournament.form.endDate} error={errors.endDate?.message}>
            <input type="date" className={inputClass} {...register('endDate')} />
          </Field>
          <Field
            label={sr.admin.tournament.form.locationName}
            error={errors.locationName?.message}
            className="sm:col-span-2"
          >
            <input className={inputClass} {...register('locationName')} />
          </Field>
          <Field
            label={sr.admin.tournament.form.fieldsLabel}
            error={errors.fieldsCsv?.message}
            className="sm:col-span-2"
          >
            <input className={inputClass} {...register('fieldsCsv')} />
          </Field>
          <Field
            label={sr.admin.tournament.form.qualifiersPerGroup}
            error={errors.qualifiersPerGroup?.message}
          >
            <input type="number" className={inputClass} {...register('qualifiersPerGroup')} />
          </Field>
          <Field label={sr.admin.tournament.form.halves} error={errors.halves?.message}>
            <input type="number" className={inputClass} {...register('halves')} />
          </Field>
          <Field label={sr.admin.tournament.form.halfMinutes} error={errors.halfMinutes?.message}>
            <input type="number" className={inputClass} {...register('halfMinutes')} />
          </Field>
        </div>

        {submitError ? (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{submitError}</p>
        ) : null}

        <footer className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-surface-4 px-4 py-2 text-sm text-ink-secondary hover:bg-surface-2"
          >
            {sr.common.cancel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
          >
            {isSubmitting ? sr.common.loading : sr.common.create}
          </button>
        </footer>
      </form>
    </div>
  );
}

const inputClass =
  'h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500';

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="text-sm font-500 text-ink-secondary">{label}</span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}
