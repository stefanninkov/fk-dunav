import { useMemo, useState } from 'react';
import { Dices, ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import type { LotteryParticipant, LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import {
  createLotteryParticipant,
  createLotteryPrize,
  deleteLotteryParticipant,
  deleteLotteryPrize,
  drawLotteryWinner,
  undrawLotteryWinner,
} from '@/features/lottery/lotteryActions';

interface Props {
  tournamentId: string;
  participants: LotteryParticipant[];
  prizes: LotteryPrize[];
  createdBy: string;
}

/**
 * Admin UI for Lutrija: two sections (participants pool + prizes) and a
 * per-prize "Izvuci" button that atomically picks a random unassigned
 * participant and records them as the winner. The live big screen at
 * /lutrija watches Firestore and animates the reveal.
 */
export function LotteryBoardEditor({
  tournamentId,
  participants,
  prizes,
  createdBy,
}: Props) {
  const takenIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of prizes) if (p.winnerParticipantId) set.add(p.winnerParticipantId);
    return set;
  }, [prizes]);

  const remainingCount = participants.length - takenIds.size;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-600">{sr.side.lottery.admin.title}</h2>
        <NavLink
          to="/lutrija"
          target="_blank"
          className="inline-flex items-center gap-1 text-xs font-500 text-brand-400 hover:text-brand-300"
        >
          {sr.side.lottery.admin.openBigScreen}
          <ExternalLink size={12} />
        </NavLink>
      </header>

      <ParticipantsSection
        tournamentId={tournamentId}
        participants={participants}
        takenIds={takenIds}
        createdBy={createdBy}
      />

      <PrizesSection
        tournamentId={tournamentId}
        prizes={prizes}
        participants={participants}
        remainingCount={remainingCount}
        createdBy={createdBy}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------

function ParticipantsSection({
  tournamentId,
  participants,
  takenIds,
  createdBy,
}: {
  tournamentId: string;
  participants: LotteryParticipant[];
  takenIds: Set<string>;
  createdBy: string;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createLotteryParticipant(
        tournamentId,
        { name, note: note || undefined },
        createdBy,
      );
      setName('');
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(sr.common.delete + '?')) return;
    await deleteLotteryParticipant(tournamentId, id);
  }

  const remaining = participants.length - takenIds.size;

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4 shadow-card">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-600">
          {sr.side.lottery.admin.participantsTitle}
        </h3>
        <span className="tnum text-xs text-ink-tertiary">
          {sr.side.lottery.admin.poolSummary(remaining, participants.length)}
        </span>
      </header>

      <p className="text-sm text-ink-secondary">{sr.side.lottery.admin.participantsHelp}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={sr.side.lottery.admin.participantNamePlaceholder}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={sr.side.lottery.admin.participantNotePlaceholder}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !name.trim()}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          {sr.side.lottery.admin.addParticipant}
        </button>
      </div>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      {participants.length === 0 ? (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-tertiary">
          {sr.common.empty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-3 overflow-hidden rounded-md bg-surface-2">
          {participants.map((p) => {
            const used = takenIds.has(p.id);
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 px-3 py-2 ${used ? 'opacity-50' : ''}`}
              >
                <span className="flex-1 text-sm text-ink-primary">
                  {p.name}
                  {p.note ? (
                    <span className="ml-2 text-xs text-ink-tertiary">— {p.note}</span>
                  ) : null}
                </span>
                {used ? (
                  <span className="text-xs text-ink-tertiary">
                    {sr.side.lottery.admin.drawn}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  disabled={used}
                  className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-3 hover:text-danger disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-tertiary"
                  title={used ? sr.side.lottery.admin.drawn : sr.common.delete}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function PrizesSection({
  tournamentId,
  prizes,
  participants,
  remainingCount,
  createdBy,
}: {
  tournamentId: string;
  prizes: LotteryPrize[];
  participants: LotteryParticipant[];
  remainingCount: number;
  createdBy: string;
}) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addPrize() {
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createLotteryPrize(
        tournamentId,
        { label, order: prizes.length },
        createdBy,
      );
      setLabel('');
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function removePrize(id: string) {
    if (!confirm(sr.common.delete + '?')) return;
    await deleteLotteryPrize(tournamentId, id);
  }

  async function draw(prizeId: string) {
    setDrawingId(prizeId);
    setError(null);
    try {
      const result = await drawLotteryWinner(tournamentId, prizeId);
      if (!result) setError(sr.side.lottery.admin.noParticipants);
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setDrawingId(null);
    }
  }

  async function undraw(prizeId: string) {
    if (!confirm(sr.side.lottery.admin.confirmUndraw)) return;
    await undrawLotteryWinner(tournamentId, prizeId);
  }

  const canDraw = participants.length > 0 && remainingCount > 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4 shadow-card">
      <header>
        <h3 className="font-display text-base font-600">
          {sr.side.lottery.admin.prizesTitle}
        </h3>
      </header>

      <p className="text-sm text-ink-secondary">{sr.side.lottery.admin.prizesHelp}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={sr.side.lottery.admin.labelPlaceholder}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={addPrize}
          disabled={busy || !label.trim()}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          {sr.side.lottery.admin.addPrize}
        </button>
      </div>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      {prizes.length === 0 ? (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-tertiary">
          {sr.common.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {prizes.map((p, idx) => {
            const drawn = !!p.winnerName;
            const thisDrawing = drawingId === p.id;
            return (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 shadow-card ${
                  drawn ? 'bg-brand-900/40' : 'bg-surface-2'
                }`}
              >
                <span className="tnum w-6 font-600 text-ink-secondary">{idx + 1}.</span>
                <div className="flex min-w-[10rem] flex-1 flex-col">
                  <span className="font-500 text-ink-primary">{p.label}</span>
                  <span
                    className={`text-xs ${drawn ? 'text-ink-secondary' : 'italic text-ink-tertiary'}`}
                  >
                    {drawn ? p.winnerName : sr.side.lottery.pending}
                  </span>
                </div>
                {drawn ? (
                  <button
                    type="button"
                    onClick={() => void undraw(p.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-3"
                  >
                    <RotateCcw size={14} />
                    {sr.side.lottery.admin.undraw}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void draw(p.id)}
                    disabled={!canDraw || thisDrawing}
                    className="inline-flex items-center gap-2 rounded-md bg-accent-gold px-4 py-2 text-sm font-700 text-ink-inverse hover:opacity-90 disabled:opacity-50"
                  >
                    <Dices size={16} />
                    {thisDrawing ? sr.side.lottery.drawing : sr.side.lottery.admin.draw}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removePrize(p.id)}
                  className="rounded-md p-2 text-ink-tertiary hover:bg-surface-3 hover:text-danger"
                  title={sr.common.delete}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
