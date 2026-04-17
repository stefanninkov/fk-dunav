import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { Group } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { createTeam } from '@/features/team/teamActions';

const schema = z.object({
  name: z.string().min(2, sr.common.required),
  shortName: z
    .string()
    .max(5, 'Najviše 5 karaktera')
    .optional()
    .transform((v) => (v ? v.trim() : undefined)),
  groupId: z.string().min(1, sr.common.required),
  color: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, 'Hex boja, npr. #01458E')
    .optional()
    .or(z.literal('')),
  captainName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  tournamentId: string;
  groups: Group[];
  onClose: () => void;
}

export function TeamForm({ tournamentId, groups, onClose }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      shortName: '',
      groupId: groups[0]?.id,
      color: '',
      captainName: '',
    },
  });

  async function onSubmit(v: FormValues) {
    setSubmitError(null);
    try {
      const color = v.color && v.color.length > 0
        ? v.color.startsWith('#')
          ? v.color
          : `#${v.color}`
        : undefined;
      await createTeam(tournamentId, {
        name: v.name,
        shortName: v.shortName,
        groupId: v.groupId,
        color,
        captainName: v.captainName || undefined,
      });
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
        className="my-8 flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface-1 p-6 shadow-elevated"
      >
        <header className="flex items-center justify-between">
          <h2 className="font-display text-xl font-700">{sr.admin.teams.newButton}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
          >
            {sr.common.close}
          </button>
        </header>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">
            {sr.admin.teams.form.name}
          </span>
          <input className={inputClass} {...register('name')} />
          {errors.name ? <Err message={errors.name.message} /> : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">
            {sr.admin.teams.form.shortName}
          </span>
          <input className={inputClass} maxLength={5} {...register('shortName')} />
          {errors.shortName ? <Err message={errors.shortName.message} /> : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">
            {sr.admin.teams.form.group}
          </span>
          <select className={inputClass} {...register('groupId')}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {errors.groupId ? <Err message={errors.groupId.message} /> : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">
            {sr.admin.teams.form.color}
          </span>
          <input className={inputClass} placeholder="#01458E" {...register('color')} />
          {errors.color ? <Err message={errors.color.message} /> : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">
            {sr.admin.teams.form.captainName}
          </span>
          <input className={inputClass} {...register('captainName')} />
        </label>

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

function Err({ message }: { message?: string }) {
  return <span className="text-xs text-danger">{message}</span>;
}
