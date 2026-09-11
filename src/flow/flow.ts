/**
 * Result tuples as free functions — the tuple tier of the package.
 *
 * `flow` operates directly on `ResultTuple<T>`: `[value, null]` on success,
 * `[null, Err]` on failure. There is no container to construct or unwrap, so a
 * result destructures at any point and every operation is a plain function.
 *
 * **Key concepts:**
 * - **One fallible protocol** — every fallible callback returns a `ResultTuple`.
 *   The error slot is the only failure signal; no operator inspects a value's
 *   runtime shape. `map` is the single exception: its return is always data.
 * - **`ok` / `fail` are the boundary** — `ok(err)` and `ok(tuple)` carry
 *   error- or tuple-shaped values as successful data.
 * - **Exception boundaries** — `attempt`/`attemptAsync`, every callback-taking
 *   operation, and every pipeline stage convert a throw into `Err.from(caught)`.
 * - **Input protection** — a pipeline copies its source once on entry, and tuple
 *   callbacks receive a copy. Payloads are never cloned.
 * - **Error enrichment** lives on `Err`: use `mapErr`/`onErr` and chain
 *   `wrap`, `withCode`, `withMetadata` inside the callback.
 *
 * @see [flow.examples.test.ts](../../src/flow/flow.examples.test.ts) for usage patterns
 * @module flow
 */

import type { ResultTuple } from "../types/common.types";
import { Err, type ErrCode } from "../types/err";
import type { AnyOp, AsyncSource, OkValues, Op, OpAsync } from "./flow.types";

export type { ResultTuple } from "../types/common.types";
export type {
	AnyOp,
	AsyncSource,
	OkValue,
	OkValues,
	Op,
	OpAsync,
} from "./flow.types";

// ══════════════════════════════════════════════════════════════════════════
// Result boundaries
// ══════════════════════════════════════════════════════════════════════════

/**
 * Copy a result tuple, keeping its narrowed type.
 *
 * Two slots only — the payload is shared, not cloned.
 *
 * @param tuple - Tuple to copy
 * @returns A new tuple with the same slots
 */
export function copy<T extends ResultTuple<unknown>>(tuple: T): T {
	return [tuple[0], tuple[1]] as unknown as T;
}

/**
 * Create a success tuple with no value.
 *
 * @returns `[undefined, null]`
 */
export function ok(): ResultTuple<void>;

/**
 * Create a success tuple carrying a value.
 *
 * The value is never inspected: `ok(err)` and `ok(tuple)` carry error- and
 * tuple-shaped data as success.
 *
 * @param value - The success value
 * @returns `[value, null]`
 */
export function ok<T>(value: T): ResultTuple<T>;

/* Implementation for ok(). An absent argument yields `undefined`. */
export function ok<T>(...args: [] | [T]): ResultTuple<T> {
	return [args[0] as T, null];
}

/**
 * Create a failure tuple.
 *
 * An existing `Err` is preserved by reference unless a code is supplied, in
 * which case it is cloned with that code. Richer construction — metadata, a
 * wrapped native error, a serialized payload — goes through `Err.from(...)` and
 * is then passed here as `fail(err)`.
 *
 * @param error - An existing `Err`, or a message to build one from
 * @param code - Optional error code
 * @returns `[null, Err]`
 */
export function fail(error: Err | string, code?: ErrCode): ResultTuple<never> {
	if (typeof error === "string") {
		return [null, Err.from(error, code)];
	}
	return [null, code === undefined ? error : Err.from(error, { code })];
}

/**
 * Run a fallible callback, converting a throw into a failure tuple.
 *
 * @param fn - Callback returning a result tuple
 * @returns The callback's tuple, or `Err.from(caught)` as a failure
 */
