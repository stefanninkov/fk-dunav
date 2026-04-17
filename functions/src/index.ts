/**
 * Firebase Cloud Functions entry point.
 *
 * Real functions land in later roadmap phases:
 *  - Phase 1: promoteAdminOnLogin (reads /adminEmails, sets admin claim).
 *  - Phase 4: recomputeMatchScore (aggregates events → match.score).
 *  - Phase 5: onMatchEvent (FCM push for goals, match start/end).
 *  - Phase 6: recomputeStandings, propagateBracketWinner.
 *  - Phase 7: createPhotoRecord, approvePhoto, rejectPhoto, purgeRejected,
 *             sendPendingDigestEmail.
 *  - Phase 9: generateOgCard.
 *
 * This placeholder ensures the /functions codebase compiles so `firebase
 * deploy --only functions` works from the start of the project.
 */
export const placeholder = { status: 'awaiting-implementation' as const };
