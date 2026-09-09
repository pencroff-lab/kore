import type { ResultTuple } from "../types/common.types";

// ─── Group: Operators ────────────────────────────────────────────────────────

/**
 * Synchronous pipeline stage: tuple in, tuple out.
 *
 * @typeParam In - Input success type
 * @typeParam Out - Output success type
 */
export type Op<In, Out> = (tuple: ResultTuple<In>) => ResultTuple<Out>;

/**
 * Asynchronous pipeline stage.
 *
 * @typeParam In - Input success type
 * @typeParam Out - Output success type
 */
export type OpAsync<In, Out> = (
	tuple: ResultTuple<In>,
) => Promise<ResultTuple<Out>>;

/**
 * Stage accepted by `pipeAsync`: it may settle synchronously or not.
 *
 * A single call signature with a union *return*, not a union of `Op` and
 * `OpAsync` — TypeScript cannot instantiate a generic stage (the one `onErr`
 * returns) against a union target, which would collapse the pipeline's success
 * type to `unknown`. Every `Op` and `OpAsync` is assignable here. It does not
 * make an async stage valid in the synchronous `pipe`.
 */
export type AnyOp<In, Out> = (
	tuple: ResultTuple<In>,
) => ResultTuple<Out> | Promise<ResultTuple<Out>>;

/** Source accepted by `pipeAsync`: a tuple, or a promise of one. */
export type AsyncSource<T> = ResultTuple<T> | Promise<ResultTuple<T>>;

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
