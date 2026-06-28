import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Trash2, Wand2 } from 'lucide-react';

import { groupsCol, matchesCol, teamsCol } from '@/lib/firestore/refs';
import type { Group, Match, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import {
  deleteUnfinishedKnockoutDownstream,
  generateBracketMatches,
  type GenerateBracketResult,
} from '@/features/match/generateBracket';

export function AdminMatchesPage() {
  const active = useTournamentStore((s) => s.active);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateBracketResult | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsubMatches = onSnapshot(
      query(matchesCol(active.id), orderBy('scheduledStart', 'asc')),
      (snap) => setMatches(snap.docs.map((d) => d.data())),
    );
    const unsubGroups = onSnapshot(
      query(groupsCol(active.id), orderBy('order', 'asc')),
      (snap) => setGroups(snap.docs.map((d) => d.data())),
    );
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null)),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubMatches();
      unsubGroups();
      unsubTeams();
    };
  }, [active]);

  async function handleGenerate() {
    if (!active) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateBracketMatches({
        tournament: active,
        groups,
        teams,
        matches: matches ?? [],
        tiebreakerOrder: active.config.tiebreakerOrder,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function handleCleanupSfFinal() {
    if (!active) return;
    const targets = (matches ?? []).filter(
      (m) =>
        m.phase === 'knockout' &&
        m.status === 'scheduled' &&
        m.knockoutRound !== 'qf',
    );
    if (targets.length === 0) {
      setResult({ created: [], skipped: [] });
      return;
    }
    if (
      !confirm(
        `Obrisati ${targets.length} zakazanih PF/finale utakmica? Mogu se ponovo generisati kasnije.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const deleted = await deleteUnfinishedKnockoutDownstream(
        active.id,
        matches ?? [],
      );
      setResult({
        created: [],
        skipped: deleted.map((slot) => ({ slot, reason: 'obrisano' })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.matches}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  const hasAnyKnockout =
    (matches ?? []).some((m) => m.phase === 'knockout');
  const hasScheduledDownstream = (matches ?? []).some(
    (m) =>
      m.phase === 'knockout' &&
      m.status === 'scheduled' &&
      m.knockoutRound !== 'qf',
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.matches}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {hasScheduledDownstream ? (
            <button
              type="button"
              onClick={() => void handleCleanupSfFinal()}
              disabled={busy}
              className="inline-flex h-touch items-center gap-2 rounded-md border border-surface-4 px-3 text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
              title="Obriši PF1, PF2, treće mesto i finale dok se ne završi četvrtfinale"
            >
              <Trash2 size={14} />
              Obriši PF/finale
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy || teams.length < 2 || groups.length === 0}
            className="inline-flex h-touch items-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
            title="Kreira ČF1–ČF4 sa timovima iz grupa (placeholderi 1A/4B/… ako standings nisu rešene)"
          >
            <Wand2 size={16} />
            {hasAnyKnockout ? 'Dopuni nokaut utakmice' : 'Generiši nokaut utakmice'}
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      {result ? (
        <div className="rounded-md bg-surface-1 px-4 py-3 text-xs text-ink-secondary shadow-card">
          {result.created.length > 0 ? (
            <p>
              Kreirano:{' '}
              <span className="font-700 text-success">
                {result.created.join(', ')}
              </span>
            </p>
          ) : null}
          {result.skipped.length > 0 ? (
            <p className="mt-1">
              Preskočeno:{' '}
              <span className="text-ink-tertiary">
                {result.skipped.map((s) => `${s.slot} (${s.reason})`).join(', ')}
              </span>
            </p>
          ) : null}
          {result.created.length === 0 && result.skipped.length === 0 ? (
            <p>Nema promena.</p>
          ) : null}
        </div>
      ) : null}

      {matches === null ? (
        <p className="text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-secondary">
          {sr.common.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((m) => (
            <li key={m.id}>
              <NavLink
                to={`/admin/utakmice/${m.id}`}
                className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card hover:shadow-card-hov"
              >
                <span className="tnum w-28 text-xs text-ink-tertiary">
                  {m.scheduledStart.toDate().toLocaleString('sr-RS', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {m.bracketSlot ? (
                  <span className="rounded-full bg-brand-600/20 px-2 py-0.5 text-[0.65rem] font-700 uppercase tracking-wide text-brand-300">
                    {m.bracketSlot}
                  </span>
                ) : null}
                <span className="flex-1 text-ink-primary">
                  <span className="font-500">{m.teamA.name}</span>
                  <span className="mx-2 text-ink-tertiary">vs</span>
                  <span className="font-500">{m.teamB.name}</span>
                </span>
                {m.status === 'finished' ? (
                  <span className="tnum font-display font-700">
                    {m.score.a}:{m.score.b}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    m.status === 'live'
                      ? 'bg-live-soft text-live'
                      : m.status === 'finished'
                        ? 'bg-success-soft text-success'
                        : 'bg-surface-2 text-ink-secondary'
                  }`}
                >
                  {sr.match.status[m.status]}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
