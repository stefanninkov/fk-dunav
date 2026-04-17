import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { awardsCol, lotteryCol, playersCol, teamsCol } from '@/lib/firestore/refs';
import type {
  Award,
  AwardId,
  LotteryPrize,
  Player,
  Team,
} from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { setAward } from '@/features/awards/awardActions';
import { LotteryBoardEditor } from '@/features/lottery/components/LotteryBoardEditor';

type TeamAwardId = Extract<AwardId, 'champion' | 'runnerUp' | 'thirdPlace'>;
type PlayerAwardId = Extract<AwardId, 'mvp' | 'topScorer' | 'crossbarWinner'>;

const teamAwards: TeamAwardId[] = ['champion', 'runnerUp', 'thirdPlace'];
const playerAwards: PlayerAwardId[] = ['mvp', 'topScorer', 'crossbarWinner'];

export function AwardsPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [awards, setAwards] = useState<Record<string, Award>>({});
  const [prizes, setPrizes] = useState<LotteryPrize[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsubT = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null), orderBy('name', 'asc')),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    const unsubP = onSnapshot(
      query(playersCol(active.id), orderBy('lastName', 'asc')),
      (snap) => setPlayers(snap.docs.map((d) => d.data())),
    );
    const unsubA = onSnapshot(awardsCol(active.id), (snap) => {
      const map: Record<string, Award> = {};
      for (const d of snap.docs) map[d.id] = d.data();
      setAwards(map);
    });
    const unsubL = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setPrizes(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubT();
      unsubP();
      unsubA();
      unsubL();
    };
  }, [active]);

  async function saveTeamAward(id: TeamAwardId, teamId: string) {
    if (!active) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    await setAward(active.id, {
      id,
      type: 'team',
      teamId: team.id,
      teamName: team.name,
    });
  }

  async function savePlayerAward(id: PlayerAwardId, playerId: string) {
    if (!active) return;
    const p = players.find((x) => x.id === playerId);
    if (!p) return;
    await setAward(active.id, {
      id,
      type: 'player',
      playerId: p.id,
      playerName: p.displayName,
      playerPhotoUrl: p.photoUrl,
    });
  }

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.awards}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="font-display text-2xl font-700">{sr.admin.awards.title}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Zvanične nagrade turnira i Lutrija su objedinjene ovde.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {teamAwards.map((id) => (
          <TeamAwardRow
            key={id}
            id={id}
            teams={teams}
            selectedTeamId={awards[id]?.teamId}
            onSelect={(tid) => void saveTeamAward(id, tid)}
          />
        ))}
        {playerAwards.map((id) => (
          <PlayerAwardRow
            key={id}
            id={id}
            players={players}
            selectedPlayerId={awards[id]?.playerId}
            onSelect={(pid) => void savePlayerAward(id, pid)}
          />
        ))}
      </section>

      <LotteryBoardEditor tournamentId={active.id} prizes={prizes} createdBy={uid} />
    </section>
  );
}

function TeamAwardRow({
  id,
  teams,
  selectedTeamId,
  onSelect,
}: {
  id: TeamAwardId;
  teams: Team[];
  selectedTeamId: string | undefined;
  onSelect: (teamId: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-lg bg-surface-1 p-4 shadow-card">
      <span className="text-sm font-500 text-ink-secondary">{sr.admin.awards.ids[id]}</span>
      <select
        value={selectedTeamId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
      >
        <option value="" disabled>
          Izaberi tim…
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlayerAwardRow({
  id,
  players,
  selectedPlayerId,
  onSelect,
}: {
  id: PlayerAwardId;
  players: Player[];
  selectedPlayerId: string | undefined;
  onSelect: (playerId: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-lg bg-surface-1 p-4 shadow-card">
      <span className="text-sm font-500 text-ink-secondary">{sr.admin.awards.ids[id]}</span>
      <select
        value={selectedPlayerId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
      >
        <option value="" disabled>
          Izaberi igra\u010Da…
        </option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName} — {p.teamName}
          </option>
        ))}
      </select>
    </label>
  );
}
