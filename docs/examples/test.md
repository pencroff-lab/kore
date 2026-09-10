# flow test helpers examples

Asserting on result tuples with expectOk and expectErr.

Generated from [`src/flow/test.examples.test.ts`](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/test.examples.test.ts).
These examples are executable — they run as part of the library's test
suite, so every line below is verified against the released code.

```ts
import { describe, expect, test } from "bun:test";
import { Err } from "../types/err";
import { attempt, fail, ok, type ResultTuple } from "./flow";
import { expectErr, expectOk } from "./test";

// The helpers ship from the `@pencroff-lab/kore/test` subpath:
//   import { expectErr, expectOk } from "@pencroff-lab/kore/test";

const parsePort = (raw: string): ResultTuple<number> =>
	attempt(() => {
		const port = Number(raw);
		return Number.isInteger(port) && port > 0
			? ok(port)
			: fail(`invalid port: ${raw}`, "PORT");
	});

describe("Asserting on results", () => {
	test("expectOk() replaces a guard-and-cast with a value", () => {
		const port = expectOk(parsePort("8080"));

		expect(port).toBe(8080);
	});

	test("expectErr() gives the Err directly", () => {
		const error = expectErr(parsePort("nope"));

		expect(error.code).toBe("PORT");
		expect(error).toBeInstanceOf(Err);
	});

	test("a wrong branch fails the test with a readable message", () => {
		expect(() => expectOk(parsePort("nope"))).toThrow(/Expected ok, got error/);
		expect(() => expectErr(parsePort("8080"))).toThrow(
			/Expected error, got ok/,
		);
	});
});
```
