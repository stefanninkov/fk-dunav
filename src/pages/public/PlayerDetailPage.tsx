import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';

import { playerDoc } from '@/lib/firestore/refs';
import type { Player } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const active = useTournamentStore((s) => s.active);
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!active || !playerId) return;
    const unsub = onSnapshot(playerDoc(active.id, playerId), (snap) => {
      setPlayer(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [active, playerId]);

  if (!active) {
    return <PagePlaceholder title="Igrač" description="Čeka se aktivan turnir." />;
  }
  if (!player) {
    return <PagePlaceholder title="Igrač" description={sr.common.loading} />;
  }

  return (
    <section className="mx-auto max-w-[720px] px-page-x py-10 lg:px-page-x-lg">
      <NavLink
        to={`/tim/${player.teamId}`}
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← {player.teamName}
      </NavLink>

      <header className="mt-4 flex items-center gap-4">
        {player.photoUrl ? (
          <img src={player.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-3 text-2xl">
            {player.firstName[0]}
            {player.lastName[0]}
          </span>
        )}
        <div>
          <h1 className="font-display text-3xl font-700">{player.displayName}</h1>
          <p className="text-sm text-ink-tertiary">{player.teamName}</p>
        </div>
      </header>

      <p className="mt-8 text-sm text-ink-secondary">
        Detaljna statistika (golovi, asistencije, kartoni) se dodaje kada počne prvo kolo.
      </p>
    </section>
  );
}
