/**
 * Cloud Functions for the FK Dunav tournament app.
 *
 * The Admin SDK is initialized once at module scope.
 *
 * NOTE: `promoteAdminOnLogin` (a `beforeUserSignedIn` blocking trigger)
 * was removed: blocking Auth triggers require Google Cloud Identity
 * Platform (GCIP), which this project doesn't have. Admin promotion is
 * handled client-side in src/app/AppRoot.tsx — the client looks up its
 * own email in /adminEmails and, if present, writes /admins/{uid}; the
 * rules then treat that doc as proof of admin role.
 */

import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { v1 as firestoreV1 } from '@google-cloud/firestore';
import * as crypto from 'crypto';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();
const bucket = admin.storage().bucket();

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

// ---------------------------------------------------------------------------
// scheduledFirestoreBackup — weekly managed export to GCS
// ---------------------------------------------------------------------------
//
// Prerequisites (one-off, see /docs/ARCHITECTURE.md):
//   1. gsutil mb -p fk-dunav -l europe-west3 gs://fk-dunav-firestore-backups
//   2. Grant the Cloud Functions runtime service account roles:
//        roles/datastore.importExportAdmin   (on the project)
//        roles/storage.admin                 (on the bucket)
//
// We export everything (no collectionIds filter) once a week at 03:00 UTC on
// Sunday so week-over-week restoration is cheap. Output path is timestamped
// so each run lands in its own directory and retention can be managed via a
// GCS lifecycle rule on the bucket.

const BACKUP_BUCKET = 'fk-dunav-firestore-backups';
const firestoreAdminClient = new firestoreV1.FirestoreAdminClient();

// ---------------------------------------------------------------------------
// createPhotoRecord — anonymous-submission callable with IP rate limit
// ---------------------------------------------------------------------------
//
// Anonymous visitors can upload photos. To prevent abuse we cap submissions
// at PHOTO_RATE_LIMIT per IP per PHOTO_RATE_WINDOW_MS. Enforcement lives here
// (not in Firestore rules) because rules can't inspect the caller's IP.
// Corresponding rule change: /tournaments/{tid}/photos disallows anonymous
// creates so the only path from the public site is through this callable.
//
// App Check should be added in production — without it an attacker can still
// rotate IPs. For the 2026 tournament this is an acceptable interim control.

const PHOTO_RATE_LIMIT = 5;
const PHOTO_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface CreatePhotoInput {
  tournamentId: string;
  type: 'image' | 'video';
  storagePath: string;
  fullUrl: string;
  mimeType: string;
  sizeBytes: number;
  matchId?: string;
  teamIds?: string[];
  uploaderName?: string;
  uploaderUserAgent?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

function assertShape(input: unknown): asserts input is CreatePhotoInput {
  if (!input || typeof input !== 'object') {
    throw new HttpsError('invalid-argument', 'Body must be an object.');
  }
  const v = input as Record<string, unknown>;
  if (typeof v.tournamentId !== 'string' || !v.tournamentId) {
    throw new HttpsError('invalid-argument', 'tournamentId required');
  }
  if (v.type !== 'image' && v.type !== 'video') {
    throw new HttpsError('invalid-argument', 'type must be image|video');
  }
  if (typeof v.storagePath !== 'string' || !v.storagePath.startsWith('uploads/pending/')) {
    throw new HttpsError('invalid-argument', 'storagePath must start with uploads/pending/');
  }
  if (typeof v.fullUrl !== 'string' || !v.fullUrl) {
    throw new HttpsError('invalid-argument', 'fullUrl required');
  }
  if (typeof v.mimeType !== 'string' || !v.mimeType) {
    throw new HttpsError('invalid-argument', 'mimeType required');
  }
  if (typeof v.sizeBytes !== 'number' || v.sizeBytes <= 0) {
    throw new HttpsError('invalid-argument', 'sizeBytes must be positive');
  }
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`fk-dunav:${ip}`).digest('hex');
}

export const createPhotoRecord = onCall(
  { region: 'europe-west3', cors: true },
  async (request) => {
    assertShape(request.data);
    const input = request.data;

    const rawIp =
      (request.rawRequest.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      request.rawRequest.socket?.remoteAddress ||
      'unknown';
    const ipKey = hashIp(rawIp);

    // Rate-limit window: keep only timestamps inside the last hour, reject if
    // the caller already landed PHOTO_RATE_LIMIT submissions in that window.
    const now = Timestamp.now();
    const windowStartMs = now.toMillis() - PHOTO_RATE_WINDOW_MS;
    const rateRef = db.collection('photoRateLimits').doc(ipKey);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const raw = (snap.data()?.recent as Timestamp[] | undefined) ?? [];
      const recent = raw.filter((t) => t.toMillis() >= windowStartMs);
      if (recent.length >= PHOTO_RATE_LIMIT) {
        throw new HttpsError(
          'resource-exhausted',
          `Rate limit: max ${PHOTO_RATE_LIMIT} photos per ${PHOTO_RATE_WINDOW_MS / 60000} minutes.`,
        );
      }
      recent.push(now);
      tx.set(rateRef, { recent, updatedAt: FieldValue.serverTimestamp() });
    });

    const photoRef = db
      .collection('tournaments')
      .doc(input.tournamentId)
      .collection('photos')
      .doc();

    await photoRef.set({
      type: input.type,
      status: 'pending',
      storagePath: input.storagePath,
      fullUrl: input.fullUrl,
      videoUrl: input.type === 'video' ? input.fullUrl : undefined,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      matchId: input.matchId,
      teamIds: input.teamIds ?? [],
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      uploaderName: input.uploaderName,
      uploaderUserAgent: input.uploaderUserAgent,
      uploadedAt: FieldValue.serverTimestamp(),
      takedownRequested: false,
    });

    return { photoId: photoRef.id };
  },
);

export const scheduledFirestoreBackup = functions
  .region('europe-west3')
  .pubsub.schedule('0 3 * * 0') // Sunday 03:00 UTC
  .timeZone('Etc/UTC')
  .onRun(async () => {
    const projectId =
      process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'fk-dunav';
    const databaseName = firestoreAdminClient.databasePath(projectId, '(default)');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const [operation] = await firestoreAdminClient.exportDocuments({
      name: databaseName,
      outputUriPrefix: `gs://${BACKUP_BUCKET}/backups/${stamp}`,
      collectionIds: [], // empty = all collections
    });
    functions.logger.info('Firestore export started', {
      operation: operation.name,
      outputUri: `gs://${BACKUP_BUCKET}/backups/${stamp}`,
    });
  });
