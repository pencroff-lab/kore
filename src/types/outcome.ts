/**
 * Monadic container for handling success and error states using tuple-first API design.
 *
 * This module provides the `Outcome<T>` class and related types for implementing
 * type-safe error handling without exceptions. All operations favor immutability.
 *
 * @example Basic usage
 * ```typescript
 * import { Outcome } from './outcome';
 *
 * const [val, err] = Outcome.from(() => [42, null]).toTuple();
 * ```
 *
 * @example Migration from throwing functions
 * ```typescript
 * // Before (throwing):
 * function getUser(id: string): User {
 *   const user = db.find(id);
 *   if (!user) throw new Error("Not found");
 *   return user;
 * }
 * try {
 *   const user = getUser("123");
 *   console.log(user.name);
 * } catch (e) {
 *   console.error(e.message);
 * }
 *
 * // After (Outcome):
 * function getUser(id: string): Outcome<User> {
 *   return Outcome.from(() => {
 *     const user = db.find(id);
 *     if (!user) return Err.from("Not found", "NOT_FOUND");
 *     return [user, null];
 *   });
 * }
 * const [user, err] = getUser("123").toTuple();
 * if (err) {
 *   console.error(err.message);
 *   return;
 * }
 * console.log(user.name);
 * ```
 *
 * @module outcome
 */

import { Err, type ErrCode, type ErrOptions } from './err';

/**
 * Direct return types for errors or void success.
 * - `null`: void success (function completed, no value to return)
 * - `Err`: error (shorthand for `[null, Err]`)
 *
 * @example
 * ```typescript
 * function saveConfig(config: Config): NullErr {
 *   if (!config.valid) return Err.from('Invalid config');
 *   fs.writeFileSync('config.json', JSON.stringify(config));
 *   return null; // void success
 * }
 * ```
 */
export type NullErr = null | Err;

/**
 * Tuple-based result with positional semantics.
 * - `[T, null]`: success with value
 * - `[null, Err]`: error
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): ResultTuple<number> {
 *   if (b === 0) return [null, Err.from('Division by zero')];
 *   return [a / b, null];
 * }
 *
 * const [result, err] = divide(10, 2);
 * if (err) console.error(err.message);
 * else console.log(result); // 5
 * ```
 */
export type ResultTuple<T> = [T, null] | [null, Err];

/**
 * Combined callback return type for `Outcome.from()` and `Outcome.fromAsync()`.
 * Supports all patterns:
 * - `[T, null]`: success with value (tuple)
 * - `[null, Err]`: error (tuple)
 * - `null`: void success
 * - `Err`: error (shorthand)
 *
 * Discrimination order: `Err.isErr()` → `=== null` → destructure tuple
 *
 * @example
 * ```typescript
 * Outcome.from(() => {
 *   if (badInput) return Err.from('Bad input');     // Err shorthand
 *   if (noResult) return null;                       // void success
 *   if (hasError) return [null, Err.from('Error')]; // tuple error
 *   return [value, null];                            // tuple success
 * });
 * ```
 */
export type CallbackReturn<T> = ResultTuple<T> | NullErr;

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

/**
 * A monadic container for handling success and error states.
 *
 * `Outcome<T>` provides a type-safe way to handle operations that can fail,
 * using tuples as the primary interface. All instances are immutable.
 *
 * ## Core Patterns
 *
 * - **Construction**: Use static methods `ok()`, `err()`, `from()`, `fromAsync()`
 * - **Inspection**: Use `isOk`, `isErr`, `value`, `error` properties
 * - **Transformation**: Use `map()`, `mapErr()` for chained operations
 * - **Extraction**: Use `toTuple()` for final value extraction
 *
 * @example Basic usage
 * ```typescript
 * const outcome = Outcome.from(() => {
 *   if (Math.random() > 0.5) return [42, null];
 *   return Err.from('Bad luck');
 * });
 *
 * const [value, err] = outcome.toTuple();
 * if (err) {
 *   console.error('Failed:', err.message);
 * } else {
 *   console.log('Success:', value);
 * }
 * ```
 *
 * @example Chaining transformations
 * ```typescript
 * const result = Outcome.ok(5)
 *   .map(n => [n * 2, null])
 *   .map(n => [n.toString(), null])
 *   .toTuple();
 * // result: ['10', null]
 * ```
 *
 * @typeParam T - The type of the success value
 */
