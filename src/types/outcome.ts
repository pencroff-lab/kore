/**
 * Monadic container for safe success/error propagation using tuple-first design.
 *
 * `Outcome<T>` wraps a `ResultTuple<T>` — either `[T, null]` (success) or
 * `[null, Err]` (error) — and provides chainable transforms (`map`, `flatMap`,
 * `pipe`), combinators (`all`, `any`), and terminal operations (`toTuple`,
 * `defaultTo`, `either`).
 *
 * **Key concepts:**
 * - **Tuple-first** — `toTuple()` is the primary extraction; destructure as `[val, err]`.
 * - **Immutability** — every transform returns a new `Outcome`, never mutates.
 * - **map vs flatMap** — `map` takes `(T) => U` and cannot fail; `flatMap` takes
 *   `(T) => Outcome<U>` and can. Tuple/`Err` returns are data in `map`, never control flow.
 * - **Value protocol** — in `from`/`fromAsync`, `flatMap`, `mapErr` and `pipe` a returned
 *   `Err` is a failure, a returned `Outcome` passes through, and anything else is the
 *   success value. Use `Outcome.ok(x)` to carry an `Err` or an `Outcome` as a value.
 * - **Tuple protocol** — `fromTuple`/`fromTupleAsync` are the only entry points that read
 *   `[value, error]` as control flow; everywhere else a tuple is an ordinary array value.
 * - **Auto-catch** — `from`, `fromTuple`, `map`, `flatMap` and `pipe` catch thrown exceptions and wrap them as `Err`.
 * - **Combinators** — `all` collects every error (non-short-circuit), `any` short-circuits on first success.
 * @see [outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) for usage patterns
 * @module outcome
 */

import { Err, type ErrCode, type ErrOptions } from "./err";
import type {
	CallbackReturn,
	PipeFn,
	PipeFnAsync,
	ResultTuple,
	ValueOf,
} from "./outcome.types";

export type { CallbackReturn, PipeFn, PipeFnAsync, ResultTuple, ValueOf };

/**
 * A monadic container for handling success and error states.
 * Uses tuples as the primary interface; `toTuple()` is the sole extraction.
 *
 * The container is immutable — every transform returns a new instance. The value
 * it carries is yours: it is never copied or frozen, so mutating it after
 * wrapping is visible through the `Outcome`. (`Err.metadata` is copied and frozen
 * because errors are a cold path; `T` is not.)
 *
 * @typeParam T - The type of the success value
 */
export class Outcome<T> {
	// Set once when a callback returns the pre-v0.7.0 `[value, error]` control
	// shape, so the migration warning is emitted at most once per process.
	private static _legacyTupleWarned = false;

	/** Internal tuple storage */
	private readonly _tuple: ResultTuple<T>;

	/**
	 * Private constructor - use static factory methods.
	 * @internal
	 */
	private constructor(tuple: ResultTuple<T>) {
		this._tuple = tuple;
	}