export function attempt<T>(fn: () => ResultTuple<T>): ResultTuple<T> {
	try {
		return fn();
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Async counterpart of `attempt()`. Converts throws and rejections.
 *
 * @param fn - Async callback returning a result tuple
 * @returns Promise of the callback's tuple, or of a failure
 */
export async function attemptAsync<T>(
	fn: () => Promise<ResultTuple<T>>,
): Promise<ResultTuple<T>> {
	try {
		return await fn();
	} catch (e) {
		return [null, Err.from(e)];
	}
}

// ══════════════════════════════════════════════════════════════════════════
// Data-first transformations
// ══════════════════════════════════════════════════════════════════════════

/**
 * Transform a success value with a total function.
 *
 * Return-preserving: the callback's return is the success value even when it is
 * an `Err`, a native `Error`, or a tuple. A failure passes through by reference.
 *
 * @param tuple - Source result
 * @param fn - Transformation applied to the success value
 * @returns Transformed success, the original failure, or a caught throw
 */
export function map<In, Out>(
	tuple: ResultTuple<In>,
	fn: (value: In) => Out,
): ResultTuple<Out> {
	if (tuple[1] !== null) return tuple;
	try {
		return [fn(tuple[0]), null];
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Async counterpart of `map()`.
 *
 * @param tuple - Source result
 * @param fn - Async transformation applied to the success value
 * @returns Promise of the transformed result
 */
export async function mapAsync<In, Out>(
	tuple: ResultTuple<In>,
	fn: (value: In) => Promise<Out>,
): Promise<ResultTuple<Out>> {
	if (tuple[1] !== null) return tuple;
	try {
		return [await fn(tuple[0]), null];
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Chain a fallible callback on the success channel.
 *
 * The callback's tuple is returned by reference, so a tuple-returning callee
 * composes directly: `flatMap(ok(project), readConfig)`. A failure passes
 * through by reference.
 *
 * @param tuple - Source result
 * @param fn - Callback returning a result tuple
 * @returns The callback's tuple, the original failure, or a caught throw
 */
export function flatMap<In, Out>(
	tuple: ResultTuple<In>,
	fn: (value: In) => ResultTuple<Out>,
): ResultTuple<Out> {
	if (tuple[1] !== null) return tuple;
	try {
		return fn(tuple[0]);
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Async counterpart of `flatMap()`.
 *
 * @param tuple - Source result
 * @param fn - Async callback returning a result tuple
 * @returns Promise of the resulting tuple
 */
export async function flatMapAsync<In, Out>(
	tuple: ResultTuple<In>,
	fn: (value: In) => Promise<ResultTuple<Out>>,
): Promise<ResultTuple<Out>> {
	if (tuple[1] !== null) return tuple;
	try {
		return await fn(tuple[0]);
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Transform or recover from a failure.
 *
 * `fail(error.wrap(...))` replaces the error, `ok(value)` recovers, and
 * `ok(error)` recovers with the error as data. A success passes through by
 * reference.
 *
 * @param tuple - Source result
 * @param fn - Callback receiving the error and returning a result tuple
 * @returns The callback's tuple, the original success, or a caught throw
 */
export function mapErr<In, Out>(
	tuple: ResultTuple<In>,
	fn: (error: Err) => ResultTuple<Out>,
): ResultTuple<In | Out> {
	if (tuple[1] === null) return tuple;
	try {
		return fn(tuple[1]);
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Async counterpart of `mapErr()`.
 *
 * @param tuple - Source result
 * @param fn - Async callback receiving the error
 * @returns Promise of the resulting tuple
 */
export async function mapErrAsync<In, Out>(
	tuple: ResultTuple<In>,
	fn: (error: Err) => Promise<ResultTuple<Out>>,
): Promise<ResultTuple<In | Out>> {
	if (tuple[1] === null) return tuple;
	try {
		return await fn(tuple[1]);
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Run a side effect on either channel.
 *
 * The callback receives the returned copy, not the caller's tuple, and its
 * normal return value is ignored. A throw becomes the failure.
 *
 * @param tuple - Source result
 * @param fn - Side effect receiving the output tuple
 * @returns The output copy, or a caught throw as a failure
 */
export function effect<T>(
	tuple: ResultTuple<T>,
	fn: (tuple: ResultTuple<T>) => void,
): ResultTuple<T> {
	const out = copy(tuple);
	try {
		fn(out);
		return out;
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Async counterpart of `effect()`.
 *
 * @param tuple - Source result
 * @param fn - Async side effect receiving the output tuple
 * @returns Promise of the output copy, or of a failure
 */
export async function effectAsync<T>(
	tuple: ResultTuple<T>,
	fn: (tuple: ResultTuple<T>) => Promise<void>,
): Promise<ResultTuple<T>> {
	const out = copy(tuple);
	try {
		await fn(out);
		return out;
	} catch (e) {
		return [null, Err.from(e)];
	}
}

/**
 * Validate a success value, optionally refining its type.
 *
 * A passing predicate returns the original success tuple untouched; a failing
 * one builds the error lazily. A throw from either callback becomes the
 * failure. A failure input passes through and calls neither callback.
 *
 * @param tuple - Source result
 * @param predicate - Type predicate or boolean test
 * @param toErr - Error factory, called only when the predicate fails
 * @returns The original success, a constructed failure, or a caught throw
 */
export function ensure<T, S extends T = T>(
	tuple: ResultTuple<T>,
	predicate: ((value: T) => value is S) | ((value: T) => boolean),
	toErr: (value: T) => Err,
): ResultTuple<S> {
	if (tuple[1] !== null) return tuple;
	const value = tuple[0];
	try {
		if (predicate(value)) return tuple as ResultTuple<S>;
		return [null, toErr(value)];
	} catch (e) {
		return [null, Err.from(e)];
	}
}

// ══════════════════════════════════════════════════════════════════════════
// Pipeline factories
// ══════════════════════════════════════════════════════════════════════════

/**
 * Stage running a fallible callback on the success value.
 *
 * @param fn - Callback returning a result tuple
 * @returns A synchronous pipeline stage
 */
export function onOk<In, Out>(
	fn: (value: In) => ResultTuple<Out>,
): Op<In, Out> {
	return (tuple) => flatMap(tuple, fn);
}

/**
 * Async counterpart of `onOk()`.
 *
 * @param fn - Async callback returning a result tuple
 * @returns An asynchronous pipeline stage
 */
export function onOkAsync<In, Out>(
	fn: (value: In) => Promise<ResultTuple<Out>>,
): OpAsync<In, Out> {
	return (tuple) => flatMapAsync(tuple, fn);
}

/**
 * Stage running a callback on the error channel.
 *
 * The stage — not this factory — is generic in the pipeline's success type. An
 * error callback offers no site from which `In` could be inferred, so a factory
 * type parameter would collapse to `unknown` as soon as the stage is stored in
 * a variable, widening the whole pipeline.
 *
 * @param fn - Callback receiving the error and returning a result tuple
 * @returns A synchronous pipeline stage that preserves the success type
 */
export function onErr<Out>(
	fn: (error: Err) => ResultTuple<Out>,
): <In>(tuple: ResultTuple<In>) => ResultTuple<In | Out> {
	return (tuple) => mapErr(tuple, fn);
}

/**
 * Async counterpart of `onErr()`.
 *
 * @param fn - Async callback receiving the error
 * @returns An asynchronous pipeline stage that preserves the success type
 */
export function onErrAsync<Out>(
	fn: (error: Err) => Promise<ResultTuple<Out>>,
): <In>(tuple: ResultTuple<In>) => Promise<ResultTuple<In | Out>> {
	return (tuple) => mapErrAsync(tuple, fn);
}

/**
 * Stage running a callback on a copy of the whole tuple, on either channel.
 *
 * @param fn - Callback receiving a tuple copy and returning a result tuple
 * @returns A synchronous pipeline stage
 */
export function onTuple<In, Out>(
	fn: (tuple: ResultTuple<In>) => ResultTuple<Out>,
): Op<In, Out> {
	return (tuple) => attempt(() => fn(copy(tuple)));
}

/**
 * Async counterpart of `onTuple()`.
 *
 * @param fn - Async callback receiving a tuple copy
 * @returns An asynchronous pipeline stage
 */
export function onTupleAsync<In, Out>(
	fn: (tuple: ResultTuple<In>) => Promise<ResultTuple<Out>>,
): OpAsync<In, Out> {
	return (tuple) => attemptAsync(() => fn(copy(tuple)));
}

// ══════════════════════════════════════════════════════════════════════════
// Pipelines
// ══════════════════════════════════════════════════════════════════════════

/**
 * Run synchronous stages over a result tuple.
 *
 * The source is copied once on entry, and each stage is caught separately so a
 * later `onErr` stage can recover. Typed through ten stages; past that the
 * result widens to `ResultTuple<unknown>`.
 *
 * @see {@link pipeAsync} for asynchronous and mixed stages
 */
export function pipe<A>(source: ResultTuple<A>): ResultTuple<A>;
export function pipe<A, B>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
): ResultTuple<B>;
export function pipe<A, B, C>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
): ResultTuple<C>;
export function pipe<A, B, C, D>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
): ResultTuple<D>;
export function pipe<A, B, C, D, E>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
	op4: Op<D, E>,
): ResultTuple<E>;
export function pipe<A, B, C, D, E, F>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
	op4: Op<D, E>,
	op5: Op<E, F>,
): ResultTuple<F>;
export function pipe<A, B, C, D, E, F, G>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
	op4: Op<D, E>,
	op5: Op<E, F>,
	op6: Op<F, G>,
): ResultTuple<G>;
export function pipe<A, B, C, D, E, F, G, H>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
	op4: Op<D, E>,
	op5: Op<E, F>,
	op6: Op<F, G>,
	op7: Op<G, H>,
): ResultTuple<H>;
export function pipe<A, B, C, D, E, F, G, H, I>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
	op4: Op<D, E>,
	op5: Op<E, F>,
	op6: Op<F, G>,
	op7: Op<G, H>,
	op8: Op<H, I>,
): ResultTuple<I>;
export function pipe<A, B, C, D, E, F, G, H, I, J>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
	op4: Op<D, E>,
	op5: Op<E, F>,
	op6: Op<F, G>,
	op7: Op<G, H>,
	op8: Op<H, I>,
	op9: Op<I, J>,
): ResultTuple<J>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K>(
	source: ResultTuple<A>,
	op1: Op<A, B>,
	op2: Op<B, C>,
	op3: Op<C, D>,
	op4: Op<D, E>,
	op5: Op<E, F>,
	op6: Op<F, G>,
	op7: Op<G, H>,
	op8: Op<H, I>,
	op9: Op<I, J>,
	op10: Op<J, K>,
): ResultTuple<K>;

/* Past ten stages the ladder falls off: stages and result widen. */
export function pipe(
	source: ResultTuple<unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: widened stages stay assignable
	...ops: Array<Op<any, any>>
): ResultTuple<unknown>;

/* Implementation for pipe overloads. */
export function pipe(
	source: ResultTuple<unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
	...ops: Array<Op<any, any>>
): ResultTuple<unknown> {
	let current: ResultTuple<unknown> = copy(source);
	for (const op of ops) {
		try {
			current = op(current);
		} catch (e) {
			current = [null, Err.from(e)];
		}
	}
	return current;
}

/**
 * Run synchronous and asynchronous stages over a result tuple or a promise of
 * one.
 *
 * A rejected source enters the failure channel before the first stage, so a
 * later `onErr` stage can still recover. Typed through ten stages.
 *
 * @see {@link pipe} for the synchronous version
 */
export function pipeAsync<A>(source: AsyncSource<A>): Promise<ResultTuple<A>>;
export function pipeAsync<A, B>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
): Promise<ResultTuple<B>>;
export function pipeAsync<A, B, C>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
): Promise<ResultTuple<C>>;
export function pipeAsync<A, B, C, D>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
): Promise<ResultTuple<D>>;
export function pipeAsync<A, B, C, D, E>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
	op4: AnyOp<D, E>,
): Promise<ResultTuple<E>>;
export function pipeAsync<A, B, C, D, E, F>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
	op4: AnyOp<D, E>,
	op5: AnyOp<E, F>,
): Promise<ResultTuple<F>>;
export function pipeAsync<A, B, C, D, E, F, G>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
	op4: AnyOp<D, E>,
	op5: AnyOp<E, F>,
	op6: AnyOp<F, G>,
): Promise<ResultTuple<G>>;
export function pipeAsync<A, B, C, D, E, F, G, H>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
	op4: AnyOp<D, E>,
	op5: AnyOp<E, F>,
	op6: AnyOp<F, G>,
	op7: AnyOp<G, H>,
): Promise<ResultTuple<H>>;
export function pipeAsync<A, B, C, D, E, F, G, H, I>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
	op4: AnyOp<D, E>,
	op5: AnyOp<E, F>,
	op6: AnyOp<F, G>,
	op7: AnyOp<G, H>,
	op8: AnyOp<H, I>,
): Promise<ResultTuple<I>>;
export function pipeAsync<A, B, C, D, E, F, G, H, I, J>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
	op4: AnyOp<D, E>,
	op5: AnyOp<E, F>,
	op6: AnyOp<F, G>,
	op7: AnyOp<G, H>,
	op8: AnyOp<H, I>,
	op9: AnyOp<I, J>,
): Promise<ResultTuple<J>>;
export function pipeAsync<A, B, C, D, E, F, G, H, I, J, K>(
	source: AsyncSource<A>,
	op1: AnyOp<A, B>,
	op2: AnyOp<B, C>,
	op3: AnyOp<C, D>,
	op4: AnyOp<D, E>,
	op5: AnyOp<E, F>,
	op6: AnyOp<F, G>,
	op7: AnyOp<G, H>,
	op8: AnyOp<H, I>,
	op9: AnyOp<I, J>,
	op10: AnyOp<J, K>,
): Promise<ResultTuple<K>>;

