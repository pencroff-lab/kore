import { describe, expect, test } from "bun:test";
import { Err } from "../types/err";
import { fail, ok, type ResultTuple } from "./flow";
import { expectErr, expectOk } from "./test";

// Compile-time equality assertion, mirroring the rest of the suite.
type Expect<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

describe("flow test helpers", () => {
	describe("expectOk()", () => {
		test("returns the success value, narrowed", () => {
			const value = expectOk(ok(42) as ResultTuple<number>);
			const narrowed: Expect<typeof value, number> = true;

			expect(value).toBe(42);
			expect(narrowed).toBe(true);
		});

		test.each([
			{ label: "null", source: () => ok(null), value: null },
			{ label: "undefined", source: () => ok(), value: undefined },
			{
				label: "an Err carried as data",
				source: () => ok(Err.from("data")),
				value: undefined,
			},
		])("returns $label without treating it as a failure", ({
			source,
			value,
		}) => {
			const result = expectOk(source() as ResultTuple<unknown>);

			if (value !== undefined) expect(result).toBe(value);
			else expect(result === undefined || result instanceof Err).toBe(true);
		});

		test("throws a readable Error naming the unexpected error", () => {
			expect(() => expectOk(fail("disk full", "DISK"))).toThrow(
				/Expected ok, got error:.*disk full/s,
			);
		});
	});

	describe("expectErr()", () => {
		test("returns the Err, narrowed", () => {
			const err = expectErr(fail("nope", "NOPE") as ResultTuple<number>);
			const narrowed: Expect<typeof err, Err> = true;

			expect(err).toBeInstanceOf(Err);
			expect(err.code).toBe("NOPE");
			expect(narrowed).toBe(true);
		});

		test.each([
			{ label: "a value", source: () => ok(42), match: /got ok: 42/ },
			{ label: "a string", source: () => ok("hi"), match: /got ok: "hi"/ },
			{ label: "undefined", source: () => ok(), match: /got ok: undefined/ },
			{
				label: "an object",
				source: () => ok({ id: 1 }),
				match: /got ok: \{"id":1\}/,
			},
		])("throws a readable Error naming $label", ({ source, match }) => {
			expect(() => expectErr(source() as ResultTuple<unknown>)).toThrow(match);
		});

		test("renders an unserializable success value without throwing", () => {
			const cyclic: Record<string, unknown> = {};
			cyclic.self = cyclic;

			expect(() => expectErr(ok(cyclic))).toThrow(/got ok: \[object Object\]/);
		});
	});

	test("the helpers import no test framework", async () => {
		const source = await Bun.file(
			new URL("./test.ts", import.meta.url).pathname,
		).text();

		expect(source).not.toContain("bun:test");
		expect(source).not.toContain("vitest");
		expect(source).not.toContain("node:test");
	});
});
