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
 * - **CallbackReturn** — tuple, `null` (void success) or bare `Err` shorthand; accepted
 *   by `from`/`fromAsync`, `mapErr` and `pipe`, where wrapping Go-style functions is the job.
 * - **Auto-catch** — `from`, `map`, `flatMap` and `pipe` catch thrown exceptions and wrap them as `Err`.
 * - **Combinators** — `all` collects every error (non-short-circuit), `any` short-circuits on first success.
 *
 * @see [outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) for usage patterns
 * @module outcome
 */

import { Err, type ErrCode, type ErrOptions } from "./err";
import type {
	CallbackReturn,
	NullErr,
	PipeFn,
	PipeFnAsync,
	ResultTuple,
} from "./outcome.types";

export type { CallbackReturn, NullErr, PipeFn, PipeFnAsync, ResultTuple };

/**
 * A monadic container for handling success and error states.
 * Uses tuples as the primary interface. All instances are immutable.
 *
 * @typeParam T - The type of the success value
 */
export class Outcome<T> {
	/**
	 * Whether this Outcome is in success state.
	 *
	 * @deprecated Since v0.6.0 — becomes the type-guard method `isOk()` in v0.7.0;
	 * a property cannot narrow. Narrow via `toTuple()`; codemod `.isOk` → `.isOk()`.
	 */
	readonly isOk: boolean;

	/** Internal tuple storage */
	private readonly _tuple: ResultTuple<T>;

	/**
	 * Private constructor - use static factory methods.
	 * @internal
	 */
	private constructor(tuple: ResultTuple<T>) {
		this._tuple = tuple;
		this.isOk = tuple[1] === null;
	}

	// Internal success check. Mirrors `isOk` without touching the deprecated
	// accessor, so library internals stay clean through the deprecation cycle.
	private get _ok(): boolean {
		return this._tuple[1] === null;
	}

