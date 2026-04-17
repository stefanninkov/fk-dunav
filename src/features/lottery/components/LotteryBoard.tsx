import type { LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';

interface Props {
  prizes: LotteryPrize[];
}

/**
 * Public Lutrija board. Read-only display of prize winners, ordered by
 * `prize.order` ascending (1st, 2nd, 3rd …). Lives on /statistika as its
 * own section.
 */
export function LotteryBoard({ prizes }: Props) {
  if (prizes.length === 0) {
    return (
      <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
        {sr.side.lottery.empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {prizes.map((p, idx) => (
        <li
          key={p.id}
          className="flex items-center gap-4 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display font-700"
            style={{
              backgroundColor:
                idx === 0
                  ? 'var(--color-accent-gold)'
                  : idx === 1
                    ? 'var(--color-accent-silver)'
                    : idx === 2
                      ? 'var(--color-accent-bronze)'
                      : 'var(--color-brand-600)',
              color: 'var(--color-ink-inverse)',
            }}
          >
            {idx + 1}
          </span>
          <div className="flex flex-1 flex-col">
            <span className="font-500 text-ink-primary">{p.label}</span>
            <span className="text-sm text-ink-secondary">{p.winnerName}</span>
          </div>
          {p.winnerPhotoUrl ? (
            <img
              src={p.winnerPhotoUrl}
              alt={p.winnerName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
