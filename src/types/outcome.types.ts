import type { Err } from "./err";
import type { Outcome } from "./outcome";

// ─── Group: Result types ─────────────────────────────────────────────────────

/**
 * Tuple-based result with positional semantics.
 * - `[T, null]`: success with value
 * - `[null, Err]`: error
 */
export type ResultTuple<T> = [T, null] | [null, Err];

/**
 * Callback return under the value protocol.
 * - `Err`: failure
 * - `Outcome<T>`: passed through unchanged
 * - anything else: the success value
 */
export type CallbackReturn<T> = T | Err | Outcome<T>;

/**
 * Success value a value-protocol callback return resolves to.
 *
 * Distributes over unions, so `42 | Err` resolves to `42`.
 */
export type ValueOf<R> = R extends Err
	? never
	: R extends Outcome<infer V>
		? V
		: R;

// ─── Group: Pipe functions ───────────────────────────────────────────────────

/**
 * Synchronous pipe function type.
 * Receives a ResultTuple and returns a value-protocol result.
 *
 * @typeParam In - Input value type
 * @typeParam Out - Output value type
 */
export type PipeFn<In, Out> = (tuple: ResultTuple<In>) => CallbackReturn<Out>;

/**
 * Asynchronous pipe function type.
 * Receives a ResultTuple and returns a Promise of a value-protocol result.
 *
 * @typeParam In - Input value type
 * @typeParam Out - Output value type
 */
export type PipeFnAsync<In, Out> = (
	tuple: ResultTuple<In>,
) => Promise<CallbackReturn<Out>>;
