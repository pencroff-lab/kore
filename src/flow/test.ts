/**
 * Assertion helpers for result tuples, published as `@pencroff-lab/kore/test`.
 *
 * Both helpers narrow a `ResultTuple` to one branch and return its payload, so
 * a test asserts on a value instead of guarding and casting. Failure is a plain
 * thrown `Error`: this module imports no test framework and adds no runtime
 * dependency, so it works in any runner.
 *
 * @see [test.examples.test.ts](../../src/flow/test.examples.test.ts) for usage patterns
 * @module test
 */

import type { ResultTuple } from "../types/common.types";
import type { Err } from "../types/err";

// Render an unexpected success payload for a failure message.
function fmt(value: unknown): string {
	if (value === undefined) return "undefined";
	if (typeof value === "string") return JSON.stringify(value);
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

/**
 * Assert the tuple succeeded and return its value.
 *
 * @param tuple - Result to unwrap
 * @returns The success value
 * @throws Error if the tuple holds an error
 */
export function expectOk<T>(tuple: ResultTuple<T>): T {
	if (tuple[1] !== null) {
		throw new Error(`Expected ok, got error: ${tuple[1].toString()}`);
	}
	return tuple[0];
}

/**
 * Assert the tuple failed and return its error.
 *
 * @param tuple - Result to unwrap
 * @returns The `Err`
 * @throws Error if the tuple holds a success value
 */
export function expectErr<T>(tuple: ResultTuple<T>): Err {
	if (tuple[1] === null) {
		throw new Error(`Expected error, got ok: ${fmt(tuple[0])}`);
	}
	return tuple[1];
}
