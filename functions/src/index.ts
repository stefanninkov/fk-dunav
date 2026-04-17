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

// ---------------------------------------------------------------------------
// promoteAdminOnLogin — v2 Identity Platform trigger
// ---------------------------------------------------------------------------

export const promoteAdminOnLogin = beforeUserSignedIn(
  { region: 'europe-west3' },
  async (event) => {
    const email = event.data?.email;
    if (!email) return {};
    const seed = await db.collection('adminEmails').doc(email).get();
    if (!seed.exists) return {};
    return {
      customClaims: { role: 'admin' },
    };
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
