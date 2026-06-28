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

/**
 * Deeply walk an object/array and remove every property whose value is
 * `undefined`. Use this when a write payload contains nested shapes
 * (e.g. a Match doc with `teamA: { shortName: undefined }`) — the
 * shallow version above wouldn't catch the inner undefineds and the
 * write would fail with "Unsupported field value: undefined".
 *
 * Firestore-specific values (Timestamp, FieldValue from serverTimestamp(),
 * etc.) and other instances of classes are passed through as-is — we only
 * recurse into plain objects and arrays.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