/* Past ten stages the ladder falls off: stages and result widen. */
export function pipeAsync(
	source: AsyncSource<unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: widened stages stay assignable
	...ops: Array<AnyOp<any, any>>
): Promise<ResultTuple<unknown>>;

/* Implementation for pipeAsync overloads. */
export async function pipeAsync(
	source: AsyncSource<unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
	...ops: Array<AnyOp<any, any>>
): Promise<ResultTuple<unknown>> {
	let current: ResultTuple<unknown>;
	try {
		current = copy(await source);
	} catch (e) {
		current = [null, Err.from(e)];
	}
	for (const op of ops) {
		try {
			current = await op(current);
		} catch (e) {
			current = [null, Err.from(e)];
		}
	}
	return current;
}

// ══════════════════════════════════════════════════════════════════════════
// Terminal operations
// ══════════════════════════════════════════════════════════════════════════

/**
 * Extract the success value, or compute a fallback from the error.
 *
 * Handler-only: a constant fallback is `defaultTo(tuple, () => 0)`. The handler
 * is lazy and its exceptions propagate — this operation adds no catch boundary.
 *
 * @param tuple - Source result
 * @param onErr - Handler called only on the failure branch
 * @returns The success value, or the handler's result
 */
export function defaultTo<T>(
	tuple: ResultTuple<T>,
	onErr: (error: Err) => T,
): T {
	if (tuple[1] === null) return tuple[0];
	return onErr(tuple[1]);
}

