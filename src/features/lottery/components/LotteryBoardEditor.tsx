import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import type { LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import {
  createLotteryPrize,
  deleteLotteryPrize,
  hideLotteryPrize,
  revealLotteryPrize,
} from '@/features/lottery/lotteryActions';

interface Props {
  tournamentId: string;
  prizes: LotteryPrize[];
  createdBy: string;
}

/**
 * Admin-side Lutrija editor. Adds a new prize at the end (order = current
 * count) with revealed=false so the admin can pre-enter everything and
 * then reveal prizes one at a time during the live draw. `/lutrija` on
 * the public site is the companion big-screen view that animates each
 * reveal.
 */
export function LotteryBoardEditor({ tournamentId, prizes, createdBy }: Props) {
  const [label, setLabel] = useState('');
  const [winnerName, setWinnerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!label.trim() || !winnerName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createLotteryPrize(
        tournamentId,
        {
          label: label.trim(),
          winnerName: winnerName.trim(),
          order: prizes.length,
        },
        createdBy,
      );
      setLabel('');
      setWinnerName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Obrisati dobitnika?')) return;
    await deleteLotteryPrize(tournamentId, id);
  }

  const nextHidden = prizes.find((p) => !p.revealed);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-600">{sr.side.lottery.admin.title}</h2>
        <NavLink
          to="/lutrija"
          target="_blank"
          className="text-xs font-500 text-brand-400 hover:text-brand-300"
        >
          Otvori veliki ekran ↗
        </NavLink>
      </header>

      <div className="flex flex-col gap-2 rounded-lg bg-surface-1 p-4 shadow-card">
        <p className="text-sm text-ink-secondary">
          Unesi sve dobitnike unapred. Tokom izvlačenja klikni{' '}
          <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs">
            <Eye size={12} /> Otkrij
          </span>{' '}
          na željenu nagradu — pojaviće se na velikom ekranu uz animaciju.
        </p>
        {nextHidden ? (
          <button
            type="button"
            onClick={() => void revealLotteryPrize(tournamentId, nextHidden.id)}
            className="inline-flex self-start items-center gap-2 rounded-md bg-accent-gold px-4 py-2 text-sm font-700 text-ink-inverse hover:opacity-90"
          >
            <Eye size={16} />
            Otkrij sledeću: {nextHidden.label}
          </button>
        ) : prizes.length > 0 ? (
          <span className="self-start text-xs text-ink-tertiary">Sve nagrade su otkrivene.</span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={sr.side.lottery.admin.labelPlaceholder}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <input
          value={winnerName}
          onChange={(e) => setWinnerName(e.target.value)}
          placeholder={sr.side.lottery.admin.winnerPlaceholder}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !label.trim() || !winnerName.trim()}
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
        <p className="rounded-md bg-surface-1 px-4 py-3 text-sm text-ink-tertiary">
          {sr.common.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {prizes.map((p, idx) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 shadow-card ${
                p.revealed ? 'bg-brand-900/40' : 'bg-surface-1'
              }`}
            >
              <span className="tnum w-6 font-600 text-ink-secondary">{idx + 1}.</span>
              <span className="flex-1 text-ink-primary">
                <span className="font-500">{p.label}</span> — {p.winnerName}
              </span>
              {p.revealed ? (
                <button
                  type="button"
                  onClick={() => void hideLotteryPrize(tournamentId, p.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2"
                  title="Vrati u skriveno (samo za ispravke)"
                >
                  <EyeOff size={14} />
                  Sakrij
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void revealLotteryPrize(tournamentId, p.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-accent-gold px-3 py-1.5 text-xs font-700 text-ink-inverse hover:opacity-90"
                >
                  <Eye size={14} />
                  Otkrij
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove(p.id)}
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
