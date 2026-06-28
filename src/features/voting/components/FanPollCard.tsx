import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';

import type { FanPoll } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { recordVote } from '@/features/voting/fanPollActions';

const DEVICE_ID_KEY = 'fk-dunav:device-id';
const VOTED_PREFIX = 'fk-dunav:voted:';

function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

interface Props {
  tournamentId: string;
  poll: FanPoll;
}

export function FanPollCard({ tournamentId, poll }: Props) {
  const [voted, setVoted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setVoted(window.localStorage.getItem(`${VOTED_PREFIX}${poll.id}`));
    } catch {
      /* noop */
    }
  }, [poll.id]);

  async function vote(candidateId: string) {
    if (voted) return;
    setSubmitting(candidateId);
    setError(null);
    try {
      const deviceId = getOrCreateDeviceId();
      await recordVote(tournamentId, poll.id, deviceId, candidateId, poll.candidates);
      window.localStorage.setItem(`${VOTED_PREFIX}${poll.id}`, candidateId);
      setVoted(candidateId);
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : 'unknown';
      setError(
        code === 'permission-denied'
          ? 'Već si glasao ili glasanje nije otvoreno.'
          : sr.common.errorGeneric,
      );
    } finally {
      setSubmitting(null);
    }
  }

  const isOpen = poll.status === 'open';
  const totalVotes = poll.candidates.reduce((sum, c) => sum + c.voteCount, 0);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-display text-lg font-600">{poll.title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-500 ${
            isOpen ? 'bg-success-soft text-success' : 'bg-surface-3 text-ink-secondary'
          }`}
        >
          {isOpen ? 'Otvoreno' : 'Zatvoreno'}
        </span>
      </header>

      {poll.candidates.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
          Lista kandidata se uskoro objavljuje.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...poll.candidates]
            .sort((a, b) => b.voteCount - a.voteCount)
            .map((c) => {
              const pct = totalVotes > 0 ? (c.voteCount / totalVotes) * 100 : 0;
              const mine = voted === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void vote(c.id)}
                    disabled={!isOpen || !!voted || submitting === c.id}
                    className={`relative flex w-full items-center gap-3 overflow-hidden rounded-md px-3 py-3 text-left shadow-card transition ${
                      mine
                        ? 'bg-brand-900 text-brand-100'
                        : 'bg-surface-1 text-ink-primary hover:bg-surface-2'
                    } disabled:cursor-default disabled:opacity-90`}
                  >
                    {voted || !isOpen ? (
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 bg-brand-600/20"
                        style={{ width: `${pct}%` }}
                      />
                    ) : null}
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="relative h-10 w-10 rounded object-cover"
                      />
                    ) : null}
                    <span className="relative flex-1 font-500">{c.label}</span>
                    {voted || !isOpen ? (
                      <span className="relative tnum text-sm text-ink-secondary">
                        {c.voteCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      {voted ? (
        <p className="text-xs text-ink-tertiary">Hvala, tvoj glas je zabeležen.</p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}
    </section>
  );
}