	/**
	 * Whether this Outcome is in error state.
	 *
	 * @deprecated Since v0.6.0 — becomes the type-guard method `isErr()` in v0.7.0;
	 * a getter cannot narrow. Narrow via `toTuple()`; codemod `.isErr` → `.isErr()`.
	 */
	get isErr(): boolean {
		return !this._ok;
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Static Constructors
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * The success value, or null if in error state.
	 */
	get value(): T | null {
		return this._tuple[0];
	}

	/**
	 * The error, or null if in success state.
	 */
	get error(): Err | null {
		return this._tuple[1];
	}

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
	 * @param error - The Err instance
	 * @returns Outcome in error state
	 */
	static err(error: Err): Outcome<never>;

	/**
	 * Create an error Outcome from a message with optional code.
	 *
	 * @param message - Error message
	 * @param code - Optional error code
	 * @returns Outcome in error state
	 */
	static err(message: string, code?: ErrCode): Outcome<never>;

	/**
	 * Create an error Outcome from a message with options.
	 *
	 * @param message - Error message
	 * @param options - Error options (code, metadata)
	 * @returns Outcome in error state
	 */
	static err(message: string, options: ErrOptions): Outcome<never>;

	/**
	 * Create an error Outcome by wrapping another error.
	 *
	 * @param message - Context message
	 * @param error - Original error to wrap
	 * @param options - Optional additional options
	 * @returns Outcome in error state with wrapped cause
	 */
	static err(
		message: string,
		error: Err | Error,
		options?: ErrOptions,
	): Outcome<never>;

	/* Implementation signature for err(). */
	static err(
		messageOrErr: string | Err,
		codeOrOptionsOrErr?: ErrCode | ErrOptions | Err | Error,
		options?: ErrOptions,
	): Outcome<never> {
		// If first arg is already an Err, use it directly
		if (Err.isErr(messageOrErr)) {
			return new Outcome<never>([null, messageOrErr]);
		}

		const message = messageOrErr;

		// If second arg is Err or Error, wrap it
		if (Err.isErr(codeOrOptionsOrErr) || codeOrOptionsOrErr instanceof Error) {
			const cause = Err.isErr(codeOrOptionsOrErr)
				? codeOrOptionsOrErr
				: Err.from(codeOrOptionsOrErr);
			const wrapped = cause.wrap(message, options);
			return new Outcome<never>([null, wrapped]);
		}

		// Otherwise, create new Err with message and options/code
		// biome-ignore lint/suspicious/noExplicitAny: overloaded argument handling
		const err = Err.from(message, codeOrOptionsOrErr as any);
		return new Outcome<never>([null, err]);
	}

	/**
	 * Create a success Outcome with null value (void success).
	 *
	 * @deprecated Since v0.6.0 — use `Outcome.ok(null)` instead (`Outcome.ok()`
	 * carries `undefined`, not `null`). Removed in v0.7.0.
	 * @returns Outcome<null> representing void success
	 */
	static unit(): Outcome<null> {
		return new Outcome<null>([null, null]);
	}

	/**
	 * Create an Outcome from a callback that returns `CallbackReturn<T>`.
	 *
	 * If the callback throws, the exception is caught and wrapped in an error Outcome.
	 *
	 * @param fn - Callback returning CallbackReturn<T>
	 * @returns Outcome<T>
	 *
	 * @see {@link fromAsync} for the async version
	 */
	static from<T>(fn: () => CallbackReturn<T>): Outcome<T> {
		try {
			const result = fn();
			return Outcome._processCallbackReturn(result);
		} catch (e) {
			return new Outcome<T>([null, Err.from(e)]);
		}
	}

	/**
	 * Create an Outcome from an async callback that returns `Promise<CallbackReturn<T>>`.
	 *
	 * @param fn - Async callback returning Promise<CallbackReturn<T>>
	 * @returns Promise<Outcome<T>>
	 *
	 * @see {@link from} for the synchronous version
	 */
	static async fromAsync<T>(
		fn: () => Promise<CallbackReturn<T>>,
	): Promise<Outcome<T>> {
		try {
			const result = await fn();
			return Outcome._processCallbackReturn(result);
		} catch (e) {
			return new Outcome<T>([null, Err.from(e)]);
		}
	}

	/**
	 * Create an Outcome from an existing ResultTuple.
	 *
	 * @param tuple - A ResultTuple<T>
	 * @returns Outcome<T>
	 *
	 * @see {@link toTuple} for extracting the tuple from an Outcome
	 */
	static fromTuple<T>(tuple: ResultTuple<T>): Outcome<T> {
		return new Outcome<T>([tuple[0], tuple[1]] as ResultTuple<T>);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Combinators
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Create an Outcome from a JSON tuple produced by `toJSON()`.
	 *
	 * Invalid payloads return an error Outcome rather than throwing.
	 *
	 * @param payload - JSON tuple from `Outcome.toJSON()`
	 * @returns Outcome<T>
	 *
	 * @see {@link toJSON} for serializing an Outcome to JSON
	 */
	static fromJSON<T>(
		payload: [T, null] | [null, ReturnType<Err["toJSON"]>],
	): Outcome<T>;

	static fromJSON<T>(payload: unknown): Outcome<T> {
		return Outcome.from(() => {
			if (!Array.isArray(payload) || payload.length !== 2) {
				return Err.from("Invalid Outcome JSON");
			}

			const [value, error] = payload as [T, unknown];
			if (error === null) {
				return [value as T, null];
			}

			return [null, Err.fromJSON(error)];
		});
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Instance Accessors
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

	/**
	 * Process a CallbackReturn value into an Outcome.
	 * Handles discrimination: Err → null (void) → validated 2-element tuple.
	 * Invalid shapes yield an `INVALID_CALLBACK_RETURN` error instead of
	 * destructuring arbitrary iterables (e.g. a bare string) or dropping data.
	 * @internal
	 */
	private static _processCallbackReturn<T>(
		result: CallbackReturn<T>,
	): Outcome<T> {
		// Case 1: Direct Err return (shorthand)
		if (Err.isErr(result)) {
			return new Outcome<T>([null, result]);
		}

		// Case 2: null = void success
		if (result === null) {
			return new Outcome<T>([null as T, null]);
		}

		// Case 3: Must be an array to be a ResultTuple. Strings and other
		// iterables would silently destructure into wrong values otherwise.
		if (!Array.isArray(result) || result.length !== 2) {
			return Outcome._invalidCallbackReturn(result);
		}

		// Case 4: Tuple [T, null] | [null, Err]
		const [value, error] = result;
		if (Err.isErr(error)) {
			return new Outcome<T>([null, error]);
		}

		// Case 5: Second slot must be null (success) or Err — anything else
		// would silently discard the error slot.
		if (error !== null) {
			return Outcome._invalidCallbackReturn(result);
		}

		return new Outcome<T>([value as T, null]);
	}

	// Guard flatMap callbacks: untyped callers can still return a non-Outcome.
	private static _requireOutcome<U>(result: Outcome<U>): Outcome<U> {
		if (result instanceof Outcome) {
			return result;
		}
		return new Outcome<never>([
			null,
			Err.from("Invalid flatMap return: expected an Outcome", {
				code: "INVALID_FLATMAP_RETURN",
				metadata: { received: typeof result },
			}),
		]);
	}

	// Build the error Outcome for callback returns violating the CallbackReturn contract.
	private static _invalidCallbackReturn(result: unknown): Outcome<never> {
		return new Outcome<never>([
			null,
			Err.from(
				"Invalid callback return: expected [value, null], [null, Err], Err, or null",
				{
					code: "INVALID_CALLBACK_RETURN",
					metadata: Array.isArray(result)
						? { received: "array", length: result.length }
						: { received: typeof result },
				},
			),
		]);
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
	 *
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
	 *
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
	 * Chain a callback that returns an `Outcome`, flattening the result.
	 *
	 * Only called if successful. Errors pass through unchanged.
	 * If the callback throws, the exception is caught and wrapped.
	 *
	 * @param fn - Function receiving the success value, returning an Outcome
	 * @returns The Outcome returned by the callback, or the original error
	 *
	 * @see {@link flatMapAsync} for the async version
	 * @see {@link map} for callbacks that return a plain value
	 */
	flatMap<U>(fn: (value: T) => Outcome<U>): Outcome<U> {
		if (!this._ok) {
			return new Outcome<U>([null, this._tuple[1] as Err]);
		}
		try {
			return Outcome._requireOutcome(fn(this._tuple[0] as T));
		} catch (e) {
			return new Outcome<U>([null, Err.from(e)]);
		}
	}

	/**
	 * Async version of `flatMap()`.
	 *
	 * @param fn - Async function returning a Promise of an Outcome
	 * @returns Promise of the flattened Outcome
	 *
	 * @see {@link flatMap} for the synchronous version
	 */
	async flatMapAsync<U>(
		fn: (value: T) => Promise<Outcome<U>>,
	): Promise<Outcome<U>> {
		if (!this._ok) {
			return new Outcome<U>([null, this._tuple[1] as Err]);
		}
		try {
			return Outcome._requireOutcome(await fn(this._tuple[0] as T));
		} catch (e) {
			return new Outcome<U>([null, Err.from(e)]);
		}
	}

	/**
	 * Transform or recover from an error using a callback.
	 *
	 * Only called if in error state. Success passes through unchanged.
	 *
	 * @param fn - Function receiving the error
	 * @returns New Outcome with transformed error or recovered value
	 *
	 * @see {@link mapErrAsync} for the async version
	 * @see {@link map} for transforming success values
	 */
	mapErr<U>(fn: (error: Err) => CallbackReturn<U>): Outcome<T | U> {
		if (this._ok) {
			return this as Outcome<T | U>;
		}

		try {
			const result = fn(this._tuple[1] as Err);
			return Outcome._processCallbackReturn(result);
		} catch (e) {
			return new Outcome<T | U>([null, Err.from(e)]);
		}
	}

	/**
	 * Async version of `mapErr()`.
	 *
	 * @param fn - Async function receiving the error
	 * @returns Promise of new Outcome
	 *
	 * @see {@link mapErr} for the synchronous version
	 */
	async mapErrAsync<U>(
		fn: (error: Err) => Promise<CallbackReturn<U>>,
	): Promise<Outcome<T | U>> {
		if (this._ok) {
			return this as Outcome<T | U>;
		}

		try {
			const result = await fn(this._tuple[1] as Err);
			return Outcome._processCallbackReturn(result);
		} catch (e) {
			return new Outcome<T | U>([null, Err.from(e)]);
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
	 *
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
	 *
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
	 *
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
	 *
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
	 *
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
	 *
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
