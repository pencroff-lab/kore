/**
 * Core types for monadic error handling with Outcome.
 * Implementation lives in {@link Outcome} (outcome.ts).
 */

import type { Err } from "./err";

// ─── Group: Result types ─────────────────────────────────────────────────────

/**
 * Direct return types for errors or void success.
 * - `null`: void success (function completed, no value to return)
 * - `Err`: error (shorthand for `[null, Err]`)
 */
export type NullErr = null | Err;

/**
 * Tuple-based result with positional semantics.
 * - `[T, null]`: success with value
 * - `[null, Err]`: error
 */
export type ResultTuple<T> = [T, null] | [null, Err];

/**
 * Combined callback return type for `Outcome.from()` and `Outcome.fromAsync()`.
 * Supports tuple, null (void success), and Err (shorthand) patterns.
 *
 * Discrimination order: `Err.isErr()` → `=== null` → destructure tuple
 */
export type CallbackReturn<T> = ResultTuple<T> | NullErr;

// ─── Group: Pipe functions ───────────────────────────────────────────────────

/**
 * Synchronous pipe function type.
 * Receives a ResultTuple and returns a CallbackReturn.
 *
 * @typeParam In - Input value type
 * @typeParam Out - Output value type
 */
export type PipeFn<In, Out> = (tuple: ResultTuple<In>) => CallbackReturn<Out>;

/**
 * Asynchronous pipe function type.
 * Receives a ResultTuple and returns a Promise of CallbackReturn.
 *
 * @typeParam In - Input value type
 * @typeParam Out - Output value type
 */
export type PipeFnAsync<In, Out> = (
	tuple: ResultTuple<In>,
) => Promise<CallbackReturn<Out>>;
