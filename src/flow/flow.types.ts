import type { ResultTuple } from "../types/common.types";

// Check inferred raw returns before a tuple annotation erases any.
export type NoAny<Raw, Allowed = unknown, AnyFailure = never> = 0 extends 1 &
	Raw
	? AnyFailure
	: 0 extends 1 & Awaited<Raw>
		? AnyFailure
		: [Raw] extends [Allowed]
			? unknown
			: never;

export type UseAttemptValueOrAttemptValueAsync = {
	readonly "Unsafe any return: use attemptValue/attemptValueAsync and validate unknown data": never;
};

// Any must still normalize to unknown; known thenables belong to the async adapter.
export type SyncValue<Raw> = 0 extends 1 & Raw
	? unknown
	: [Extract<Raw, PromiseLike<unknown>>] extends [never]
		? unknown
		: { readonly "PromiseLike return: use attemptValueAsync": never };

// Value adapters preserve data while refusing to expose untyped data as any.
export type SafeValue<T> = 0 extends 1 & T ? unknown : T;

// An inference view, not a second protocol: Raw still must be a ResultTuple.
export type ResultSlots<T> = readonly [T | null, ResultTuple<T>[1]];
export type AsyncSlots<T> = ResultSlots<T> | Promise<ResultSlots<T>>;

// ─── Group: Operators ────────────────────────────────────────────────────────

/**
 * Synchronous pipeline stage: tuple in, tuple out.
 *
 * @typeParam In - Input success type
 * @typeParam Out - Output success type
 */
export type Op<In, Out, Raw extends ResultTuple<Out> = ResultTuple<Out>> = ((
	tuple: ResultTuple<In>,
) => Raw) &
	NoAny<Raw, unknown, UseAttemptValueOrAttemptValueAsync>;

/**
 * Asynchronous pipeline stage.
 *
 * @typeParam In - Input success type
 * @typeParam Out - Output success type
 */
export type OpAsync<
	In,
	Out,
	Raw extends Promise<ResultTuple<Out>> = Promise<ResultTuple<Out>>,
> = ((tuple: ResultTuple<In>) => Raw) &
	NoAny<Raw, unknown, UseAttemptValueOrAttemptValueAsync>;

/**
 * Stage accepted by `pipeAsync`: it may settle synchronously or not.
 *
 * A single call signature with a union *return*, not a union of `Op` and
 * `OpAsync` — TypeScript cannot instantiate a generic stage (the one `onErr`
 * returns) against a union target, which would collapse the pipeline's success
 * type to `unknown`. Every `Op` and `OpAsync` is assignable here. It does not
 * make an async stage valid in the synchronous `pipe`.
 */
export type AnyOp<In, Out, Raw extends AsyncSource<Out> = AsyncSource<Out>> = ((
	tuple: ResultTuple<In>,
) => Raw) &
	NoAny<Raw, unknown, UseAttemptValueOrAttemptValueAsync>;

/** Source accepted by `pipeAsync`: a tuple, or a promise of one. */
export type AsyncSource<
	T,
	Raw extends ResultTuple<T> | Promise<ResultTuple<T>> =
		| ResultTuple<T>
		| Promise<ResultTuple<T>>,
> = Raw & NoAny<Raw>;

// ─── Group: Collections ──────────────────────────────────────────────────────

/** Success type carried by a result tuple. */
export type OkValue<R> = R extends readonly [infer V, null] ? V : never;

/**
 * Success types of a collection of result tuples, positionally.
 * A tuple of results maps to a tuple of values; an array maps to an array.
 */
export type OkValues<T extends readonly unknown[]> = {
	-readonly [K in keyof T]: OkValue<T[K]>;
};