/**
 * Fold both channels to a common output type. Handler exceptions propagate.
 *
 * @param tuple - Source result
 * @param onOk - Handler for the success value
 * @param onErr - Handler for the error
 * @returns The selected handler's result
 */
export function either<T, U>(
	tuple: ResultTuple<T>,
	onOk: (value: T) => U,
	onErr: (error: Err) => U,
): U {
	if (tuple[1] === null) return onOk(tuple[0]);
	return onErr(tuple[1]);
}

// ══════════════════════════════════════════════════════════════════════════
// Collections
// ══════════════════════════════════════════════════════════════════════════

/**
 * Combine already-evaluated results, succeeding only if every one succeeded.
 *
 * Order-preserving and non-short-circuiting: every failure is collected into one
 * aggregate `Err`. Heterogeneous input infers a tuple of success types. Empty
 * input succeeds with `[]`.
 *
 * @param results - Result tuples to combine
 * @returns Success with all values, or one aggregate failure
 */
export function all<T extends readonly ResultTuple<unknown>[]>(
	results: T,
): ResultTuple<OkValues<T>> {
	const values: unknown[] = [];
	const errors: Err[] = [];

	for (const result of results) {
		if (result[1] === null) {
			values.push(result[0]);
			continue;
		}
		errors.push(result[1]);
	}

	if (errors.length > 0) {
		return [null, Err.from("Multiple failed").addAll(errors)];
	}
	return [values as OkValues<T>, null];
}

