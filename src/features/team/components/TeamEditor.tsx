import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getDocs, query, where } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';

import type { Group, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { createTeam, updateTeam } from '@/features/team/teamActions';
import {
  type RosterRow,
  savePlayerRoster,
} from '@/features/player/playerActions';
import { playersCol } from '@/lib/firestore/refs';

const rosterRowSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  photoUrl: z.string().optional().default(''),
});

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
  roster: z.array(rosterRowSchema).default([]),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  tournamentId: string;
  groups: Group[];
  /** When provided, the dialog opens in edit mode and pre-loads the roster. */
  team?: Team;
  onClose: () => void;
}

export function TeamEditor({ tournamentId, groups, team, onClose }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(!!team);
  const isEdit = !!team;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: team?.name ?? '',
      shortName: team?.shortName ?? '',
      groupId: team?.groupId ?? groups[0]?.id ?? '',
      color: team?.color ?? '',
      captainName: team?.captainName ?? '',
      roster: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'roster' });

  // Load existing roster for edit mode.
  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(playersCol(tournamentId), where('teamId', '==', team.id)),
        );
        if (cancelled) return;
        const rows = snap.docs.map((d) => {
          const p = d.data();
          return {
            id: d.id,
            firstName: p.firstName ?? '',
            lastName: p.lastName ?? '',
            photoUrl: p.photoUrl ?? '',
          };
        });
        reset({
          name: team.name,
          shortName: team.shortName ?? '',
          groupId: team.groupId,
          color: team.color ?? '',
          captainName: team.captainName ?? '',
          roster: rows.length > 0 ? rows : [],
        });
      } finally {
        if (!cancelled) setLoadingRoster(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [team, tournamentId, reset]);

  async function onSubmit(v: FormValues) {
    setSubmitError(null);
    try {
      const color =
        v.color && v.color.length > 0
          ? v.color.startsWith('#')
            ? v.color
            : `#${v.color}`
          : undefined;

      let targetTeamId: string;
      const teamName = v.name.trim();

      if (isEdit && team) {
        await updateTeam(tournamentId, team.id, {
          name: teamName,
          shortName: v.shortName,
          groupId: v.groupId,
          color,
          captainName: v.captainName?.trim() || undefined,
        });
        targetTeamId = team.id;
      } else {
        targetTeamId = await createTeam(tournamentId, {
          name: teamName,
          shortName: v.shortName,
          groupId: v.groupId,
          color,
          captainName: v.captainName?.trim() || undefined,
        });
      }

      const rosterRows: RosterRow[] = v.roster
        .map((r) => ({
          id: r.id,
          firstName: r.firstName.trim(),
          lastName: r.lastName.trim(),
          photoUrl: r.photoUrl?.trim() || undefined,
        }))
        .filter((r) => r.firstName || r.lastName);

      await savePlayerRoster(tournamentId, targetTeamId, teamName, rosterRows);
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
        className="my-8 flex w-full max-w-lg flex-col gap-4 rounded-lg bg-surface-1 p-6 shadow-elevated"
      >
        <header className="flex items-center justify-between">
          <h2 className="font-display text-xl font-700">
            {isEdit ? sr.common.edit + ' — ' + team!.name : sr.admin.teams.newButton}
          </h2>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>

        {/* Roster */}
        <section className="flex flex-col gap-2 rounded-md border border-surface-4 bg-surface-2/60 p-3">
          <header className="flex items-center justify-between">
            <span className="font-display text-sm font-600">
              {sr.admin.teams.rosterTitle}
            </span>
            <button
              type="button"
              onClick={() =>
                append({ firstName: '', lastName: '', photoUrl: '' })
              }
              className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-600 text-ink-primary hover:bg-brand-500"
            >
              <Plus size={14} />
              {sr.admin.teams.addPlayer}
            </button>
          </header>

          {loadingRoster ? (
            <p className="px-1 py-2 text-xs text-ink-tertiary">{sr.common.loading}</p>
          ) : fields.length === 0 ? (
            <p className="px-1 py-2 text-xs text-ink-tertiary">
              {sr.admin.teams.rosterEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fields.map((f, idx) => (
                <li
                  key={f.id}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]"
                >
                  <input
                    className={inputClass}
                    placeholder={sr.admin.teams.form.firstName}
                    {...register(`roster.${idx}.firstName` as const)}
                  />
                  <input
                    className={inputClass}
                    placeholder={sr.admin.teams.form.lastName}
                    {...register(`roster.${idx}.lastName` as const)}
                  />
                  <input
                    className={`${inputClass} col-span-2 sm:col-span-1`}
                    placeholder={sr.admin.teams.form.photoUrl}
                    {...register(`roster.${idx}.photoUrl` as const)}
                  />
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="flex h-touch w-touch items-center justify-center rounded-md text-ink-tertiary hover:bg-surface-3 hover:text-danger"
                    aria-label={sr.common.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {submitError ? (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {submitError}
          </p>
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
            {isSubmitting
              ? sr.common.loading
              : isEdit
                ? sr.common.save
                : sr.common.create}
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
