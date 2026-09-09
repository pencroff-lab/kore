import type { Err } from "./err";

// ─── Group: Result types ─────────────────────────────────────────────────────

/**
 * Tuple-based result with positional semantics, shared by the `flow` and
 * `Outcome` tiers.
 *
 * - `[T, null]`: success with value
 * - `[null, Err]`: failure
 *
 * The error slot is the discriminant — `ok(null)` is the valid success tuple
 * `[null, null]`. Readonly at the type level; nested payloads are not protected.
 */
export type ResultTuple<T> = readonly [T, null] | readonly [null, Err];