/**
 * Return the first successful result, by reference.
 *
 * The winning tuple is the caller's own, not a copy. If every input failed the
 * errors are aggregated; empty input fails with code `EMPTY_INPUT`.
 *
 * @param results - Result tuples to check
 * @returns The first success, or an aggregate failure
 */
export function any<T>(results: readonly ResultTuple<T>[]): ResultTuple<T> {
	if (results.length === 0) {
		return [null, Err.from("No results provided", "EMPTY_INPUT")];
	}

	const errors: Err[] = [];
	for (const result of results) {
		if (result[1] === null) return result;
		errors.push(result[1]);
	}
	return [null, Err.from("All failed").addAll(errors)];
}

// ══════════════════════════════════════════════════════════════════════════
// Serialization
// ══════════════════════════════════════════════════════════════════════════

// Deterministic rejection used by every fromJSON validation row.
function invalidJSON(reason: string, payload: unknown): ResultTuple<never> {
	return [
		null,
		Err.from(`Invalid JSON result: ${reason}`, {
			code: "INVALID_JSON",
			metadata: { originalValue: payload },
		}),
	];
}

/**
 * Reconstruct a result tuple from `JSON.parse` output.
 *
 * Validation covers the envelope and the error slot only — `T` is a caller
 * assertion, not a decode, and an error-shaped success payload is preserved
 * unchanged. Never throws: every invalid input returns an `INVALID_JSON`
 * failure carrying the payload as `originalValue` metadata. `ok()` serializes
 * to `[null, null]` and reconstructs as `ok(null)`; `void` does not round-trip.
 *
 * @param payload - Parsed JSON value
 * @returns The reconstructed tuple, or an `INVALID_JSON` failure
 */
export function fromJSON<T>(payload: unknown): ResultTuple<T> {
	if (!Array.isArray(payload) || payload.length !== 2) {
		return invalidJSON("expected a two-element tuple", payload);
	}

	const [value, error] = payload as [unknown, unknown];
	if (error === null) {
		return [value as T, null];
	}
	if (value !== null) {
		return invalidJSON("both value and error slots are set", payload);
	}

	try {
		return [null, Err.fromJSON(error)];
	} catch {
		return invalidJSON("invalid serialized error", payload);
	}
}
