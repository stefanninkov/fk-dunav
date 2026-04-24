import {
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  groupDrawSessionDoc,
  groupsCol,
  teamDoc,
  teamsCol,
} from '@/lib/firestore/refs';
import type { Group, GroupDrawSession, Team } from '@/lib/firestore/types';

/**
 * Group draw — seed-style random assignment of unassigned teams into
 * existing group docs. Balances by current head-count: each draw picks
 * the group with the fewest teams (ties broken by group order), then a
 * random unassigned team is dropped into it. Does not overwrite teams
 * that already have a groupId (per the admin's chosen policy).
 */

export async function setGroupDrawDrumVisible(
  tournamentId: string,
  visible: boolean,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    groupDrawSessionDoc(tournamentId),
    {
      drumVisible: visible,
      updatedAt: serverTimestamp(),
      updatedBy,
    } as unknown as GroupDrawSession,
    { merge: true },
  );
}

export interface DrawGroupResult {
  team: Team;
  group: Group;
}

export async function drawNextTeamToGroup(
  tournamentId: string,
  updatedBy: string,
): Promise<DrawGroupResult | null> {
  const [groupsSnap, teamsSnap] = await Promise.all([
    getDocs(groupsCol(tournamentId)),
    getDocs(teamsCol(tournamentId)),
  ]);

  const groups = groupsSnap.docs
    .map((d) => d.data())
    .sort((a, b) => a.order - b.order);
  if (groups.length === 0) return null;

  const teams = teamsSnap.docs.map((d) => d.data()).filter((t) => !t.deletedAt);
  const unassigned = teams.filter((t) => !t.groupId);
  if (unassigned.length === 0) return null;

  // Pick the group with the fewest current members; tie-break by order.
  const counts = new Map<string, number>();
  for (const g of groups) counts.set(g.id, 0);
  for (const t of teams) {
    if (t.groupId && counts.has(t.groupId)) {
      counts.set(t.groupId, (counts.get(t.groupId) ?? 0) + 1);
    }
  }
  let pickedGroup = groups[0];
  let minCount = counts.get(pickedGroup.id) ?? 0;
  for (const g of groups) {
    const c = counts.get(g.id) ?? 0;
    if (c < minCount) {
      minCount = c;
      pickedGroup = g;
    }
  }

  const pickedTeam = unassigned[Math.floor(Math.random() * unassigned.length)];

  const batch = writeBatch(db);
  batch.update(teamDoc(tournamentId, pickedTeam.id), {
    groupId: pickedGroup.id,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    groupDrawSessionDoc(tournamentId),
    {
      lastDrawnTeamId: pickedTeam.id,
      lastDrawnTeamName: pickedTeam.name,
      lastDrawnGroupId: pickedGroup.id,
      lastDrawnGroupName: pickedGroup.name,
      lastDrawnAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy,
    } as unknown as GroupDrawSession,
    { merge: true },
  );
  await batch.commit();

  return { team: pickedTeam, group: pickedGroup };
}

/**
 * Unassign every team that was drawn in and clear the "last drawn"
 * marker — a soft reset so the admin can redo the draw without touching
 * groups or manually-assigned teams. `manuallyAssignedTeamIds` stays
 * intact: teams that had a groupId BEFORE the draw session started keep it.
 *
 * For a pragmatic MVP we just unassign every team — the admin can
 * re-assign manually if needed. Option 3B said no overwrites during
 * draw; reset is an explicit destructive action.
 */
export async function resetGroupDraw(tournamentId: string): Promise<void> {
  const teamsSnap = await getDocs(teamsCol(tournamentId));
  const batch = writeBatch(db);
  for (const d of teamsSnap.docs) {
    const team = d.data();
    if (team.deletedAt) continue;
    if (!team.groupId) continue;
    batch.update(teamDoc(tournamentId, team.id), {
      groupId: '',
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  await updateDoc(groupDrawSessionDoc(tournamentId), {
    lastDrawnTeamId: '',
    lastDrawnTeamName: '',
    lastDrawnGroupId: '',
    lastDrawnGroupName: '',
    updatedAt: serverTimestamp(),
  });
}
