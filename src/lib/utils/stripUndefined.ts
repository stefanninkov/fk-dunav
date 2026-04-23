/**
 * Return a new object omitting any properties whose value is `undefined`.
 * Firestore rejects undefined field values (with an `Unsupported field
 * value` error), so every write path that takes optional user input has
 * to scrub them first. Use this at the boundary of any `setDoc` /
 * `updateDoc` call that accepts a partial shape.
 *
 * Null is preserved on purpose — Firestore accepts null and sometimes
 * we use it to mean "explicit empty" (e.g. `deletedAt`).
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}