export class Outcome<T> {
	/**
	 * Discriminator property for type narrowing.
	 * `true` for success outcomes, `false` for error outcomes.
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

	/**
	 * Whether this Outcome is in error state.
	 *
	 * @example
	 * ```typescript
	 * const success = Outcome.ok(42);
	 * const failure = Outcome.err('Failed');
	 *
	 * console.log(success.isErr); // false
	 * console.log(failure.isErr); // true
	 * ```
	 */
	get isErr(): boolean {
		return !this.isOk;
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Static Constructors
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * The success value, or null if in error state.
	 *
	 * @example
	 * ```typescript
	 * const success = Outcome.ok(42);
	 * const failure = Outcome.err('Failed');
	 *
	 * console.log(success.value); // 42
	 * console.log(failure.value); // null
	 * ```
	 */
	get value(): T | null {
		return this._tuple[0];
	}

	/**
	 * The error, or null if in success state.
	 *
	 * @example
	 * ```typescript
	 * const success = Outcome.ok(42);
	 * const failure = Outcome.err('Failed');
	 *
	 * console.log(success.error); // null
	 * console.log(failure.error?.message); // 'Failed'
	 * ```
	 */
	get error(): Err | null {
		return this._tuple[1];
	}

	/**
	 * Create a success Outcome with the given value.
	 *
	 * @param value - The success value
	 * @returns Outcome containing the success value
	 *
	 * @example
	 * ```typescript
	 * const outcome = Outcome.ok(42);
	 * console.log(outcome.isOk);  // true
	 * console.log(outcome.value); // 42
	 *
	 * const [val, err] = outcome.toTuple();
	 * // val: 42, err: null
	 * ```
	 */
	static ok<T>(value: T): Outcome<T> {
		return new Outcome<T>([value, null]);
	}

	/**
	 * Create an error Outcome from an existing Err.
	 *
	 * @param error - The Err instance
	 * @returns Outcome in error state
	 *
	 * @example
	 * ```typescript
	 * const err = Err.from('Something failed');
	 * const outcome = Outcome.err(err);
	 * ```
	 */
	static err(error: Err): Outcome<never>;

	/**
	 * Create an error Outcome from a message with optional code.
	 *
	 * @param message - Error message
	 * @param code - Optional error code
	 * @returns Outcome in error state
	 *
	 * @example
	 * ```typescript
	 * const outcome = Outcome.err('Not found', 'NOT_FOUND');
	 * const [, err] = outcome.toTuple();
	 * console.log(err?.code); // 'NOT_FOUND'
	 * ```
	 */
	static err(message: string, code?: ErrCode): Outcome<never>;

	/**
	 * Create an error Outcome from a message with options.
	 *
	 * @param message - Error message
	 * @param options - Error options (code, metadata)
	 * @returns Outcome in error state
	 *
	 * @example
	 * ```typescript
	 * const outcome = Outcome.err('Timeout', {
	 *   code: 'TIMEOUT',
	 *   metadata: { durationMs: 5000 }
	 * });
	 * ```
	 */
	static err(message: string, options: ErrOptions): Outcome<never>;

	/**
	 * Create an error Outcome by wrapping another error.
	 *
	 * @param message - Context message
	 * @param error - Original error to wrap
	 * @param options - Optional additional options
	 * @returns Outcome in error state with wrapped cause
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   JSON.parse(invalid);
	 * } catch (e) {
	 *   return Outcome.err('Parse failed', e as Error, { code: 'PARSE_ERROR' });
	 * }
	 * ```
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
			const wrapped = Err.wrap(message, codeOrOptionsOrErr, options);
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
	 * Use for operations that succeed but have no meaningful return value.
	 *
	 * @returns Outcome<null> representing void success
	 *
	 * @remarks
	 * Returns `Outcome<null>` (not `Outcome<undefined>` or `Outcome<void>`).
	 * This is intentional for consistency with the tuple pattern where `null`
	 * indicates absence of error in `[value, null]`.
	 *
	 * @example
	 * ```typescript
	 * function logMessage(msg: string): Outcome<null> {
	 *   console.log(msg);
	 *   return Outcome.unit();
	 * }
	 *
	 * const outcome = logMessage('Hello');
	 * console.log(outcome.isOk); // true
	 * console.log(outcome.value); // null
	 * ```
	 */
	static unit(): Outcome<null> {
		return new Outcome<null>([null, null]);
	}

	/**
	 * Create an Outcome from a callback that returns `CallbackReturn<T>`.
	 *
	 * The callback can return:
	 * - `[value, null]` - success with value
	 * - `[null, Err]` - error as tuple
	 * - `null` - void success
	 * - `Err` - error directly
	 *
	 * If the callback throws, the exception is caught and wrapped in an error Outcome.
	 *
	 * @param fn - Callback returning CallbackReturn<T>
	 * @returns Outcome<T>
	 *
	 * @see {@link fromAsync} for the async version
	 *
	 * @example Success with value
	 * ```typescript
	 * const outcome = Outcome.from(() => {
	 *   return [42, null];
	 * });
	 * console.log(outcome.value); // 42
	 * ```
	 *
	 * @example Error shorthand
	 * ```typescript
	 * const outcome = Outcome.from(() => {
	 *   if (invalid) return Err.from('Invalid input');
	 *   return [result, null];
	 * });
	 * ```
	 *
	 * @example Catching throws from external libraries
	 * ```typescript
	 * const outcome = Outcome.from(() => {
	 *   const data = JSON.parse(untrustedInput); // may throw
	 *   return [data, null];
	 * });
	 * // If JSON.parse throws, outcome.isErr === true
	 * ```
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
	 * Async version of `from()` with identical semantics.
	 *
	 * @param fn - Async callback returning Promise<CallbackReturn<T>>
	 * @returns Promise<Outcome<T>>
	 *
	 * @see {@link from} for the synchronous version
	 *
	 * @example Async operation
	 * ```typescript
	 * const outcome = await Outcome.fromAsync(async () => {
	 *   const response = await fetch('/api/data');
	 *   if (!response.ok) {
	 *     return Err.from('Request failed', { code: 'HTTP_ERROR' });
	 *   }
	 *   const data = await response.json();
	 *   return [data, null];
	 * });
	 * ```
	 *
	 * @example With error aggregation
	 * ```typescript
	 * const outcome = await Outcome.fromAsync(async () => {
	 *   let errors = Err.aggregate('Batch failed');
	 *
	 *   const [a, errA] = await taskA().toTuple();
	 *   if (errA) errors = errors.add(errA);
	 *
	 *   const [b, errB] = await taskB().toTuple();
	 *   if (errB) errors = errors.add(errB);
	 *
	 *   if (errors.count > 0) return errors;
	 *   return [{ a, b }, null];
	 * });
	 * ```
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
	 * Useful for deserializing Outcomes or converting from external tuple sources.
	 *
	 * @param tuple - A ResultTuple<T>
	 * @returns Outcome<T>
	 *
	 * @see {@link toTuple} for extracting the tuple from an Outcome
	 *
	 * @example Deserializing from JSON
	 * ```typescript
	 * const json = '["hello", null]';
	 * const tuple = JSON.parse(json) as ResultTuple<string>;
	 * const outcome = Outcome.fromTuple(tuple);
	 * console.log(outcome.value); // 'hello'
	 * ```
	 *
	 * @example Round-trip serialization
	 * ```typescript
	 * const original = Outcome.ok(42);
	 * const json = JSON.stringify(original.toJSON());
	 * const restored = Outcome.fromTuple(JSON.parse(json));
	 * console.log(restored.value); // 42
	 * ```
	 *
	 */
	static fromTuple<T>(tuple: ResultTuple<T>): Outcome<T> {
		return new Outcome<T>([tuple[0], tuple[1]]);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Combinators
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Create an Outcome from a JSON tuple produced by `toJSON()`.
	 *
	 * Accepts `[value, null]` for success or `[null, errJSON]` for errors.
	 * Errors are rehydrated with `Err.fromJSON()`.
	 *
	 * Invalid payloads (non-array or wrong length) return an error Outcome
	 * rather than throwing — validate the source when consuming untrusted JSON.
	 *
	 * @param payload - JSON tuple from `Outcome.toJSON()`
	 * @returns Outcome<T>
	 *
	 * @see {@link toJSON} for serializing an Outcome to JSON
	 *
	 * @example
	 * ```typescript
	 * const json = JSON.stringify(outcome.toJSON());
	 * const restored = Outcome.fromJSON(JSON.parse(json));
	 * ```
	 *
	 * @example Invalid payload
	 * ```typescript
	 * const result = Outcome.fromJSON({ not: 'a tuple' });
	 * console.log(result.isErr); // true
	 * console.log(result.error?.message); // 'Invalid Outcome JSON'
	 * ```
	 */
	static fromJSON<T>(
		payload: [T, null] | [null, ReturnType<Err['toJSON']>],
	): Outcome<T>;

	static fromJSON<T>(payload: unknown): Outcome<T> {
		return Outcome.from(() => {
			if (!Array.isArray(payload) || payload.length !== 2) {
				return Err.from('Invalid Outcome JSON');
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
	 * If any Outcome fails, returns all failures aggregated via `Err.aggregate()`.
	 *
	 * This is useful for validation scenarios where you need to collect all errors.
	 *
	 * For empty arrays, returns `Outcome.ok([])` (vacuous truth).
	 *
	 * @param outcomes - Array of Outcomes to combine
	 * @returns Outcome containing array of all success values, or aggregate error
	 *
	 * @remarks
	 * Time complexity: O(n) where n is the number of outcomes.
	 * All outcomes are evaluated (non-short-circuiting) to collect all errors.
	 *
	 * @example All succeed
	 * ```typescript
	 * const outcomes = [Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)];
	 * const combined = Outcome.all(outcomes);
	 * console.log(combined.value); // [1, 2, 3]
	 * ```
	 *
	 * @example One fails
	 * ```typescript
	 * const outcomes = [
	 *   Outcome.ok(1),
	 *   Outcome.err('Failed'),
	 *   Outcome.ok(3)
	 * ];
	 * const combined = Outcome.all(outcomes);
	 * console.log(combined.isErr); // true
	 * console.log(combined.error?.isAggregate); // true
	 * console.log(combined.error?.message); // 'Multiple failed'
	 * ```
	 *
	 * @example Many fails
	 * ```typescript
	 * const mixed = [
	 *   Outcome.ok(1),
	 *   Outcome.err("Error A"),
	 *   Outcome.err("Error B")
	 * ];
	 * const failed = Outcome.all(mixed);
	 * console.log(failed.isErr);  // true
	 * // Error contains both "Error A" and "Error B"
	 * ```
	 *
	 * @example Empty array
	 * ```typescript
	 * const combined = Outcome.all([]);
	 * console.log(combined.value); // []
	 * ```
	 */
	static all<T>(outcomes: Outcome<T>[]): Outcome<T[]> {
		const values: T[] = [];
		const errors: Err[] = [];

		for (const outcome of outcomes) {
			if (outcome.isErr) {
				//
				errors.push(outcome._tuple[1] as Err);
				continue;
			}

			values.push(outcome._tuple[0] as T);
		}

		if (errors.length > 0) {
			return Outcome.err(Err.aggregate('Multiple failed', errors));
		}

		return new Outcome<T[]>([values, null]);
	}

	/**
	 * Return the first successful Outcome from an array.
	 *
	 * Returns the first success encountered.
	 * Returns an aggregate error if ALL outcomes fail.
	 *
	 * For empty arrays, returns an error (no value to return).
	 *
	 * @param outcomes - Array of Outcomes to check
	 * @returns First successful Outcome, or aggregate of all errors
	 *
	 * @remarks
	 * Time complexity: O(n) worst case, but short-circuits on first success.
	 * Best case: O(1) if first outcome is successful.
	 *
	 * @example First success wins
	 * ```typescript
	 * const outcomes = [
	 *   Outcome.err('First failed'),
	 *   Outcome.ok(42),
	 *   Outcome.ok(100)
	 * ];
	 * const result = Outcome.any(outcomes);
	 * console.log(result.value); // 42
	 * ```
	 *
	 * @example All fail
	 * ```typescript
	 * const outcomes = [
	 *   Outcome.err('Error 1'),
	 *   Outcome.err('Error 2')
	 * ];
	 * const result = Outcome.any(outcomes);
	 * console.log(result.isErr); // true
	 * console.log(result.error?.isAggregate); // true
	 * ```
	 *
	 * @example Empty array
	 * ```typescript
	 * const result = Outcome.any([]);
	 * console.log(result.isErr); // true
	 * console.log(result.error?.message); // 'No outcomes provided'
	 * console.log(result.error?.code); // 'EMPTY_INPUT'
	 * ```
	 */
	static any<T>(outcomes: Outcome<T>[]): Outcome<T> {
		if (outcomes.length === 0) {
			return Outcome.err('No outcomes provided', 'EMPTY_INPUT');
		}

		const errors: Err[] = [];

		for (const outcome of outcomes) {
			if (outcome.isOk) {
				return outcome;
			}
			errors.push(outcome._tuple[1] as Err);
		}
		const aggregate = Err.aggregate('All failed', errors);
		return new Outcome<T>([null, aggregate]);
	}

	/**
	 * Process a CallbackReturn value into an Outcome.
	 * Handles discrimination: Err → null (void) → tuple destructure.
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

		// Case 3: Tuple [T, null] | [null, Err]
		const [value, error] = result;
		if (Err.isErr(error)) {
			return new Outcome<T>([null, error]);
		}

		return new Outcome<T>([value as T, null]);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Transformation
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Transform the success value using a callback.
	 *
	 * Only called if this Outcome is successful. Errors pass through unchanged.
	 * The callback can return any `CallbackReturn<U>` pattern.
	 * If the callback throws, the exception is caught and wrapped.
	 *
	 * @param fn - Transformation function receiving the success value
	 * @returns New Outcome with transformed value or original/new error
	 *
	 * @see {@link mapAsync} for the async version
	 * @see {@link mapErr} for transforming or recovering from errors
	 *
	 * @example Simple transformation
	 * ```typescript
	 * const outcome = Outcome.ok(5)
	 *   .map(n => [n * 2, null])
	 *   .map(n => [n.toString(), null]);
	 *
	 * console.log(outcome.value); // '10'
	 * ```
	 *
	 * @example Transformation that can fail
	 * ```typescript
	 * const outcome = Outcome.ok('{"name":"John"}')
	 *   .map(json => {
	 *     try {
	 *       return [JSON.parse(json), null];
	 *     } catch {
	 *       return Err.from('Invalid JSON');
	 *     }
	 *   });
	 * ```
	 *
	 * @example Error passes through
	 * ```typescript
	 * const outcome = Outcome.err('Original error')
	 *   .map(v => [v * 2, null]); // Never called
	 *
	 * console.log(outcome.error?.message); // 'Original error'
	 * ```
	 */
	map<U>(fn: (value: T) => CallbackReturn<U>): Outcome<U> {
		if (this.isErr) {
			return new Outcome<U>([null, this._tuple[1] as Err]);
		}
		try {
			const result = fn(this._tuple[0] as T);
			return Outcome._processCallbackReturn(result);
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
	 *
	 * @example
	 * ```typescript
	 * const outcome = await Outcome.ok(userId)
	 *   .mapAsync(async id => {
	 *     const user = await fetchUser(id);
	 *     return [user, null];
	 *   });
	 * ```
	 */
	async mapAsync<U>(
		fn: (value: T) => Promise<CallbackReturn<U>>,
	): Promise<Outcome<U>> {
		if (this.isErr) {
			return new Outcome<U>([null, this._tuple[1] as Err]);
		}
		try {
			const result = await fn(this._tuple[0] as T);
			return Outcome._processCallbackReturn(result);
		} catch (e) {
			return new Outcome<U>([null, Err.from(e)]);
		}
	}

	/**
	 * Transform or recover from an error using a callback.
	 *
	 * Only called if this Outcome is in error state. Success passes through unchanged.
	 * The callback can return any `CallbackReturn<U>` pattern, allowing:
	 * - Recovery: return `[value, null]` to convert error to success
	 * - Transform: return `Err` or `[null, Err]` to change the error
	 *
	 * @param fn - Function receiving the error
	 * @returns New Outcome with transformed error or recovered value
	 *
	 * @see {@link mapErrAsync} for the async version
	 * @see {@link map} for transforming success values
	 *
	 * @example Recovery
	 * ```typescript
	 * const outcome = Outcome.err('Not found')
	 *   .mapErr(err => {
	 *     if (err.hasCode('NOT_FOUND')) {
	 *       return [defaultValue, null]; // recover with default
	 *     }
	 *     return err; // pass through other errors
	 *   });
	 * ```
	 *
	 * @example Error transformation
	 * ```typescript
	 * const outcome = Outcome.err('Low-level error')
	 *   .mapErr(err => err.wrap('High-level context'));
	 * ```
	 *
	 * @example Logging and pass-through
	 * ```typescript
	 * const outcome = Outcome.err('Something failed')
	 *   .mapErr(err => {
	 *     console.error('Error occurred:', err.message);
	 *     return err; // pass through unchanged
	 *   });
	 * ```
	 */
	mapErr<U>(fn: (error: Err) => CallbackReturn<U>): Outcome<T | U> {
		if (this.isOk) {
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
	 *
	 * @example Async recovery with fallback fetch
	 * ```typescript
	 * const outcome = await Outcome.err('Primary failed')
	 *   .mapErrAsync(async err => {
	 *     const fallback = await fetchFromBackup();
	 *     if (fallback) return [fallback, null];
	 *     return err.wrap('Backup also failed');
	 *   });
	 * ```
	 */
	async mapErrAsync<U>(
		fn: (error: Err) => Promise<CallbackReturn<U>>,
	): Promise<Outcome<T | U>> {
		if (this.isOk) {
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
	 * The callback receives the tuple `[value, error]` regardless of state.
	 * Returns `this` unchanged for chaining.
	 * If the callback throws, the exception is caught and the Outcome becomes an error.
	 *
	 * @param fn - Side effect function receiving the tuple
	 * @returns This Outcome (for chaining), or error Outcome if callback throws
	 *
	 * @see {@link effectAsync} for the async version
	 *
	 * @example Logging
	 * ```typescript
	 * const outcome = Outcome.ok(42)
	 *   .effect(([val, err]) => {
	 *     if (err) console.error('Failed:', err.message);
	 *     else console.log('Success:', val);
	 *   })
	 *   .map(v => [v * 2, null]);
	 * ```
	 *
	 * @example Metrics
	 * ```typescript
	 * outcome.effect(([val, err]) => {
	 *   metrics.record({
	 *     success: !err,
	 *     value: val,
	 *     errorCode: err?.code
	 *   });
	 * });
	 * ```
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
	 *
	 * @example Async logging
	 * ```typescript
	 * const outcome = await Outcome.ok(data)
	 *   .effectAsync(async ([val, err]) => {
	 *     await logger.log({ value: val, error: err?.toJSON() });
	 *   });
	 * ```
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
	 * This is a terminal operation that exits the Outcome chain.
	 * Returns `T` directly, not wrapped in Outcome.
	 *
	 * @param fallback - The fallback value to use if in error state
	 * @returns The success value or the fallback
	 * @throws If the outcome is an error and computing fallback throws
	 *
	 * @see {@link either} for transforming both cases with custom logic
	 * @see {@link toTuple} for raw tuple extraction
	 *
	 * @example Static fallback
	 * ```typescript
	 * const count = parseNumber(input).defaultTo(0);
	 * // Returns parsed number or 0 on error
	 * ```
	 *
	 * @example With objects
	 * ```typescript
	 * const config = loadConfig().defaultTo({ port: 3000, host: 'localhost' });
	 * ```
	 */
	defaultTo(fallback: T): T;

	/**
	 * Extract the success value, or compute a fallback from the error.
	 *
	 * This is a terminal operation that exits the Outcome chain.
	 * The handler receives the `Err` and can use it to compute the fallback.
	 *
	 * @param handler - Function to compute fallback from error
	 * @returns The success value or computed fallback
	 * @throws If the handler throws, the exception propagates to the caller
	 *
	 * @example Computed fallback
	 * ```typescript
	 * const name = fetchUser(id).defaultTo(err =>
	 *   err.hasCode('NOT_FOUND') ? 'Guest' : 'Unknown'
	 * );
	 * ```
	 *
	 * @example Logging and fallback
	 * ```typescript
	 * const data = loadData().defaultTo(err => {
	 *   console.error('Load failed:', err.message);
	 *   return cachedData;
	 * });
	 * ```
	 */
	defaultTo(handler: (error: Err) => T): T;

	/**
	 * Extract the success value, or use the provided fallback value.
	 *
	 * When T is a function type, use this overload with `asValue: true`
	 * to force treating the fallback as a static value rather than an error handler.
	 *
	 * @param fallback - The fallback value to use when error
	 * @param asValue - Must be `true` to use this overload
	 * @returns The success value or the fallback
	 *
	 * @example Function as a fallback value
	 * ```typescript
	 * const defaultHandler = () => console.log('default');
	 * const handler = getHandler().defaultTo(defaultHandler, true);
	 * ```
	 */
	defaultTo(fallback: T, asValue: true): T;

	/* Implementation for defaultTo overloads. */
	defaultTo(fallbackOrHandler: T | ((error: Err) => T), asValue?: boolean): T {
		if (this.isOk) {
			return this._tuple[0] as T;
		}
		if (asValue === true) {
			return fallbackOrHandler as T;
		}
		if (typeof fallbackOrHandler === 'function') {
			return (fallbackOrHandler as (error: Err) => T)(this._tuple[1] as Err);
		}
		return fallbackOrHandler as T;
	}

	/**
	 * Transform the Outcome into a final value by handling both cases.
	 *
	 * This is a terminal operation that exits the Outcome chain, similar to
	 * `toTuple()` but with transformation logic applied.
	 *
	 * Each handler receives only its relevant type with full type safety:
	 * - `onOk` receives `T` (guaranteed non-null value)
	 * - `onErr` receives `Err` (guaranteed error)
	 *
	 * @param onOk - Function to transform success value into final result
	 * @param onErr - Function to transform error into final result
	 * @returns The transformed value (not wrapped in Outcome)
	 * @throws If either callback throws, the exception propagates to the caller
	 *
	 * @see {@link defaultTo} for simple value extraction with fallback
	 * @see {@link toTuple} for raw tuple extraction
	 * @see {@link toJSON} for JSON serialization
	 *
	 * @example Basic transformation
	 * ```typescript
	 * const message = fetchUser(id).either(
	 *   user => `Welcome, ${user.name}!`,
	 *   err => `Error: ${err.message}`
	 * );
	 * // message is string, not Outcome<string>
	 * ```
	 *
	 * @example HTTP response building
	 * ```typescript
	 * const response = processOrder(orderId).either(
	 *   order => ({ status: 200, body: { id: order.id, total: order.total } }),
	 *   err => ({
	 *     status: err.hasCode('NOT_FOUND') ? 404 : 500,
	 *     body: { error: err.message }
	 *   })
	 * );
	 * ```
	 *
	 * @example Default value on error
	 * ```typescript
	 * const count = parseNumber(input).either(n => n, () => 0);
	 * ```
	 *
	 * @example Type transformation
	 * ```typescript
	 * const status: 'success' | 'error' = outcomeEntity.either(
	 *   () => 'success',
	 *   () => 'error'
	 * );
	 * ```
	 */
	either<U>(onOk: (value: T) => U, onErr: (error: Err) => U): U {
		if (this.isOk) {
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
	 * Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
	 * This allows handling both success and error cases at each step,
	 * enabling mid-chain recovery or conditional transformations.
	 *
	 * @see {@link pipeAsync} for async transformations
	 * @see {@link map} for simple success-only transformation
	 * @see {@link mapErr} for error-only transformation
	 *
	 * @example Basic pipeline
	 * ```typescript
	 * const result = Outcome.ok(rawInput).pipe(
	 *   ([val, err]) => {
	 *     if (err) return err;
	 *     return [validate(val), null];
	 *   },
	 *   ([val, err]) => {
	 *     if (err) return err;
	 *     return [transform(val), null];
	 *   }
	 * );
	 * ```
	 *
	 * @example Mid-chain recovery
	 * ```typescript
	 * const result = Outcome.ok(input).pipe(
	 *   ([val, err]) => {
	 *     if (err) return err;
	 *     if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
	 *     return [val, null];
	 *   },
	 *   ([val, err]) => {
	 *     // Recover from validation error
	 *     if (err?.hasCode('VALIDATION')) {
	 *       return [DEFAULT_VALUE, null];
	 *     }
	 *     if (err) return err;
	 *     return [val.process(), null];
	 *   }
	 * );
	 * ```
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
	 * Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
	 * Predicates are executed sequentially, each awaiting the previous result.
	 *
	 * @see {@link pipe} for synchronous transformations
	 * @see {@link mapAsync} for simple async success-only transformation
	 * @see {@link mapErrAsync} for async error-only transformation
	 *
	 * @example Async pipeline
	 * ```typescript
	 * const result = await Outcome.ok(userId).pipeAsync(
	 *   async ([val, err]) => {
	 *     if (err) return err;
	 *     const user = await fetchUser(val);
	 *     return [user, null];
	 *   },
	 *   async ([user, err]) => {
	 *     if (err) return err;
	 *     const profile = await fetchProfile(user.profileId);
	 *     return [{ ...user, profile }, null];
	 *   }
	 * );
	 * ```
	 *
	 * @example Async recovery
	 * ```typescript
	 * const result = await Outcome.ok(id).pipeAsync(
	 *   async ([val, err]) => {
	 *     if (err) return err;
	 *     return await fetchFromPrimary(val);
	 *   },
	 *   async ([val, err]) => {
	 *     // Fallback to secondary on error
	 *     if (err) {
	 *       return await fetchFromSecondary(id);
	 *     }
	 *     return [val, null];
	 *   }
	 * );
	 * ```
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
	 * Primary method for extracting values from an Outcome.
	 * Use destructuring for ergonomic access.
	 *
	 * @returns The internal ResultTuple<T>
	 *
	 * @see {@link fromTuple} for creating an Outcome from a tuple
	 *
	 * @example
	 * ```typescript
	 * const outcome = Outcome.ok(42);
	 * const [value, error] = outcome.toTuple();
	 *
	 * if (error) {
	 *   console.error('Failed:', error.message);
	 *   return;
	 * }
	 * console.log('Value:', value); // 42
	 * ```
	 */
	toTuple(): ResultTuple<T> {
		const [v, e] = this._tuple;
		return [v, e] as ResultTuple<T>;
	}

	/**
	 * Convert to JSON-serializable tuple.
	 *
	 * For success: returns `[value, null]`
	 * For error: returns `[null, errJSON]` where errJSON is from `Err.toJSON()`
	 *
	 * @returns JSON-serializable representation
	 *
	 * @see {@link fromJSON} for deserializing an Outcome from JSON
	 *
	 * @example
	 * ```typescript
	 * const outcome = Outcome.ok({ name: 'John' });
	 * const json = JSON.stringify(outcome.toJSON());
	 * // '[{"name":"John"},null]'
	 *
	 * // Deserialize
	 * const restored = Outcome.fromJSON(JSON.parse(json));
	 * ```
	 */
	toJSON(): [T, null] | [null, ReturnType<Err['toJSON']>] {
		if (this.isOk) {
			return [this._tuple[0] as T, null];
		}
		return [null, (this._tuple[1] as Err).toJSON()];
	}

	/**
	 * Convert to a human-readable string.
	 *
	 * @returns String representation
	 *
	 * @example
	 * ```typescript
	 * console.log(Outcome.ok(42).toString());
	 * // 'Outcome.ok(42)'
	 *
	 * console.log(Outcome.err('Failed').toString());
	 * // 'Outcome.err([ERROR] Failed)'
	 * ```
	 */
	toString(): string {
		if (this.isOk) {
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
	if (v === null) return 'null';
	if (v === undefined) return 'undefined';
	if (typeof v === 'string') return JSON.stringify(v);
	try {
		return JSON.stringify(v);
	} catch {
		return String(v);
	}
}
