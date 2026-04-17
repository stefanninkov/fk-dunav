import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Minus, Plus } from 'lucide-react';

import { kupSankaCol, teamsCol } from '@/lib/firestore/refs';
import type { KupSankaEntry, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { setBokala } from '@/features/kupSanka/kupSankaActions';

export function KupSankaPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [teams, setTeams] = useState<Team[]>([]);
  const [entries, setEntries] = useState<Record<string, KupSankaEntry>>({});

  useEffect(() => {
    if (!active) return;
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null), orderBy('name', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    const unsubEntries = onSnapshot(kupSankaCol(active.id), (snap) => {
      const map: Record<string, KupSankaEntry> = {};
      for (const d of snap.docs) map[d.id] = d.data();
      setEntries(map);
    });
    return () => {
      unsubTeams();
      unsubEntries();
    };
  }, [active]);

  async function change(team: Team, delta: number) {
    if (!active || !uid) return;
    const current = entries[team.id]?.bokala ?? 0;
    const next = Math.max(0, current + delta);
    await setBokala(active.id, team, next, uid);
  }

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.kupSanka.title}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.kupSanka.title}</h1>

      {teams.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.kupSanka.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams
            .slice()
            .sort((a, b) => (entries[b.id]?.bokala ?? 0) - (entries[a.id]?.bokala ?? 0))
            .map((t) => {
              const bokala = entries[t.id]?.bokala ?? 0;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
                >
                  <div className="flex-1 text-ink-primary">{t.name}</div>
                  <button
                    type="button"
                    onClick={() => void change(t, -1)}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-surface-4 text-ink-secondary hover:bg-surface-2"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="tnum w-10 text-center font-display text-xl font-700">
                    {bokala}
                  </span>
                  <button
                    type="button"
                    onClick={() => void change(t, 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-ink-primary hover:bg-brand-500"
                  >
                    <Plus size={16} />
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
