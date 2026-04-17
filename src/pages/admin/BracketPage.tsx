import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { matchesCol, teamsCol } from '@/lib/firestore/refs';
import type {
  KnockoutRound,
  Match,
  Team,
  TeamSnapshot,
} from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { createMatch } from '@/features/match/matchActions';

const rounds: { id: KnockoutRound; label: string; slots: string[] }[] = [
  { id: 'qf', label: 'Četvrtfinale', slots: ['QF1', 'QF2', 'QF3', 'QF4'] },
  { id: 'sf', label: 'Polufinale', slots: ['SF1', 'SF2'] },
  { id: 'thirdPlace', label: '3. mesto', slots: ['TP'] },
  { id: 'final', label: 'Finale', slots: ['FINAL'] },
];

const schema = z
  .object({
    round: z.enum(['qf', 'sf', 'final', 'thirdPlace']),
    bracketSlot: z.string().min(1, sr.common.required),
    teamAId: z.string().min(1, sr.common.required),
    teamBId: z.string().min(1, sr.common.required),
    field: z.string().min(1, sr.common.required),
    scheduledStart: z.string().min(1, sr.common.required),
  })
  .refine((v) => v.teamAId !== v.teamBId, {
    path: ['teamBId'],
    message: 'Timovi moraju biti različiti',
  });

type FormValues = z.infer<typeof schema>;

export function BracketPage() {
  const active = useTournamentStore((s) => s.active);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null), orderBy('name', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    const unsubMatches = onSnapshot(
      query(matchesCol(active.id), where('phase', '==', 'knockout')),
      (snap) => setMatches(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubTeams();
      unsubMatches();
    };
  }, [active]);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        round: 'qf',
        bracketSlot: 'QF1',
        teamAId: '',
        teamBId: '',
        field: active?.config.fields[0] ?? '',
        scheduledStart: '',
      },
    });

  const round = watch('round');
  const availableSlots = rounds.find((r) => r.id === round)?.slots ?? [];

  async function onSubmit(v: FormValues) {
    if (!active) return;
    const a = teams.find((t) => t.id === v.teamAId);
    const b = teams.find((t) => t.id === v.teamBId);
    if (!a || !b) return;
    const snap = (t: Team): TeamSnapshot => ({
      teamId: t.id,
      name: t.name,
      shortName: t.shortName,
      logoUrl: t.logoUrl,
      groupId: t.groupId,
    });
    await createMatch(active.id, {
      phase: 'knockout',
      knockoutRound: v.round,
      bracketSlot: v.bracketSlot,
      field: v.field,
      scheduledStart: new Date(v.scheduledStart),
      teamA: snap(a),
      teamB: snap(b),
    });
    reset({
      round: v.round,
      bracketSlot: availableSlots[0],
      teamAId: '',
      teamBId: '',
      field: v.field,
      scheduledStart: '',
    });
  }

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.bracket}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.nav.bracket}</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-2 rounded-lg bg-surface-1 p-4 shadow-card sm:grid-cols-6"
      >
        <select
          className={inputCls}
          {...register('round')}
          onChange={(e) => {
            const r = e.target.value as KnockoutRound;
            setValue('round', r);
            const slots = rounds.find((x) => x.id === r)?.slots ?? [];
            setValue('bracketSlot', slots[0] ?? '');
          }}
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select className={inputCls} {...register('bracketSlot')}>
          {availableSlots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className={inputCls} {...register('teamAId')}>
          <option value="" disabled>
            Tim A…
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className={inputCls} {...register('teamBId')}>
          <option value="" disabled>
            Tim B…
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className={inputCls} {...register('field')}>
          {active.config.fields.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <input type="datetime-local" className={inputCls} {...register('scheduledStart')} />
        {(errors.teamBId || errors.scheduledStart) && (
          <p className="text-xs text-danger sm:col-span-6">
            {errors.teamBId?.message ?? errors.scheduledStart?.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60 sm:col-span-6"
        >
          <Plus size={16} />
          Dodaj utakmicu
        </button>
      </form>

      {rounds.map((r) => {
        const list = matches.filter((m) => m.knockoutRound === r.id);
        if (list.length === 0) return null;
        return (
          <section key={r.id}>
            <h2 className="mb-2 font-display text-sm font-600 uppercase tracking-wide text-ink-secondary">
              {r.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {list
                .slice()
                .sort((a, b) => (a.bracketSlot ?? '').localeCompare(b.bracketSlot ?? ''))
                .map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
                  >
                    <span className="tnum w-16 text-xs uppercase text-ink-tertiary">
                      {m.bracketSlot}
                    </span>
                    <span className="flex-1 text-ink-primary">
                      {m.teamA.name} vs {m.teamB.name}
                    </span>
                    <span className="text-xs text-ink-tertiary">
                      {m.scheduledStart.toDate().toLocaleString('sr-RS', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {m.status === 'finished' ? (
                      <span className="tnum font-display font-700">
                        {m.score.a}:{m.score.b}
                        {m.shootoutScore ? (
                          <span className="ml-1 text-xs text-ink-tertiary">
                            ({m.shootoutScore.a}:{m.shootoutScore.b})
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
                        {sr.match.status[m.status]}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

const inputCls =
  'h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500';
