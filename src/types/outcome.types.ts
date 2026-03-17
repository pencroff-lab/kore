/**
 * Monadic container for safe success/error propagation using tuple-first design.
 *
 * `Outcome<T>` wraps a `ResultTuple<T>` — either `[T, null]` (success) or
 * `[null, Err]` (error) — and provides chainable transforms (`map`, `pipe`),
 * combinators (`all`, `any`), and terminal operations (`toTuple`, `defaultTo`,
 * `either`). Callbacks may return tuples, `null` (void success), or a bare
 * `Err` (shorthand error).
 *
 * **Key concepts:**
 * - **Tuple-first** — `toTuple()` is the primary extraction; destructure as `[val, err]`.
 * - **Immutability** — every transform returns a new `Outcome`, never mutates.
 * - **Auto-catch** — `from`, `map`, and `pipe` catch thrown exceptions and wrap them as `Err`.
 * - **Combinators** — `all` collects every error (non-short-circuit), `any` short-circuits on first success.
 *
 * @example
 * const [val, err] = Outcome.ok(42).map(n => [n * 2, null]).toTuple();
 *
 * @see [outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) for usage patterns
 * @module outcome
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
