/**
 * Cloud Functions for the FK Dunav tournament app.
 *
 * Functions shipped here (Phase 5):
 *  - promoteAdminOnLogin (beforeCreate / beforeSignIn blocking trigger):
 *      looks up the signing-in email in /adminEmails and sets the
 *      `role: "admin"` custom claim so clients see it on the ID token.
 *      Supersedes the client-side /admins doc write once live.
 *  - recomputeMatchScore (Firestore onWrite on event docs):
 *      aggregates finalized score from the event log so the stored
 *      match.score matches even if the client write got out of sync.
 *  - onMatchEvent (Firestore onCreate on event docs):
 *      FCM multicast push for goal / matchStart / matchEnd events to
 *      every subscriber of that match.
 *  - onAnnouncementCreate (Firestore onCreate on announcements):
 *      if severity === 'urgent', sends an FCM broadcast to every
 *      subscription that opted in to broadcasts.
 *
 * The Admin SDK is initialized once at module scope.
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { beforeUserSignedIn } from 'firebase-functions/v2/identity';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();
const bucket = admin.storage().bucket();

// ---------------------------------------------------------------------------
// promoteAdminOnLogin — v2 Identity Platform trigger
// ---------------------------------------------------------------------------

export const promoteAdminOnLogin = beforeUserSignedIn(
  { region: 'europe-west3' },
  async (event) => {
    const email = event.data?.email?.toLowerCase();
    if (!email) return {};

    // 1. Hardcoded day-one admin: /adminEmails/{email}.
    const seed = await db.collection('adminEmails').doc(email).get();
    if (seed.exists) {
      return { customClaims: { role: 'admin' } };
    }

    // 2. Invited users: /invites/{email} with role='admin' | 'reporter'.
    const inviteRef = db.collection('invites').doc(email);
    const invite = await inviteRef.get();
    const data = invite.data();
    if (
      invite.exists &&
      !data?.revoked &&
      (data?.role === 'admin' || data?.role === 'reporter')
    ) {
      await inviteRef.update({
        consumedAt: FieldValue.serverTimestamp(),
        consumedByUid: event.data?.uid,
      });
      return { customClaims: { role: data.role } };
    }

    return {};
  },
);

// ---------------------------------------------------------------------------
// recomputeMatchScore — Firestore event trigger
// ---------------------------------------------------------------------------

export const recomputeMatchScore = functions
  .region('europe-west3')
  .firestore.document(
    'tournaments/{tournamentId}/matches/{matchId}/events/{eventId}',
  )
  .onWrite(async (_change, context) => {
    const { tournamentId, matchId } = context.params as {
      tournamentId: string;
      matchId: string;
    };
    const eventsSnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .collection('events')
      .where('deleted', '==', false)
      .get();

    let a = 0;
    let b = 0;
    for (const doc of eventsSnap.docs) {
      const ev = doc.data();
      if (ev.type !== 'goal') continue;
      if (ev.team === 'a') a += 1;
      else if (ev.team === 'b') b += 1;
    }

    await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .update({
        'score.a': a,
        'score.b': b,
        updatedAt: FieldValue.serverTimestamp(),
      });
  });

// ---------------------------------------------------------------------------
// onMatchEvent — FCM push for notable events
// ---------------------------------------------------------------------------

export const onMatchEvent = functions
  .region('europe-west3')
  .firestore.document(
    'tournaments/{tournamentId}/matches/{matchId}/events/{eventId}',
  )
  .onCreate(async (snap, context) => {
    const event = snap.data();
    if (!event) return;

    const notifiable = ['goal', 'matchStart', 'matchEnd'];
    if (!notifiable.includes(event.type)) return;

    const { tournamentId, matchId } = context.params as {
      tournamentId: string;
      matchId: string;
    };

    const matchSnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(matchId)
      .get();
    const match = matchSnap.data();
    if (!match) return;

    const teamName =
      event.team === 'a' ? match.teamA?.name : match.teamB?.name;

    const title =
      event.type === 'goal'
        ? `GOL! ${teamName ?? ''} ${match.score?.a ?? 0}:${match.score?.b ?? 0}`
        : event.type === 'matchStart'
          ? `Po\u010Delo: ${match.teamA?.name} vs ${match.teamB?.name}`
          : `Kraj: ${match.teamA?.name} ${match.score?.a ?? 0}:${match.score?.b ?? 0} ${match.teamB?.name}`;

    const body =
      event.type === 'goal'
        ? `${event.playerName ?? 'Gol'} — ${event.minute}'`
        : event.type === 'matchStart'
          ? 'Prvo zvi\u017Edi sudija'
          : 'Hvala za igru!';

    const subsSnap = await db
      .collection('pushSubscriptions')
      .where('invalid', '==', false)
      .where('matchIds', 'array-contains', matchId)
      .get();

    const tokens = subsSnap.docs.map((d) => d.id);
    if (tokens.length === 0) return;

    const resp = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: {
        matchId,
        tournamentId,
        type: event.type,
      },
      webpush: {
        fcmOptions: {
          link: `/fk-dunav/utakmica/${matchId}`,
        },
      },
    });

    // Prune dead tokens.
    const dead: string[] = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          dead.push(tokens[i]);
        }
      }
    });
    await Promise.all(
      dead.map((t) =>
        db
          .collection('pushSubscriptions')
          .doc(t)
          .update({ invalid: true }),
      ),
    );
  });

// ---------------------------------------------------------------------------
// onAnnouncementCreate — urgent broadcast
// ---------------------------------------------------------------------------

export const onAnnouncementCreate = functions
  .region('europe-west3')
  .firestore.document('tournaments/{tournamentId}/announcements/{id}')
  .onCreate(async (snap, context) => {
    const a = snap.data();
    if (!a || a.severity !== 'urgent') return;

    const subsSnap = await db
      .collection('pushSubscriptions')
      .where('invalid', '==', false)
      .where('subscribedToBroadcasts', '==', true)
      .get();

    const tokens = subsSnap.docs.map((d) => d.id);
    if (tokens.length === 0) return;

    await messaging.sendEachForMulticast({
      tokens,
      notification: { title: a.title, body: a.body },
      data: { tournamentId: context.params.tournamentId as string },
    });

    await snap.ref.update({ pushSent: true });
  });

// ---------------------------------------------------------------------------
// recomputeStandings — rebuild /standings per group on match finalize
// ---------------------------------------------------------------------------
//
// Triggered on every /matches/{matchId} write. When a group-phase match
// flips to 'finished' (or was already finished and got edited), we
// recompute every affected group's standings from scratch by reading all
// finished group matches for that group, aggregating per-team, and writing
// one /standings/{teamId} doc per row. The rank is computed after
// H2H → GD → GF tiebreakers (same logic as the client helper).

interface StandingAcc {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  groupId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface MatchShape {
  phase?: string;
  status?: string;
  groupId?: string;
  teamA?: { teamId?: string; name?: string; logoUrl?: string };
  teamB?: { teamId?: string; name?: string; logoUrl?: string };
  score?: { a?: number; b?: number };
}

export const recomputeStandings = functions
  .region('europe-west3')
  .firestore.document('tournaments/{tournamentId}/matches/{matchId}')
  .onWrite(async (change, context) => {
    const { tournamentId } = context.params as { tournamentId: string };
    const after = change.after.exists ? (change.after.data() as MatchShape) : null;
    const before = change.before.exists ? (change.before.data() as MatchShape) : null;

    // Collect the set of group ids that could need a refresh. A score
    // edit can bounce a team between groups only in theory, but we cover
    // both before/after defensively.
    const groupIds = new Set<string>();
    if (after?.phase === 'group' && after.groupId) groupIds.add(after.groupId);
    if (before?.phase === 'group' && before.groupId) groupIds.add(before.groupId);
    if (groupIds.size === 0) return;

    // Read all finished group matches once; we'll filter per group below.
    const allSnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .where('phase', '==', 'group')
      .where('status', '==', 'finished')
      .get();
    const allMatches = allSnap.docs.map((d) => d.data() as MatchShape);

    const tournamentSnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .get();
    const config = (tournamentSnap.data() as {
      config?: {
        tiebreakerOrder?: string[];
        qualifiersPerGroup?: number;
      };
    })?.config;
    const tiebreakerOrder = config?.tiebreakerOrder ?? ['h2h', 'gd', 'gf'];
    const qualifiersPerGroup = config?.qualifiersPerGroup ?? 2;

    for (const groupId of groupIds) {
      const groupMatches = allMatches.filter((m) => m.groupId === groupId);
      const rows = computeStandings(groupMatches, groupId);
      const sorted = sortStandings(rows, groupMatches, tiebreakerOrder);

      const batch = db.batch();
      for (let i = 0; i < sorted.length; i += 1) {
        const r = sorted[i];
        const ref = db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('standings')
          .doc(r.teamId);
        batch.set(ref, {
          ...r,
          rank: i + 1,
          groupName: '',
          h2hRecords: {},
          qualifiesForKnockout: i < qualifiersPerGroup,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  });

function computeStandings(matches: MatchShape[], groupId: string): StandingAcc[] {
  const rows = new Map<string, StandingAcc>();
  const ensure = (
    teamId: string | undefined,
    name: string | undefined,
    logo: string | undefined,
  ): StandingAcc | null => {
    if (!teamId) return null;
    const existing = rows.get(teamId);
    if (existing) return existing;
    const row: StandingAcc = {
      teamId,
      teamName: name ?? '',
      teamLogoUrl: logo,
      groupId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
    rows.set(teamId, row);
    return row;
  };

  for (const m of matches) {
    const aRow = ensure(m.teamA?.teamId, m.teamA?.name, m.teamA?.logoUrl);
    const bRow = ensure(m.teamB?.teamId, m.teamB?.name, m.teamB?.logoUrl);
    if (!aRow || !bRow) continue;
    const aScore = m.score?.a ?? 0;
    const bScore = m.score?.b ?? 0;
    aRow.played += 1;
    bRow.played += 1;
    aRow.goalsFor += aScore;
    aRow.goalsAgainst += bScore;
    bRow.goalsFor += bScore;
    bRow.goalsAgainst += aScore;
    if (aScore > bScore) {
      aRow.wins += 1;
      bRow.losses += 1;
      aRow.points += 3;
    } else if (aScore < bScore) {
      bRow.wins += 1;
      aRow.losses += 1;
      bRow.points += 3;
    } else {
      aRow.draws += 1;
      bRow.draws += 1;
      aRow.points += 1;
      bRow.points += 1;
    }
  }

  for (const r of rows.values()) r.goalDifference = r.goalsFor - r.goalsAgainst;
  return [...rows.values()];
}

function sortStandings(
  rows: StandingAcc[],
  matches: MatchShape[],
  order: string[],
): StandingAcc[] {
  return [...rows].sort((x, y) => {
    if (x.points !== y.points) return y.points - x.points;
    for (const key of order) {
      const cmp = compareByKey(x, y, key, matches);
      if (cmp !== 0) return cmp;
    }
    return x.teamName.localeCompare(y.teamName, 'sr');
  });
}

function compareByKey(
  x: StandingAcc,
  y: StandingAcc,
  key: string,
  matches: MatchShape[],
): number {
  if (key === 'gd') return y.goalDifference - x.goalDifference;
  if (key === 'gf') return y.goalsFor - x.goalsFor;
  if (key === 'ga') return x.goalsAgainst - y.goalsAgainst;
  if (key === 'h2h') {
    let xPts = 0;
    let yPts = 0;
    let xGf = 0;
    let yGf = 0;
    for (const m of matches) {
      const ids = [m.teamA?.teamId, m.teamB?.teamId];
      if (!ids.includes(x.teamId) || !ids.includes(y.teamId)) continue;
      const xIsA = m.teamA?.teamId === x.teamId;
      const xg = xIsA ? (m.score?.a ?? 0) : (m.score?.b ?? 0);
      const yg = xIsA ? (m.score?.b ?? 0) : (m.score?.a ?? 0);
      xGf += xg;
      yGf += yg;
      if (xg > yg) xPts += 3;
      else if (xg < yg) yPts += 3;
      else {
        xPts += 1;
        yPts += 1;
      }
    }
    if (xPts !== yPts) return yPts - xPts;
    return yGf - xGf;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// propagateBracketWinner — auto-fill the next knockout slot
// ---------------------------------------------------------------------------
//
// Bracket convention (8-team QF → 4-team SF → Final + 3rd place):
//   QF1 winner → SF1 teamA         QF2 winner → SF1 teamB
//   QF3 winner → SF2 teamA         QF4 winner → SF2 teamB
//   SF1 winner → FINAL teamA       SF2 winner → FINAL teamB
//   SF1 loser  → TP teamA          SF2 loser  → TP teamB
//
// 4-team bracket: QF slot advances straight to Final using the same rule
// (QF1 → FINAL.A, QF2 → FINAL.B, QF3 → TP.A, QF4 → TP.B). Admins that
// want a different layout can still edit slots manually.

interface SlotTarget {
  slot: string;
  side: 'a' | 'b';
}

function advancementMap(): Record<string, { winner?: SlotTarget; loser?: SlotTarget }> {
  return {
    QF1: { winner: { slot: 'SF1', side: 'a' } },
    QF2: { winner: { slot: 'SF1', side: 'b' } },
    QF3: { winner: { slot: 'SF2', side: 'a' } },
    QF4: { winner: { slot: 'SF2', side: 'b' } },
    SF1: {
      winner: { slot: 'FINAL', side: 'a' },
      loser: { slot: 'TP', side: 'a' },
    },
    SF2: {
      winner: { slot: 'FINAL', side: 'b' },
      loser: { slot: 'TP', side: 'b' },
    },
  };
}

// ---------------------------------------------------------------------------
// purgeRejectedPhotos — daily scheduled cleanup
// ---------------------------------------------------------------------------
//
// Runs once a day. Deletes storage objects + Firestore docs for photos
// whose status is 'rejected' and whose review happened more than 7 days
// ago. Uploaders get the 7-day grace window to file a takedown dispute.

export const purgeRejectedPhotos = functions
  .region('europe-west3')
  .pubsub.schedule('every 24 hours')
  .onRun(async () => {
    const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    );
    const snap = await db
      .collectionGroup('photos')
      .where('status', '==', 'rejected')
      .where('reviewedAt', '<=', sevenDaysAgo)
      .get();

    const batch = db.batch();
    const deletions: Promise<unknown>[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (data.storagePath) {
        deletions.push(
          bucket
            .file(data.storagePath)
            .delete()
            .catch(() => undefined),
        );
      }
      batch.delete(d.ref);
    }
    await Promise.all(deletions);
    await batch.commit();
  });

export const propagateBracketWinner = functions
  .region('europe-west3')
  .firestore.document('tournaments/{tournamentId}/matches/{matchId}')
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();
    if (!after || !before) return;

    // Only act when the match just turned into a finalized knockout match.
    if (after.phase !== 'knockout') return;
    const justFinished = before.status !== 'finished' && after.status === 'finished';
    if (!justFinished) return;
    if (!after.bracketSlot) return;

    const map = advancementMap()[after.bracketSlot as string];
    if (!map) return;

    const aScore = after.score?.a ?? 0;
    const bScore = after.score?.b ?? 0;
    const penaltyA = after.shootoutScore?.a ?? null;
    const penaltyB = after.shootoutScore?.b ?? null;
    let winnerSide: 'a' | 'b';
    if (aScore === bScore) {
      if (penaltyA === null || penaltyB === null) return; // tied, no shootout yet
      winnerSide = penaltyA > penaltyB ? 'a' : 'b';
    } else {
      winnerSide = aScore > bScore ? 'a' : 'b';
    }
    const winnerSnapshot = winnerSide === 'a' ? after.teamA : after.teamB;
    const loserSnapshot = winnerSide === 'a' ? after.teamB : after.teamA;

    const { tournamentId } = context.params as { tournamentId: string };
    const matchesRef = db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches');

    async function writeInto(target: SlotTarget | undefined, snapshot: unknown) {
      if (!target) return;
      const q = await matchesRef
        .where('phase', '==', 'knockout')
        .where('bracketSlot', '==', target.slot)
        .limit(1)
        .get();
      const doc = q.docs[0];
      if (!doc) return;
      await doc.ref.update({
        [target.side === 'a' ? 'teamA' : 'teamB']: snapshot,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await Promise.all([
      writeInto(map.winner, winnerSnapshot),
      writeInto(map.loser, loserSnapshot),
    ]);
  });
