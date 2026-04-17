/**
 * Firebase Cloud Functions entry point.
 *
 * Real functions land in later roadmap weeks:
 *  - Week 1: promoteAdminOnLogin (reads /adminEmails, sets admin claim).
 *  - Week 4: recomputeMatchScore (aggregates events → match.score).
 *  - Week 5: onMatchEvent (FCM push for goals, match start/end).
 *  - Week 6: recomputeStandings, propagateBracketWinner.
 *  - Week 7: createPhotoRecord, approvePhoto, rejectPhoto, purgeRejected,
 *            sendPendingDigestEmail.
 *  - Week 9: generateOgCard.
 *
 * This placeholder ensures the /functions codebase compiles so `firebase
 * deploy --only functions` works from the start of the project.
 */
export const placeholder = { status: 'awaiting-implementation' as const };
