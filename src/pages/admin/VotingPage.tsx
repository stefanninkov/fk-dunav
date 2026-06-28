import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';

import { fanPollDoc } from '@/lib/firestore/refs';
import type {
  FanPoll,
  FanPollCandidate,
  FanPollId,
} from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import {
  addCandidate,
  removeCandidate,
  setPollStatus,
  upsertPoll,
} from '@/features/voting/fanPollActions';

const polls: { id: FanPollId; title: string }[] = [
  { id: 'mvp', title: 'MVP turnira' },
  { id: 'bestGoal', title: 'Najlepši gol' },
];

export function VotingPage() {
  const active = useTournamentStore((s) => s.active);

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.voting}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-10">
      <h1 className="font-display text-2xl font-700">{sr.admin.nav.voting}</h1>
      {polls.map((p) => (
        <PollPanel key={p.id} tournamentId={active.id} pollId={p.id} title={p.title} />
      ))}
    </section>
  );
}

function PollPanel({
  tournamentId,
  pollId,
  title,
}: {
  tournamentId: string;
  pollId: FanPollId;
  title: string;
}) {
  const [poll, setPoll] = useState<FanPoll | null>(null);
  const [label, setLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(fanPollDoc(tournamentId, pollId), (snap) => {
      setPoll(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [tournamentId, pollId]);

  async function ensureExists() {
    if (poll) return;
    await upsertPoll(tournamentId, pollId, {
      title,
      status: 'closed',
      candidates: [],
    });
  }

  async function onAdd() {
    if (!label.trim()) return;
    await ensureExists();
    await addCandidate(
      tournamentId,
      pollId,
      {
        id: crypto.randomUUID(),
        label: label.trim(),
        imageUrl: imageUrl.trim() || undefined,
      },
      poll?.candidates ?? [],
    );
    setLabel('');
    setImageUrl('');
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface-1 p-5 shadow-card">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg font-600">{title}</h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-500 ${
              poll?.status === 'open'
                ? 'bg-success-soft text-success'
                : 'bg-surface-3 text-ink-secondary'
            }`}
          >
            {poll?.status === 'open' ? 'Otvoreno' : 'Zatvoreno'}
          </span>
          <button
            type="button"
            onClick={async () => {
              await ensureExists();
              await setPollStatus(
                tournamentId,
                pollId,
                poll?.status === 'open' ? 'closed' : 'open',
              );
            }}
            className="rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2"
          >
            {poll?.status === 'open' ? 'Zatvori' : 'Otvori'}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          placeholder="Naziv kandidata (npr. ime igrača / broj gola)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-touch flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <input
          placeholder="URL slike (opciono)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="h-touch flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!label.trim()}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          Dodaj
        </button>
      </div>

      {poll && poll.candidates.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {[...poll.candidates]
            .sort((a, b) => b.voteCount - a.voteCount)
            .map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                onRemove={() =>
                  removeCandidate(tournamentId, pollId, c.id, poll.candidates)
                }
              />
            ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-tertiary">Nema kandidata.</p>
      )}
    </section>
  );
}

function CandidateRow({
  candidate,
  onRemove,
}: {
  candidate: FanPollCandidate;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
      {candidate.imageUrl ? (
        <img src={candidate.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
      ) : null}
      <span className="flex-1 text-ink-primary">{candidate.label}</span>
      <span className="tnum font-600 text-ink-primary">{candidate.voteCount}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-2 text-ink-tertiary hover:bg-surface-3 hover:text-danger"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}