	// Internal success check — the single source of truth for state, now that the
	// public `isOk`/`isErr` accessors are gone.
	private get _ok(): boolean {
		return this._tuple[1] === null;
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Static Constructors
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Create a success Outcome with no value (void success).
	 *
	 * @returns Outcome<void> carrying `undefined`
	 */
	static ok(): Outcome<void>;

	/**
	 * Create a success Outcome carrying an explicit `null` value.
	 *
	 * @param value - The literal `null`
	 * @returns Outcome<null>
	 */
	static ok(value: null): Outcome<null>;

	/**
	 * Create a success Outcome with the given value.
	 *
	 * @param value - The success value
	 * @returns Outcome containing the success value
	 */
	static ok<T>(value: T): Outcome<T>;

	/* Implementation signature for ok(). Absent argument yields `undefined`. */
	static ok<T>(...args: [] | [T]): Outcome<T> {
		return new Outcome<T>([args[0] as T, null]);
	}

	/**
	 * Create an error Outcome from an existing Err.
	 *
	 * @typeParam T - Success type to claim, so the result chains (defaults to `never`)
	 * @param error - The Err instance
	 * @returns Outcome in error state
	 */
	static err<T = never>(error: Err): Outcome<T>;

	/**
	 * Create an error Outcome from a message with optional code.
	 *
	 * @param message - Error message
	 * @param code - Optional error code
	 * @returns Outcome in error state
	 */
	static err<T = never>(message: string, code?: ErrCode): Outcome<T>;

	/**
	 * Create an error Outcome from a message with options.
	 *
	 * @param message - Error message
	 * @param options - Error options (code, metadata)
	 * @returns Outcome in error state
	 */
	static err<T = never>(message: string, options: ErrOptions): Outcome<T>;

	/**
	 * Create an error Outcome by wrapping another error.
	 *
	 * @param message - Context message
	 * @param error - Original error to wrap
	 * @param options - Optional additional options
	 * @returns Outcome in error state with wrapped cause
	 */
	static err<T = never>(
		message: string,
		error: Err | Error,
		options?: ErrOptions,
	): Outcome<T>;

	/* Implementation signature for err(). */
	static err<T = never>(
		messageOrErr: string | Err,
		codeOrOptionsOrErr?: ErrCode | ErrOptions | Err | Error,
		options?: ErrOptions,
	): Outcome<T> {
		// If first arg is already an Err, use it directly
		if (Err.isErr(messageOrErr)) {
			return new Outcome<T>([null, messageOrErr]);
		}

		const message = messageOrErr;

		// If second arg is Err or Error, wrap it
		if (Err.isErr(codeOrOptionsOrErr) || codeOrOptionsOrErr instanceof Error) {
			const cause = Err.isErr(codeOrOptionsOrErr)
				? codeOrOptionsOrErr
				: Err.from(codeOrOptionsOrErr);
			const wrapped = cause.wrap(message, options);
			return new Outcome<T>([null, wrapped]);
		}

		// Otherwise, create new Err with message and options/code
		// biome-ignore lint/suspicious/noExplicitAny: overloaded argument handling
		const err = Err.from(message, codeOrOptionsOrErr as any);
		return new Outcome<T>([null, err]);
	}

	/**
	 * Create an Outcome from a callback, under the value protocol.
	 *
	 * An `Err`-valued success cannot be expressed here: `from(() => someErr)` is a
	 * failure typed `Outcome<never>`. Use `Outcome.ok(someErr)` instead.
	 *
	 * @param fn - Callback returning the success value, an `Err` or an `Outcome`
	 * @returns Outcome carrying the resolved success value
	 * @see {@link fromAsync} for the async version
	 * @see {@link fromTuple} for callbacks returning a `[value, error]` tuple
	 * @see {@link err} for an unconditional failure
	 */
	static from<R>(fn: () => R): Outcome<ValueOf<R>> {
		try {
			return Outcome._processCallbackReturn(fn());
		} catch (e) {
			return new Outcome<ValueOf<R>>([null, Err.from(e)]);
		}
	}

	/**
	 * Create an Outcome from an async callback, under the value protocol.
	 *
	 * @param fn - Async callback returning the success value, an `Err` or an `Outcome`
	 * @returns Promise of an Outcome carrying the resolved success value
	 * @see {@link from} for the synchronous version
	 * @see {@link fromTupleAsync} for callbacks returning a `[value, error]` tuple
	 */
	static async fromAsync<R>(
		fn: () => Promise<R>,
	): Promise<Outcome<ValueOf<R>>> {
		try {
			return Outcome._processCallbackReturn(await fn());
		} catch (e) {
			return new Outcome<ValueOf<R>>([null, Err.from(e)]);
		}
	}

	/**
	 * Create an Outcome from a ResultTuple, or from a callback producing one.
	 *
	 * This is the only entry point that reads `[value, error]` as control flow. The
	 * callback form runs inside try/catch, so a throw becomes an error Outcome.
	 *
	 * @param src - A ResultTuple<T>, or a callback returning one
	 * @returns Outcome<T>
	 * @see {@link toTuple} for extracting the tuple from an Outcome
	 * @see {@link from} for the value protocol
	 */
	static fromTuple<T>(
		src: ResultTuple<T> | (() => ResultTuple<T>),
	): Outcome<T> {
		if (typeof src !== "function") {
			return new Outcome<T>([src[0], src[1]] as ResultTuple<T>);
		}
		try {
			const tuple = src();
			return new Outcome<T>([tuple[0], tuple[1]] as ResultTuple<T>);
		} catch (e) {
			return new Outcome<T>([null, Err.from(e)]);
		}
	}

	/**
	 * Async counterpart of `fromTuple()`.
	 *
	 * @param src - A Promise of a ResultTuple<T>, or a callback returning one
	 * @returns Promise<Outcome<T>>
	 * @see {@link fromTuple} for the synchronous version
	 */
	static async fromTupleAsync<T>(
		src: Promise<ResultTuple<T>> | (() => Promise<ResultTuple<T>>),
	): Promise<Outcome<T>> {
		try {
			const tuple = typeof src === "function" ? await src() : await src;
			return new Outcome<T>([tuple[0], tuple[1]] as ResultTuple<T>);
		} catch (e) {
			return new Outcome<T>([null, Err.from(e)]);
		}
	}

	/**
	 * Create an Outcome from a JSON tuple produced by `toJSON()`.
	 *
	 * Invalid payloads return an error Outcome rather than throwing.
	 *
	 * @param payload - JSON tuple from `Outcome.toJSON()`
	 * @returns Outcome<T>
	 * @see {@link toJSON} for serializing an Outcome to JSON
	 */
	static fromJSON<T>(
		payload: [T, null] | [null, ReturnType<Err["toJSON"]>],
	): Outcome<T>;

	static fromJSON<T>(payload: unknown): Outcome<T> {
		return Outcome.fromTuple<T>(() => {
			if (!Array.isArray(payload) || payload.length !== 2) {
				return [null, Err.from("Invalid Outcome JSON")];
			}

			const [value, error] = payload as [T, unknown];
			if (error === null) {
				return [value, null];
			}

			return [null, Err.fromJSON(error)];
		});
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Combinators
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Combines multiple Outcomes, succeeding if all succeed with an array of values.
	 *
	 * Non-short-circuiting: collects all errors via `addAll()`.
	 * For empty arrays, returns `Outcome.ok([])`.
	 *
	 * @param outcomes - Array of Outcomes to combine
	 * @returns Outcome containing array of all success values, or aggregate error
	 */
	static all<T>(outcomes: Outcome<T>[]): Outcome<T[]> {
		const values: T[] = [];
		const errors: Err[] = [];

		for (const outcome of outcomes) {
			if (!outcome._ok) {
				//
				errors.push(outcome._tuple[1] as Err);
				continue;
			}

			values.push(outcome._tuple[0] as T);
		}

		if (errors.length > 0) {
			return Outcome.err(Err.from("Multiple failed").addAll(errors));
		}

		return new Outcome<T[]>([values, null]);
	}

	/**
	 * Return the first successful Outcome from an array.
	 *
	 * Short-circuits on first success. Returns an aggregate error if all fail.
	 * For empty arrays, returns an error with code `EMPTY_INPUT`.
	 *
	 * @param outcomes - Array of Outcomes to check
	 * @returns First successful Outcome, or aggregate of all errors
	 */
	static any<T>(outcomes: Outcome<T>[]): Outcome<T> {
		if (outcomes.length === 0) {
			return Outcome.err("No outcomes provided", "EMPTY_INPUT");
		}

		const errors: Err[] = [];

		for (const outcome of outcomes) {
			if (outcome._ok) {
				return outcome;
			}
			errors.push(outcome._tuple[1] as Err);
		}
		const aggregate = Err.from("All failed").addAll(errors);
		return new Outcome<T>([null, aggregate]);
	}

	// Resolve a value-protocol callback return. Discriminates on two nominal types
	// only — `Err` is the failure, `Outcome` passes through by reference (safe:
	// instances are immutable), and every other value, tuples included, is carried
	// as the success value.
	private static _processCallbackReturn<R>(result: R): Outcome<ValueOf<R>> {
		if (Err.isErr(result)) {
			return new Outcome<ValueOf<R>>([null, result]);
		}
		if (result instanceof Outcome) {
			return result as Outcome<ValueOf<R>>;
		}
		Outcome._warnLegacyTuple(result);
		return new Outcome<ValueOf<R>>([result as ValueOf<R>, null]);
	}

	// Close the one silent window in the v0.7.0 protocol split: `[value, null]` and
	// `[null, err]` used to be unwrapped and are now ordinary array values. Fires at
	// most once per process, on exactly that shape.
	private static _warnLegacyTuple(result: unknown): void {
		if (Outcome._legacyTupleWarned) return;
		if (!Array.isArray(result) || result.length !== 2) return;
		const second = result[1];
		if (second !== null && !Err.isErr(second)) return;

		Outcome._legacyTupleWarned = true;
		console.warn(
			"[kore] Outcome: a callback returned a `[value, error]` tuple. Tuples used " +
				"to be unwrapped here; since v0.7.0 they are carried as the success value. " +
				"Use Outcome.fromTuple() / fromTupleAsync() if you meant the tuple protocol.",
		);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Transformation
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Transform the success value with a plain function.
	 *
	 * The return value is carried as-is — a tuple, an `Err`, or `null` stays the
	 * success value. Use {@link flatMap} to return an `Outcome` that can fail.
	 *
	 * Only called if successful. Errors pass through unchanged.
	 * If the callback throws, the exception is caught and wrapped.
	 *
	 * @param fn - Transformation function receiving the success value
	 * @returns New Outcome with the transformed value, or the original error
	 * @see {@link mapAsync} for the async version
	 * @see {@link flatMap} for callbacks that return an Outcome
	 * @see {@link mapErr} for transforming or recovering from errors
	 */
	map<U>(fn: (value: T) => U): Outcome<U> {
		if (!this._ok) {
			return new Outcome<U>([null, this._tuple[1] as Err]);
		}
		try {
			return new Outcome<U>([fn(this._tuple[0] as T), null]);
		} catch (e) {
			return new Outcome<U>([null, Err.from(e)]);
		}
	}

	/**
	 * Async version of `map()`.
	 *
	 * @param fn - Async transformation function
	 * @returns Promise of new Outcome
	 * @see {@link map} for the synchronous version
	 */
	async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<Outcome<U>> {
		if (!this._ok) {
			return new Outcome<U>([null, this._tuple[1] as Err]);
		}
		try {
			return new Outcome<U>([await fn(this._tuple[0] as T), null]);
		} catch (e) {
			return new Outcome<U>([null, Err.from(e)]);
		}
	}

	/**
	 * Chain a callback that can fail, flattening the result.
	 *
	 * Follows the value protocol: a returned `Outcome` is flattened, a returned
	 * `Err` becomes the failure, anything else is the success value. Only called if
	 * successful; errors pass through unchanged and a throw is caught and wrapped.
	 *
	 * @param fn - Function receiving the success value, returning an Outcome
	 * @returns The Outcome returned by the callback, or the original error
	 * @see {@link flatMapAsync} for the async version
	 * @see {@link map} for a total callback whose return is never inspected
	 */
	flatMap<R>(fn: (value: T) => R): Outcome<ValueOf<R>> {
		if (!this._ok) {
			return new Outcome<ValueOf<R>>([null, this._tuple[1] as Err]);
		}
		try {
			return Outcome._processCallbackReturn(fn(this._tuple[0] as T));
		} catch (e) {
			return new Outcome<ValueOf<R>>([null, Err.from(e)]);
		}
	}

	/**
	 * Async version of `flatMap()`.
	 *
	 * @param fn - Async function returning a Promise of an Outcome
	 * @returns Promise of the flattened Outcome
	 * @see {@link flatMap} for the synchronous version
	 */
	async flatMapAsync<R>(
		fn: (value: T) => Promise<R>,
	): Promise<Outcome<ValueOf<R>>> {
		if (!this._ok) {
			return new Outcome<ValueOf<R>>([null, this._tuple[1] as Err]);
		}
		try {
			return Outcome._processCallbackReturn(await fn(this._tuple[0] as T));
		} catch (e) {
			return new Outcome<ValueOf<R>>([null, Err.from(e)]);
		}
	}

	/**
	 * Transform or recover from an error using a callback.
	 *
	 * Follows the value protocol, so returning an `Err` re-fails and returning
	 * anything else recovers. Only called if in error state; success passes through
	 * unchanged.
	 *
	 * @param fn - Function receiving the error
	 * @returns New Outcome with transformed error or recovered value
	 * @see {@link mapErrAsync} for the async version
	 * @see {@link map} for transforming success values
	 */
	mapErr<R>(fn: (error: Err) => R): Outcome<T | ValueOf<R>> {
		if (this._ok) {
			return this as Outcome<T | ValueOf<R>>;
		}

		try {
			return Outcome._processCallbackReturn(fn(this._tuple[1] as Err));
		} catch (e) {
			return new Outcome<T | ValueOf<R>>([null, Err.from(e)]);
		}
	}

	/**
	 * Async version of `mapErr()`.
	 *
	 * @param fn - Async function receiving the error
	 * @returns Promise of new Outcome
	 * @see {@link mapErr} for the synchronous version
	 */
	async mapErrAsync<R>(
		fn: (error: Err) => Promise<R>,
	): Promise<Outcome<T | ValueOf<R>>> {
		if (this._ok) {
			return this as Outcome<T | ValueOf<R>>;
		}

		try {
			return Outcome._processCallbackReturn(await fn(this._tuple[1] as Err));
		} catch (e) {
			return new Outcome<T | ValueOf<R>>([null, Err.from(e)]);
		}
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Side Effects
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Execute a side effect with access to the full tuple.
	 *
	 * Returns `this` unchanged for chaining.
	 * If the callback throws, the exception is caught and the Outcome becomes an error.
	 *
	 * @param fn - Side effect function receiving the tuple
	 * @returns This Outcome (for chaining), or error Outcome if callback throws
	 * @see {@link effectAsync} for the async version
	 */
	effect(fn: (tuple: ResultTuple<T>) => void): Outcome<T> {
		try {
			const t = this.toTuple();
			fn(t);
			return this;
		} catch (e) {
			return new Outcome<T>([null, Err.from(e)]);
		}
	}

	/**
	 * Async version of `effect()`.
	 *
	 * @param fn - Async side effect function
	 * @returns Promise of this Outcome
	 * @see {@link effect} for the synchronous version
	 */
	async effectAsync(
		fn: (tuple: ResultTuple<T>) => Promise<void>,
	): Promise<Outcome<T>> {
		try {
			const t = this.toTuple();
			await fn(t);
			return this;
		} catch (e) {
			return new Outcome<T>([null, Err.from(e)]);
		}
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Terminal Operations
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Extract the success value, or use a fallback value on error.
	 *
	 * @param fallback - The fallback value to use if in error state
	 * @returns The success value or the fallback
	 * @throws If the outcome is an error and computing fallback throws
	 */
	defaultTo(fallback: T): T;

	/**
	 * Extract the success value, or compute a fallback from the error.
	 *
	 * @param handler - Function to compute fallback from error
	 * @returns The success value or computed fallback
	 * @throws If the handler throws, the exception propagates to the caller
	 */
	defaultTo(handler: (error: Err) => T): T;

	/**
	 * Extract the success value, or use the provided fallback value.
	 *
	 * Use `asValue: true` when T is a function type to avoid treating it as a handler.
	 *
	 * @param fallback - The fallback value to use when error
	 * @param asValue - Must be `true` to use this overload
	 * @returns The success value or the fallback
	 */
	defaultTo(fallback: T, asValue: true): T;

	/* Implementation for defaultTo overloads. */
	defaultTo(fallbackOrHandler: T | ((error: Err) => T), asValue?: boolean): T {
		if (this._ok) {
			return this._tuple[0] as T;
		}
		if (asValue === true) {
			return fallbackOrHandler as T;
		}
		if (typeof fallbackOrHandler === "function") {
			return (fallbackOrHandler as (error: Err) => T)(this._tuple[1] as Err);
		}
		return fallbackOrHandler as T;
	}

	/**
	 * Transform the Outcome into a final value by handling both cases.
	 *
	 * @param onOk - Function to transform success value into final result
	 * @param onErr - Function to transform error into final result
	 * @returns The transformed value (not wrapped in Outcome)
	 * @throws If either callback throws, the exception propagates to the caller
	 */
	either<U>(onOk: (value: T) => U, onErr: (error: Err) => U): U {
		if (this._ok) {
			return onOk(this._tuple[0] as T);
		}
		return onErr(this._tuple[1] as Err);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Transformation Pipeline
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Chain synchronous transformations using tuple-based predicates.
	 *
	 * Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
	 * enabling mid-chain recovery or conditional transformations.
	 * @see {@link pipeAsync} for async transformations
	 * @see {@link map} for simple success-only transformation
	 * @see {@link mapErr} for error-only transformation
	 */
	pipe<A>(f1: PipeFn<T, A>): Outcome<A>;
	pipe<A, B>(f1: PipeFn<T, A>, f2: PipeFn<A, B>): Outcome<B>;
	pipe<A, B, C>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
	): Outcome<C>;
	pipe<A, B, C, D>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
		f4: PipeFn<C, D>,
	): Outcome<D>;
	pipe<A, B, C, D, E>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
		f4: PipeFn<C, D>,
		f5: PipeFn<D, E>,
	): Outcome<E>;
	pipe<A, B, C, D, E, F>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
		f4: PipeFn<C, D>,
		f5: PipeFn<D, E>,
		f6: PipeFn<E, F>,
	): Outcome<F>;
	pipe<A, B, C, D, E, F, G>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
		f4: PipeFn<C, D>,
		f5: PipeFn<D, E>,
		f6: PipeFn<E, F>,
		f7: PipeFn<F, G>,
	): Outcome<G>;
	pipe<A, B, C, D, E, F, G, H>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
		f4: PipeFn<C, D>,
		f5: PipeFn<D, E>,
		f6: PipeFn<E, F>,
		f7: PipeFn<F, G>,
		f8: PipeFn<G, H>,
	): Outcome<H>;
	pipe<A, B, C, D, E, F, G, H, I>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
		f4: PipeFn<C, D>,
		f5: PipeFn<D, E>,
		f6: PipeFn<E, F>,
		f7: PipeFn<F, G>,
		f8: PipeFn<G, H>,
		f9: PipeFn<H, I>,
	): Outcome<I>;
	pipe<A, B, C, D, E, F, G, H, I, J>(
		f1: PipeFn<T, A>,
		f2: PipeFn<A, B>,
		f3: PipeFn<B, C>,
		f4: PipeFn<C, D>,
		f5: PipeFn<D, E>,
		f6: PipeFn<E, F>,
		f7: PipeFn<F, G>,
		f8: PipeFn<G, H>,
		f9: PipeFn<H, I>,
		f10: PipeFn<I, J>,
	): Outcome<J>;

	/* Implementation for pipe overloads. */

	// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
	pipe(...fns: PipeFn<any, any>[]): Outcome<any> {
		// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
		let current: Outcome<any> = this;

		for (const fn of fns) {
			try {
				const result = fn(current.toTuple());
				current = Outcome._processCallbackReturn(result);
			} catch (e) {
				// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
				current = new Outcome<any>([null, Err.from(e)]);
			}
		}

		return current;
	}

	/**
	 * Chain asynchronous transformations using tuple-based predicates.
	 *
	 * Predicates are executed sequentially, each awaiting the previous result.
	 * @see {@link pipe} for synchronous transformations
	 * @see {@link mapAsync} for simple async success-only transformation
	 * @see {@link mapErrAsync} for async error-only transformation
	 */
	pipeAsync<A>(f1: PipeFnAsync<T, A>): Promise<Outcome<A>>;
	pipeAsync<A, B>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
	): Promise<Outcome<B>>;
	pipeAsync<A, B, C>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
	): Promise<Outcome<C>>;
	pipeAsync<A, B, C, D>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
		f4: PipeFnAsync<C, D>,
	): Promise<Outcome<D>>;
	pipeAsync<A, B, C, D, E>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
		f4: PipeFnAsync<C, D>,
		f5: PipeFnAsync<D, E>,
	): Promise<Outcome<E>>;
	pipeAsync<A, B, C, D, E, F>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
		f4: PipeFnAsync<C, D>,
		f5: PipeFnAsync<D, E>,
		f6: PipeFnAsync<E, F>,
	): Promise<Outcome<F>>;
	pipeAsync<A, B, C, D, E, F, G>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
		f4: PipeFnAsync<C, D>,
		f5: PipeFnAsync<D, E>,
		f6: PipeFnAsync<E, F>,
		f7: PipeFnAsync<F, G>,
	): Promise<Outcome<G>>;
	pipeAsync<A, B, C, D, E, F, G, H>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
		f4: PipeFnAsync<C, D>,
		f5: PipeFnAsync<D, E>,
		f6: PipeFnAsync<E, F>,
		f7: PipeFnAsync<F, G>,
		f8: PipeFnAsync<G, H>,
	): Promise<Outcome<H>>;
	pipeAsync<A, B, C, D, E, F, G, H, I>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
		f4: PipeFnAsync<C, D>,
		f5: PipeFnAsync<D, E>,
		f6: PipeFnAsync<E, F>,
		f7: PipeFnAsync<F, G>,
		f8: PipeFnAsync<G, H>,
		f9: PipeFnAsync<H, I>,
	): Promise<Outcome<I>>;
	pipeAsync<A, B, C, D, E, F, G, H, I, J>(
		f1: PipeFnAsync<T, A>,
		f2: PipeFnAsync<A, B>,
		f3: PipeFnAsync<B, C>,
		f4: PipeFnAsync<C, D>,
		f5: PipeFnAsync<D, E>,
		f6: PipeFnAsync<E, F>,
		f7: PipeFnAsync<F, G>,
		f8: PipeFnAsync<G, H>,
		f9: PipeFnAsync<H, I>,
		f10: PipeFnAsync<I, J>,
	): Promise<Outcome<J>>;

	/* Implementation for pipeAsync overloads. */

	// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
	async pipeAsync(...fns: PipeFnAsync<any, any>[]): Promise<Outcome<any>> {
		// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
		let current: Outcome<any> = this;

		for (const fn of fns) {
			try {
				const result = await fn(current.toTuple());
				current = Outcome._processCallbackReturn(result);
			} catch (e) {
				// biome-ignore lint/suspicious/noExplicitAny: implementation signature needs any
				current = new Outcome<any>([null, Err.from(e)]);
			}
		}

		return current;
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Conversion
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Extract the internal tuple.
	 *
	 * @returns The internal ResultTuple<T>
	 * @see {@link fromTuple} for creating an Outcome from a tuple
	 */
	toTuple(): ResultTuple<T> {
		const [v, e] = this._tuple;
		return [v, e] as ResultTuple<T>;
	}

	/**
	 * Convert to JSON-serializable tuple.
	 *
	 * @returns JSON-serializable representation
	 * @see {@link fromJSON} for deserializing an Outcome from JSON
	 */
	toJSON(): [T, null] | [null, ReturnType<Err["toJSON"]>] {
		if (this._ok) {
			return [this._tuple[0] as T, null];
		}
		return [null, (this._tuple[1] as Err).toJSON()];
	}

	/**
	 * Convert to a human-readable string.
	 *
	 * @returns String representation
	 */
	toString(): string {
		if (this._ok) {
			return `Outcome.ok(${fmt(this._tuple[0])})`;
		}
		return `Outcome.err(${(this._tuple[1] as Err).toString()})`;
	}
}

/**
 * Format a value for display in `Outcome.toString()` output.
 *
 * @param v - Value to format
 * @returns JSON string representation, or `String(v)` if serialization fails
 * @internal
 */
function fmt(v: unknown) {
	if (v === null) return "null";
	if (v === undefined) return "undefined";
	if (typeof v === "string") return JSON.stringify(v);
	try {
		return JSON.stringify(v);
	} catch {
		return String(v);
	}
}
