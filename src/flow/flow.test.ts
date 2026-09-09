import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sinon from "sinon";
import { Err } from "../types/err";
import {
	type AnyOp,
	all,
	any,
	attempt,
	attemptAsync,
	copy,
	defaultTo,
	effect,
	effectAsync,
	either,
	ensure,
	fail,
	flatMap,
	flatMapAsync,
	fromJSON,
	map,
	mapAsync,
	mapErr,
	mapErrAsync,
	type Op,
	type OpAsync,
	ok,
	onErr,
	onErrAsync,
	onOk,
	onOkAsync,
	onTuple,
	onTupleAsync,
	pipe,
	pipeAsync,
	type ResultTuple,
} from "./flow";

// Compile-time equality assertion, mirroring the class-tier suite.
type Expect<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const boom = () => {
	throw new Error("boom");
};

// Stored (not inline) recovery stages: the factory has no inference site in its
// callback, so these only keep a pipeline's success type because the stage
// itself is generic in its input.
const storedRecover = onErr(() => ok("recovered"));
const storedRecoverAsync = onErrAsync(async () => ok("recovered"));

describe("flow", () => {
	// ══════════════════════════════════════════════════════════════════════
	// Types
	// ══════════════════════════════════════════════════════════════════════

	describe("types", () => {
		test("ResultTuple narrows in both branches", () => {
			const success: ResultTuple<number> = ok(42);
			const failure: ResultTuple<number> = fail("nope");

			const [sv, se] = success;
			const [fv, fe] = failure;

			expect(sv).toBe(42);
			expect(se).toBeNull();
			expect(fv).toBeNull();
			expect(fe).toBeInstanceOf(Err);
		});

		test("ResultTuple slots are readonly", () => {
			const tuple: ResultTuple<number> = ok(1);

			// @ts-expect-error result tuples are readonly at the type level
			tuple[0] = 2;

			expect(tuple[0]).toBe(2);
		});

		test("Op, OpAsync and AnyOp describe pipeline stages", () => {
			const sync: Op<number, string> = (t) => map(t, String);
			const async: OpAsync<number, string> = (t) =>
				mapAsync(t, async (n) => String(n));
			const mixed: AnyOp<number, string>[] = [sync, async];

			expect(mixed).toHaveLength(2);
			expect(sync(ok(1))[0]).toBe("1");
		});

		test("fail() chains without a generic claim", () => {
			const failed: ResultTuple<never> = fail("nope");
			const chained = map(failed, (n: number) => n * 2);
			const widened: Expect<typeof chained, ResultTuple<number>> = true;

			expect(defaultTo(chained, () => 0)).toBe(0);
			expect(widened).toBe(true);
		});

		test("a fallible callback rejects non-tuple returns", () => {
			// @ts-expect-error a bare value is not a ResultTuple
			flatMap(ok(1), (n: number) => n * 2);
			// @ts-expect-error a bare Err is not a ResultTuple
			flatMap(ok(1), () => Err.from("nope"));
			// @ts-expect-error a callback that falls off its end returns void
			flatMap(ok(1), () => {});

			expect(true).toBe(true);
		});

		test("defaultTo rejects a bare fallback value", () => {
			// @ts-expect-error the second argument is always a handler
			defaultTo(ok(1), 0);

			const failed: ResultTuple<() => string> = fail("nope");
			const fallbackFn = () => "fallback";
			// @ts-expect-error a function-valued fallback must be wrapped in a thunk
			defaultTo(failed, fallbackFn);

			expect(defaultTo(failed, () => fallbackFn)()).toBe("fallback");
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Result boundaries
	// ══════════════════════════════════════════════════════════════════════

	describe("ok()", () => {
		test.each([
			{ label: "void", build: () => ok(), value: undefined },
			{ label: "explicit null", build: () => ok(null), value: null },
			{ label: "ordinary value", build: () => ok(42), value: 42 },
			{ label: "zero", build: () => ok(0), value: 0 },
			{ label: "false", build: () => ok(false), value: false },
		])("carries $label as success", ({ build, value }) => {
			const [v, e] = build();

			expect(v).toBe(value as never);
			expect(e).toBeNull();
		});

		test("carries an Err as successful data", () => {
			const err = Err.from("payload");
			const [value, error] = ok(err);

			expect(error).toBeNull();
			expect(value).toBe(err);
		});

		test("carries a tuple as successful data", () => {
			const inner = ok(1);
			const [value, error] = ok(inner);

			expect(error).toBeNull();
			expect(value).toBe(inner);
		});

		test("ok() is typed void and ok(null) is typed null", () => {
			const voidOk: ResultTuple<void> = ok();
			const nullOk: ResultTuple<null> = ok(null);

			expect(voidOk[0]).toBeUndefined();
			expect(nullOk[0]).toBeNull();
		});
	});

	describe("fail()", () => {
		test("preserves an existing Err by reference", () => {
			const err = Err.from("original", "ORIG");
			const [, error] = fail(err);

			expect(error).toBe(err);
		});

		test("builds an Err from a message and code", () => {
			const [, error] = fail("bad input", "BAD_INPUT");

			expect(error?.message).toBe("bad input");
			expect(error?.code).toBe("BAD_INPUT");
		});

		test("applies a code to an existing Err by cloning it", () => {
			const err = Err.from("original");
			const [, error] = fail(err, "TAGGED");

			expect(error).not.toBe(err);
			expect(error?.code).toBe("TAGGED");
			expect(error?.message).toBe("original");
			expect(err.code).toBeUndefined();
		});
	});

	describe("copy()", () => {
		test("returns a new container with the same slots", () => {
			const source = ok({ id: 1 });
			const copied = copy(source);

			expect(copied).not.toBe(source);
			expect(copied[0]).toBe(source[0]);
			expect(copied[1]).toBeNull();
		});
	});

	describe("attempt()", () => {
		test.each([
			{
				label: "success tuple",
				run: () => attempt(() => ok(1)),
				value: 1,
				code: undefined,
			},
			{
				label: "void success",
				run: () => attempt(() => ok()),
				value: undefined,
				code: undefined,
			},
			{
				label: "null success",
				run: () => attempt(() => ok(null)),
				value: null,
				code: undefined,
			},
			{
				label: "failure tuple",
				run: () => attempt(() => fail("nope", "NOPE")),
				value: null,
				code: "NOPE",
			},
		])("returns the callback's $label", ({ run, value, code }) => {
			const [v, e] = run();

			expect(v).toBe(value as never);
			expect(e?.code).toBe(code as never);
		});

		test("converts a throw into a failure", () => {
			const [value, error] = attempt<number>(() => {
				throw new Error("boom");
			});

			expect(value).toBeNull();
			expect(error?.message).toBe("boom");
		});

		test("returns the callee's tuple by reference", () => {
			const inner = ok(1);
			const result = attempt(() => inner);

			expect(result).toBe(inner);
		});

		test("carries an Err or a tuple as data through ok()", () => {
			const err = Err.from("data");
			const inner = ok(1);

			expect(attempt(() => ok(err))[0]).toBe(err);
			expect(attempt(() => ok(inner))[0]).toBe(inner);
		});
	});

	describe("attemptAsync()", () => {
		test("returns the callback's tuple", async () => {
			const [value, error] = await attemptAsync(async () => ok(7));

			expect(value).toBe(7);
			expect(error).toBeNull();
		});

		test("converts a rejection into a failure", async () => {
			const [value, error] = await attemptAsync<number>(async () => {
				throw new Error("async boom");
			});

			expect(value).toBeNull();
			expect(error?.message).toBe("async boom");
		});

		test("converts a synchronous throw into a failure", async () => {
			const [, error] = await attemptAsync<number>(() => {
				throw new Error("sync boom");
			});

			expect(error?.message).toBe("sync boom");
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Data-first transformations
	// ══════════════════════════════════════════════════════════════════════

	describe("map()", () => {
		test("transforms a success value", () => {
			const [value, error] = map(ok(21), (n) => n * 2);

			expect(value).toBe(42);
			expect(error).toBeNull();
		});

		test("passes a failure through by reference", () => {
			const failed = fail("nope");
			const result = map(failed, (n: number) => n * 2);

			expect(result).toBe(failed);
		});

		test("does not call the callback on a failure", () => {
			const fn = sinon.stub().returns(1);

			map(fail("nope"), fn);

			sinon.assert.notCalled(fn);
		});

		test.each([
			{ label: "an Err", make: () => Err.from("data") },
			{ label: "a native Error", make: () => new Error("data") },
			{ label: "a success tuple", make: () => ok(1) },
			{ label: "a failure tuple", make: () => fail("inner") },
			{ label: "null", make: () => null },
		])("carries $label as data, not control flow", ({ make }) => {
			const payload = make();
			const [value, error] = map(ok(1), () => payload);

			expect(error).toBeNull();
			expect(value).toBe(payload as never);
		});

		test("converts a throw into a failure", () => {
			const [value, error] = map(ok(1), boom);

			expect(value).toBeNull();
			expect(error?.message).toBe("boom");
		});
	});

	describe("mapAsync()", () => {
		test("transforms a success value", async () => {
			const [value] = await mapAsync(ok(21), async (n) => n * 2);

			expect(value).toBe(42);
		});

		test("passes a failure through by reference", async () => {
			const failed = fail("nope");
			const result = await mapAsync(failed, async (n: number) => n * 2);

			expect(result).toBe(failed);
		});

		test("converts a rejection into a failure", async () => {
			const [, error] = await mapAsync(ok(1), async () => {
				throw new Error("boom");
			});

			expect(error?.message).toBe("boom");
		});
	});

	describe("flatMap()", () => {
		test("returns the callback's success tuple", () => {
			const [value, error] = flatMap(ok(2), (n) => ok(n * 2));

			expect(value).toBe(4);
			expect(error).toBeNull();
		});

		test("returns the callback's failure tuple", () => {
			const [value, error] = flatMap(ok(2), () => fail("rejected", "REJECTED"));

			expect(value).toBeNull();
			expect(error?.code).toBe("REJECTED");
		});

		test("composes a tuple-returning callee directly, by reference", () => {
			const readConfig = (id: number): ResultTuple<string> => ok(`cfg-${id}`);
			const inner = readConfig(1);
			const passthrough = (): ResultTuple<string> => inner;

			expect(flatMap(ok(1), readConfig)[0]).toBe("cfg-1");
			expect(flatMap(ok(1), passthrough)).toBe(inner);
		});

		test("nests explicitly through ok(tuple)", () => {
			const inner = ok(1);
			const [value, error] = flatMap(ok(0), () => ok(inner));
			const nested: Expect<typeof value, ResultTuple<number> | null> = true;

			expect(error).toBeNull();
			expect(value).toBe(inner);
			expect(nested).toBe(true);
		});

		test("passes a failure through by reference", () => {
			const failed = fail("nope");
			const result = flatMap(failed, (n: number) => ok(n));

			expect(result).toBe(failed);
		});

		test("converts a throw into a failure", () => {
			const [, error] = flatMap(ok(1), boom as () => ResultTuple<number>);

			expect(error?.message).toBe("boom");
		});
	});

	describe("flatMapAsync()", () => {
		test("returns the callback's tuple", async () => {
			const [value] = await flatMapAsync(ok(2), async (n) => ok(n * 2));

			expect(value).toBe(4);
		});

		test("passes a failure through by reference", async () => {
			const failed = fail("nope");
			const result = await flatMapAsync(failed, async (n: number) => ok(n));

			expect(result).toBe(failed);
		});

		test("converts a rejection into a failure", async () => {
			const [, error] = await flatMapAsync(ok(1), async () => {
				throw new Error("boom");
			});

			expect(error?.message).toBe("boom");
		});
	});

	describe("mapErr()", () => {
		test("passes a success through by reference", () => {
			const success = ok(1);
			const result = mapErr(success, () => ok(0));

			expect(result).toBe(success);
		});

		test("enriches an error through Err methods", () => {
			const [, error] = mapErr(fail("read failed"), (e) =>
				fail(
					e
						.wrap("Failed to load project")
						.withCode("PROJECT_LOAD")
						.withMetadata({ projectId: 7 }),
				),
			);

			expect(error?.message).toBe("Failed to load project");
			expect(error?.code).toBe("PROJECT_LOAD");
			expect(error?.getMetadata<number>("projectId")).toBe(7);
			expect(error?.root.message).toBe("read failed");
		});

		test("recovers with a value and widens the success type", () => {
			const source: ResultTuple<number> = fail("nope");
			const recovered = mapErr(source, () => ok("fallback"));
			const widened: Expect<
				typeof recovered,
				ResultTuple<string | number>
			> = true;

			expect(recovered[0]).toBe("fallback");
			expect(widened).toBe(true);
		});

		test("recovers with the error as data", () => {
			const err = Err.from("carried");
			const [value, error] = mapErr(fail(err), (e) => ok(e));

			expect(error).toBeNull();
			expect(value).toBe(err);
		});

		test("converts a throw into a failure", () => {
			const [, error] = mapErr(fail("nope"), boom as () => ResultTuple<number>);

			expect(error?.message).toBe("boom");
		});
	});

	describe("mapErrAsync()", () => {
		test("passes a success through by reference", async () => {
			const success = ok(1);
			const result = await mapErrAsync(success, async () => ok(0));

			expect(result).toBe(success);
		});

		test("recovers asynchronously", async () => {
			const [value] = await mapErrAsync(fail("nope"), async () =>
				ok("fallback"),
			);

			expect(value).toBe("fallback");
		});

		test("converts a rejection into a failure", async () => {
			const [, error] = await mapErrAsync(fail("nope"), async () => {
				throw new Error("boom");
			});

			expect(error?.message).toBe("boom");
		});
	});

	describe("effect()", () => {
		test.each([
			{ label: "success", source: () => ok(1) },
			{ label: "failure", source: () => fail("nope") },
		])("runs on a $label and returns the output copy", ({ source }) => {
			const input = source();
			const seen: ResultTuple<unknown>[] = [];

			const result = effect(input, (t) => {
				seen.push(t);
			});

			expect(result).not.toBe(input);
			expect(seen[0]).toBe(result);
			expect(result[0]).toBe(input[0] as never);
			expect(result[1]).toBe(input[1] as never);
		});

		test("ignores the callback's return value", () => {
			const [value] = effect(ok(1), (() => 99) as () => void);

			expect(value).toBe(1);
		});

		test("converts a throw into a failure", () => {
			const [, error] = effect(ok(1), boom);

			expect(error?.message).toBe("boom");
		});
	});

	describe("effectAsync()", () => {
		test("returns the output copy", async () => {
			const input = ok(1);
			const result = await effectAsync(input, async () => {});

			expect(result).not.toBe(input);
			expect(result[0]).toBe(1);
		});

		test("converts a rejection into a failure", async () => {
			const [, error] = await effectAsync(ok(1), async () => {
				throw new Error("boom");
			});

			expect(error?.message).toBe("boom");
		});
	});

	describe("ensure()", () => {
		const positive = (n: number) => n > 0;
		const toErr = (n: number) => Err.from(`not positive: ${n}`, "NOT_POSITIVE");

		test("passes a failure through and calls neither callback", () => {
			const failed = fail("nope");
			const predicate = sinon.stub().returns(true);
			const factory = sinon.stub().returns(Err.from("x"));

			const result = ensure(failed, predicate, factory);

			expect(result).toBe(failed);
			sinon.assert.notCalled(predicate);
			sinon.assert.notCalled(factory);
		});

		test("returns the original tuple when the predicate passes", () => {
			const source = ok(5);

			const result = ensure(source, positive, toErr);

			expect(result).toBe(source);
		});

		test("builds the error when the predicate fails", () => {
			const [value, error] = ensure(ok(-1), positive, toErr);

			expect(value).toBeNull();
			expect(error?.code).toBe("NOT_POSITIVE");
			expect(error?.message).toBe("not positive: -1");
		});

		test("the error factory is lazy", () => {
			const factory = sinon.stub().returns(Err.from("x"));

			ensure(ok(5), positive, factory);

			sinon.assert.notCalled(factory);
		});

		test.each([
			{
				label: "predicate",
				predicate: boom as (v: number) => boolean,
				factory: toErr,
			},
			{
				label: "error factory",
				predicate: () => false,
				factory: boom as (v: number) => Err,
			},
		])("converts a $label throw into a failure", ({ predicate, factory }) => {
			const [, error] = ensure(ok(1), predicate, factory);

			expect(error?.message).toBe("boom");
		});

		test("a type predicate refines the success type", () => {
			const source: ResultTuple<string | number> = ok("hello");
			const isString = (v: string | number): v is string =>
				typeof v === "string";

			const refined = ensure(source, isString, () => Err.from("not a string"));
			const narrowed: Expect<typeof refined, ResultTuple<string>> = true;

			expect(refined[0]).toBe("hello");
			expect(narrowed).toBe(true);
		});

		test("a boolean predicate leaves the success type alone", () => {
			const source: ResultTuple<number> = ok(5);

			const checked = ensure(source, positive, toErr);
			const unchanged: Expect<typeof checked, ResultTuple<number>> = true;

			expect(unchanged).toBe(true);
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Factories and pipelines
	// ══════════════════════════════════════════════════════════════════════

	describe("factories", () => {
		test("onOk() delegates to flatMap", () => {
			const stage = onOk((n: number) => ok(n * 2));

			expect(stage(ok(2))[0]).toBe(4);
			expect(stage(fail("nope"))[1]).toBeInstanceOf(Err);
		});

		test("onOkAsync() delegates to flatMapAsync", async () => {
			const stage = onOkAsync(async (n: number) => ok(n * 2));

			expect((await stage(ok(2)))[0]).toBe(4);
		});

		test("onErr() delegates to mapErr", () => {
			const stage = onErr(() => ok("recovered"));

			expect(stage(fail("nope"))[0]).toBe("recovered");
			expect(stage(ok("kept"))[0]).toBe("kept");
		});

		test("onErrAsync() delegates to mapErrAsync", async () => {
			const stage = onErrAsync(async () => ok("recovered"));

			expect((await stage(fail("nope")))[0]).toBe("recovered");
		});

		test.each([
			{
				label: "pipe",
				build: () =>
					pipe(
						ok(1),
						onErr(() => ok("recovered")),
					),
			},
			{
				label: "a stored stage in pipe",
				build: () => pipe(ok(1), storedRecover),
			},
			{
				label: "a stored stage after another stage",
				build: () =>
					pipe(
						ok(1),
						onOk((n: number) => ok(n + 1)),
						storedRecover,
					),
				value: 2,
			},
		])("a recovery stage keeps the success type in $label", ({
			build,
			value,
		}) => {
			const result = build();
			const typed: Expect<typeof result, ResultTuple<number | string>> = true;

			expect(result[0]).toBe(value ?? 1);
			expect(typed).toBe(true);
		});

		test.each([
			{
				label: "an inline sync stage",
				build: () =>
					pipeAsync(
						ok(1),
						onErr(() => ok("recovered")),
					),
			},
			{
				label: "a stored sync stage",
				build: () => pipeAsync(ok(1), storedRecover),
			},
			{
				label: "an inline async stage",
				build: () =>
					pipeAsync(
						ok(1),
						onErrAsync(async () => ok("recovered")),
					),
			},
			{
				label: "a stored async stage",
				build: () => pipeAsync(ok(1), storedRecoverAsync),
			},
			{
				label: "a stored async stage after another stage",
				build: () =>
					pipeAsync(
						ok(1),
						onOkAsync(async (n: number) => ok(n + 1)),
						storedRecoverAsync,
					),
				value: 2,
			},
		])("a recovery stage keeps the success type in pipeAsync with $label", async ({
			build,
			value,
		}) => {
			const result = await build();
			const typed: Expect<typeof result, ResultTuple<number | string>> = true;

			expect(result[0]).toBe(value ?? 1);
			expect(typed).toBe(true);
		});

		test("onTuple() hands the callback an input copy", () => {
			const input = ok(1);
			let seen: ResultTuple<number> | undefined;

			const result = onTuple<number, number>((t) => {
				seen = t;
				return ok(2);
			})(input);

			expect(seen).not.toBe(input);
			expect(seen?.[0]).toBe(1);
			expect(result[0]).toBe(2);
		});

		test("onTuple() returns the callback's tuple by reference", () => {
			const produced = ok(2);
			const result = onTuple<number, number>(() => produced)(ok(1));

			expect(result).toBe(produced);
		});

		test("onTuple() runs on the failure channel too", () => {
			const [value] = onTuple<number, string>((t) =>
				ok(t[1] === null ? "ok" : "err"),
			)(fail("nope"));

			expect(value).toBe("err");
		});

		test("onTuple() converts a throw into a failure", () => {
			const [, error] = onTuple<number, number>(boom)(ok(1));

			expect(error?.message).toBe("boom");
		});

		test("onTupleAsync() copies the input and catches rejections", async () => {
			const input = ok(1);
			let seen: ResultTuple<number> | undefined;

			const [, error] = await onTupleAsync<number, number>(async (t) => {
				seen = t;
				throw new Error("boom");
			})(input);

			expect(seen).not.toBe(input);
			expect(error?.message).toBe("boom");
		});
	});

	describe("pipe()", () => {
		test("runs stages in order", () => {
			const [value, error] = pipe(
				ok(2),
				onOk((n: number) => ok(n * 2)),
				onOk((n: number) => ok(`n=${n}`)),
			);

			expect(error).toBeNull();
			expect(value).toBe("n=4");
		});

		test("returns the entry copy when there are no stages", () => {
			const source = ok(1);
			const result = pipe(source);

			expect(result).not.toBe(source);
			expect(result[0]).toBe(1);
		});

		test("skips success stages after a failure and recovers mid-chain", () => {
			const later = sinon.stub().returns(ok(0));

			const [value] = pipe(
				ok(2),
				onOk(() => fail("stage failed", "STAGE")),
				onOk(later),
				onErr((e) => ok(`recovered from ${e.code}`)),
			);

			expect(value).toBe("recovered from STAGE");
			sinon.assert.notCalled(later);
		});

		test("catches a custom stage throw and lets a later stage recover", () => {
			const throwing: Op<number, number> = () => {
				throw new Error("stage boom");
			};

			const [value] = pipe(
				ok(1),
				throwing,
				onErr((e) => ok(e.message)),
			);

			expect(value).toBe("stage boom");
		});

		test("copies the source once on entry", () => {
			const source: ResultTuple<number> = ok(1);
			const mutate: Op<number, number> = (t) => {
				(t as [number | null, Err | null])[0] = 99;
				return t;
			};

			const result = pipe(source, mutate);

			expect(source[0]).toBe(1);
			expect(result[0]).toBe(99);
		});

		test("threads types through ten stages", () => {
			const step = onOk((n: number) => ok(n + 1));
			const result = pipe(
				ok(0),
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				onOk((n: number) => ok(String(n))),
			);
			const typed: Expect<typeof result, ResultTuple<string>> = true;

			expect(result[0]).toBe("9");
			expect(typed).toBe(true);
		});

		test("widens to ResultTuple<unknown> past ten stages", () => {
			const step = onOk((n: number) => ok(n + 1));
			const result = pipe(
				ok(0),
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
			);
			const widened: Expect<typeof result, ResultTuple<unknown>> = true;

			expect(result[0]).toBe(11);
			expect(widened).toBe(true);
		});
	});

	describe("pipeAsync()", () => {
		test("mixes synchronous and asynchronous stages", async () => {
			const [value] = await pipeAsync(
				ok(2),
				onOk((n: number) => ok(n * 2)),
				onOkAsync(async (n: number) => ok(`n=${n}`)),
			);

			expect(value).toBe("n=4");
		});

		test("accepts a promised source", async () => {
			const [value] = await pipeAsync(
				Promise.resolve(ok(2)),
				onOk((n: number) => ok(n + 1)),
			);

			expect(value).toBe(3);
		});

		test("a rejected source enters the failure channel and recovers later", async () => {
			const [value] = await pipeAsync(
				Promise.reject(new Error("source boom")) as Promise<
					ResultTuple<number>
				>,
				onOk((n: number) => ok(n + 1)),
				onErr((e) => ok(e.message)),
			);

			expect(value).toBe("source boom");
		});

		test("catches a rejecting custom stage and lets a later stage recover", async () => {
			const throwing: OpAsync<number, number> = async () => {
				throw new Error("stage boom");
			};

			const [value] = await pipeAsync(
				ok(1),
				throwing,
				onErr((e) => ok(e.message)),
			);

			expect(value).toBe("stage boom");
		});

		test("copies the source once on entry", async () => {
			const source: ResultTuple<number> = ok(1);
			const mutate: Op<number, number> = (t) => {
				(t as [number | null, Err | null])[0] = 99;
				return t;
			};

			const result = await pipeAsync(source, mutate);

			expect(source[0]).toBe(1);
			expect(result[0]).toBe(99);
		});

		test("threads types through ten stages", async () => {
			const step = onOkAsync(async (n: number) => ok(n + 1));
			const result = await pipeAsync(
				ok(0),
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				onOk((n: number) => ok(String(n))),
			);
			const typed: Expect<typeof result, ResultTuple<string>> = true;

			expect(result[0]).toBe("9");
			expect(typed).toBe(true);
		});

		test("widens to ResultTuple<unknown> past ten stages", async () => {
			const step = onOkAsync(async (n: number) => ok(n + 1));
			const result = await pipeAsync(
				ok(0),
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
				step,
			);
			const widened: Expect<typeof result, ResultTuple<unknown>> = true;

			expect(result[0]).toBe(11);
			expect(widened).toBe(true);
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Terminal operations
	// ══════════════════════════════════════════════════════════════════════

	describe("defaultTo()", () => {
		test("returns the success value and never calls the handler", () => {
			const handler = sinon.stub().returns(0);

			expect(defaultTo(ok(42), handler)).toBe(42);
			sinon.assert.notCalled(handler);
		});

		test.each([
			{ label: "constant", handler: () => 0, expected: 0 },
			{
				label: "error-aware",
				handler: (e: Err) => e.message.length,
				expected: 4,
			},
		])("uses a $label handler on failure", ({ handler, expected }) => {
			expect(defaultTo(fail("nope"), handler)).toBe(expected);
		});

		test("returns a function-valued fallback from a thunk", () => {
			const fallback = () => "fallback";
			const source: ResultTuple<() => string> = fail("nope");

			expect(defaultTo(source, () => fallback)).toBe(fallback);
		});

		test("lets handler exceptions propagate", () => {
			expect(() => defaultTo(fail("nope"), boom as () => number)).toThrow(
				"boom",
			);
		});
	});

	describe("either()", () => {
		test.each([
			{
				label: "success",
				source: ok(2) as ResultTuple<number>,
				expected: "ok:2",
			},
			{
				label: "failure",
				source: fail("nope") as ResultTuple<number>,
				expected: "err:nope",
			},
		])("folds a $label", ({ source, expected }) => {
			const folded = either(
				source,
				(v) => `ok:${v}`,
				(e) => `err:${e.message}`,
			);

			expect(folded).toBe(expected);
		});

		test("lets handler exceptions propagate", () => {
			expect(() => either(ok(1), boom as () => string, () => "err")).toThrow(
				"boom",
			);
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Collections
	// ══════════════════════════════════════════════════════════════════════

	describe("all()", () => {
		test("collects every success value in order", () => {
			const [value, error] = all([ok(1), ok(2), ok(3)]);

			expect(error).toBeNull();
			expect(value).toEqual([1, 2, 3]);
		});

		test("returns ok([]) for empty input", () => {
			const [value, error] = all([]);

			expect(error).toBeNull();
			expect(value).toEqual([]);
		});

		test("aggregates a single failure", () => {
			const [value, error] = all([ok(1), fail("first", "FIRST")]);

			expect(value).toBeNull();
			expect(error?.hasCode("FIRST")).toBe(true);
			expect(error?.errors).toHaveLength(1);
		});

		test("does not short-circuit and aggregates every failure", () => {
			const [, error] = all([
				fail("first", "FIRST"),
				ok(1),
				fail("second", "SECOND"),
			]);

			expect(error?.errors).toHaveLength(2);
			expect(error?.hasCode("FIRST")).toBe(true);
			expect(error?.hasCode("SECOND")).toBe(true);
		});

		test("infers a tuple of success types for heterogeneous input", () => {
			const result = all([ok(1), ok("two"), ok(true)] as const);
			const typed: Expect<
				typeof result,
				ResultTuple<[number, string, boolean]>
			> = true;

			expect(result[0]).toEqual([1, "two", true]);
			expect(typed).toBe(true);
		});

		test("infers an array for homogeneous input", () => {
			const results: ResultTuple<number>[] = [ok(1), ok(2)];
			const combined = all(results);
			const typed: Expect<typeof combined, ResultTuple<number[]>> = true;

			expect(typed).toBe(true);
		});

		test("always constructs its output", () => {
			const only = ok(1);
			const result = all([only]);

			expect(result).not.toBe(only);
		});
	});

	describe("any()", () => {
		test("returns the first success by reference", () => {
			const winner = ok(2);
			const result = any([fail("nope"), winner, ok(3)]);

			expect(result).toBe(winner);
		});

		test("aggregates every error when all fail", () => {
			const [value, error] = any([fail("a", "A"), fail("b", "B")]);

			expect(value).toBeNull();
			expect(error?.errors).toHaveLength(2);
			expect(error?.hasCode("A")).toBe(true);
			expect(error?.hasCode("B")).toBe(true);
		});

		test("fails with EMPTY_INPUT for empty input", () => {
			const [, error] = any([]);

			expect(error?.code).toBe("EMPTY_INPUT");
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Serialization
	// ══════════════════════════════════════════════════════════════════════

	describe("fromJSON()", () => {
		test.each([
			{ label: "an object", payload: {} },
			{ label: "null", payload: null },
			{ label: "a string", payload: "x" },
			{ label: "a number", payload: 42 },
			{ label: "an empty array", payload: [] },
			{ label: "a one-element array", payload: [1] },
			{ label: "a three-element array", payload: [1, null, 3] },
		])("rejects $label as a malformed envelope", ({ payload }) => {
			const [value, error] = fromJSON(payload);

			expect(value).toBeNull();
			expect(error?.code).toBe("INVALID_JSON");
			expect(error?.message).toBe(
				"Invalid JSON result: expected a two-element tuple",
			);
			expect(error?.getMetadata<unknown>("originalValue")).toBe(payload);
		});

		test("rejects a payload with both slots set", () => {
			const payload = [1, { kind: "Err", message: "m" }];
			const [, error] = fromJSON(payload);

			expect(error?.code).toBe("INVALID_JSON");
			expect(error?.message).toBe(
				"Invalid JSON result: both value and error slots are set",
			);
		});

		test.each([
			{ label: "a number", payload: [null, 42] },
			{ label: "a marker without a message", payload: [null, { kind: "Err" }] },
		])("rejects $label in the error slot", ({ payload }) => {
			const [, error] = fromJSON(payload);

			expect(error?.code).toBe("INVALID_JSON");
			expect(error?.message).toBe(
				"Invalid JSON result: invalid serialized error",
			);
		});

		test.each([
			{ label: "a value", payload: [1, null], value: 1 },
			{ label: "null", payload: [null, null], value: null },
		])("reconstructs $label success", ({ payload, value }) => {
			const [v, e] = fromJSON(payload);

			expect(e).toBeNull();
			expect(v).toBe(value as never);
		});

		test("reconstructs an error slot as a real Err", () => {
			const original = Err.from("wire", "WIRE").withMetadata({ id: 1 });
			const wire = JSON.parse(JSON.stringify([null, original]));

			const [, error] = fromJSON(wire);

			expect(error).toBeInstanceOf(Err);
			expect(error?.message).toBe("wire");
			expect(error?.code).toBe("WIRE");
			expect(error?.getMetadata<number>("id")).toBe(1);
		});

		test("preserves error-shaped successful data", () => {
			const payload = [{ kind: "Err", message: "data" }, null];

			const [value, error] = fromJSON<{ kind: string; message: string }>(
				payload,
			);

			expect(error).toBeNull();
			expect(value).toEqual({ kind: "Err", message: "data" });
			expect(Err.isErr(value)).toBe(false);
		});

		test("round-trips a success through JSON.stringify", () => {
			const wire = JSON.parse(JSON.stringify(ok({ id: 7 })));

			const [value] = fromJSON<{ id: number }>(wire);

			expect(value).toEqual({ id: 7 });
		});

		test("ok() serializes to [null, null] and reconstructs as ok(null)", () => {
			const wire = JSON.parse(JSON.stringify(ok()));

			expect(wire).toEqual([null, null]);
			expect(fromJSON(wire)[0]).toBeNull();
		});

		test("never throws on malformed input", () => {
			expect(() => fromJSON(Number.NaN)).not.toThrow();
			expect(() => fromJSON([null, { kind: "Err", message: 1 }])).not.toThrow();
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Extraction
	// ══════════════════════════════════════════════════════════════════════

	describe("extraction", () => {
		test("destructuring narrows both branches", () => {
			const source: ResultTuple<number> = ok(1);
			const [value, error] = source;

			if (error === null) {
				const narrowed: Expect<typeof value, number> = true;
				expect(narrowed).toBe(true);
			} else {
				const narrowed: Expect<typeof error, Err> = true;
				expect(narrowed).toBe(true);
			}

			expect(value).toBe(1);
		});

		test("filters a collection to its success values", () => {
			const results: ResultTuple<number>[] = [ok(1), fail("nope"), ok(3)];

			const values = results
				.filter((t): t is readonly [number, null] => t[1] === null)
				.map((t) => t[0]);

			expect(values).toEqual([1, 3]);
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Callback protocol
	// ══════════════════════════════════════════════════════════════════════

	describe("callback protocol", () => {
		test("the error slot is the only failure signal", () => {
			const errAsData = flatMap(ok(1), () => ok(Err.from("data")));
			const realFailure = flatMap(ok(1), () => fail("failed"));

			expect(errAsData[1]).toBeNull();
			expect(errAsData[0]).toBeInstanceOf(Err);
			expect(realFailure[1]).toBeInstanceOf(Err);
		});

		test.each([
			{ label: "an Err", make: () => Err.from("data") },
			{ label: "a native Error", make: () => new Error("data") },
			{ label: "a tuple", make: () => ok(1) },
			{ label: "null", make: () => null },
			{ label: "undefined", make: () => undefined },
		])("ok() carries $label as success in a callback", ({ make }) => {
			const payload = make();
			const [value, error] = flatMap(ok(0), () => ok(payload));

			expect(error).toBeNull();
			expect(value).toBe(payload as never);
		});

		test("ok() carries unknown and generic values without inspection", () => {
			const carry = <V>(value: V): ResultTuple<V> => ok(value);
			const unknownValue: unknown = [null, Err.from("looks like a failure")];

			expect(carry(unknownValue)[1]).toBeNull();
			expect(carry(unknownValue)[0]).toBe(unknownValue);
		});

		test("a sync callback treats a promise as data", () => {
			const promise = Promise.resolve(1);
			const [value, error] = flatMap(ok(0), () => ok(promise));

			expect(error).toBeNull();
			expect(value).toBe(promise);
		});

		test("a conditional callback unions both channels", () => {
			const run = (flag: boolean) =>
				attempt(() => (flag ? ok(5) : fail("nope", "NOPE")));

			expect(run(true)[0]).toBe(5);
			expect(run(false)[1]?.code).toBe("NOPE");
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Exception containment
	// ══════════════════════════════════════════════════════════════════════

	describe("exception containment", () => {
		test.each([
			{ label: "attempt", run: () => attempt<number>(boom) },
			{ label: "map", run: () => map(ok(1), boom) },
			{
				label: "flatMap",
				run: () => flatMap(ok(1), boom as () => ResultTuple<number>),
			},
			{
				label: "mapErr",
				run: () => mapErr(fail("nope"), boom as () => ResultTuple<number>),
			},
			{ label: "effect", run: () => effect(ok(1), boom) },
			{
				label: "ensure predicate",
				run: () => ensure(ok(1), boom as () => boolean, () => Err.from("x")),
			},
			{
				label: "onOk stage",
				run: () => onOk(boom as () => ResultTuple<number>)(ok(1)),
			},
			{
				label: "onTuple stage",
				run: () => onTuple<number, number>(boom)(ok(1)),
			},
			{
				label: "pipe stage",
				run: () => pipe(ok(1), boom as Op<number, number>),
			},
		])("$label converts a throw into a failure", ({ run }) => {
			const [value, error] = run();

			expect(value).toBeNull();
			expect(error?.message).toBe("boom");
		});

		test("a thrown non-Error becomes an UNKNOWN failure", () => {
			const [, error] = attempt<number>(() => {
				throw { some: "object" };
			});

			expect(error?.code).toBe("UNKNOWN");
		});

		test("a thrown serialized Err is reconstructed", () => {
			const wire = JSON.parse(JSON.stringify(Err.from("wire", "WIRE")));
			const [, error] = attempt<number>(() => {
				throw wire;
			});

			expect(error).toBeInstanceOf(Err);
			expect(error?.code).toBe("WIRE");
		});

		// Converting a caught value means touching it. A value that throws while
		// being inspected must not escape the boundary that is converting it.
		test.each([
			{
				label: "a throwing marker accessor",
				make: () => ({
					get isErr(): boolean {
						throw new Error("getter boom");
					},
				}),
			},
			{
				label: "a proxy with a throwing trap",
				make: () =>
					new Proxy(
						{},
						{
							getPrototypeOf() {
								throw new Error("proxy boom");
							},
						},
					),
			},
		])("$label thrown into attempt stays contained", ({ make }) => {
			const value = make();
			let result: ResultTuple<number> | undefined;

			expect(() => {
				result = attempt<number>(() => {
					throw value;
				});
			}).not.toThrow();
			expect(result?.[1]?.code).toBe("UNKNOWN");
			expect(result?.[1]?.getMetadata<unknown>("originalValue")).toBe(value);
		});

		test("a hostile value stays contained in attemptAsync", async () => {
			const value = {
				get kind(): string {
					throw new Error("getter boom");
				},
			};

			const [, error] = await attemptAsync<number>(async () => {
				throw value;
			});

			expect(error?.code).toBe("UNKNOWN");
		});

		test("a hostile value stays contained in a pipeline stage", () => {
			const [, error] = pipe(ok(1), () => {
				throw {
					get isErr(): boolean {
						throw new Error("getter boom");
					},
				};
			});

			expect(error?.code).toBe("UNKNOWN");
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Runtime aliasing contract
	// ══════════════════════════════════════════════════════════════════════

	describe("input protection", () => {
		test("effect gives the callback the output, not the operator input", () => {
			const input = ok({ id: 1 });
			let seen: ResultTuple<{ id: number }> | undefined;

			const result = effect(input, (t) => {
				seen = t;
				(t as [{ id: number } | null, Err | null])[0] = { id: 2 };
			});

			expect(seen).toBe(result);
			expect(input[0]).toEqual({ id: 1 });
			expect(result[0]).toEqual({ id: 2 });
		});

		test("a mutating pipeline stage cannot reach the caller's source", () => {
			const source: ResultTuple<number> = ok(1);
			const stages: ResultTuple<unknown>[] = [];

			const record: Op<number, number> = (t) => {
				stages.push(t);
				(t as [number | null, Err | null])[0] = 99;
				return t;
			};

			pipe(source, record, record);

			expect(source[0]).toBe(1);
			expect(stages[0]).not.toBe(source);
		});

		test("one entry copy carries an unchanged failure across every stage", () => {
			const source: ResultTuple<number> = fail("nope");
			const seen: ResultTuple<unknown>[] = [];
			const observe: Op<number, number> = (t) => {
				seen.push(t);
				return t;
			};

			const result = pipe(source, observe, observe, observe);

			expect(seen).toHaveLength(3);
			expect(seen[0]).not.toBe(source);
			expect(new Set(seen).size).toBe(1);
			expect(result as ResultTuple<unknown>).toBe(
				seen[0] as ResultTuple<unknown>,
			);
			expect(result[1]).toBe(source[1] as Err);
		});

		test("a mutating tuple callback cannot reach the pipeline's tuple", () => {
			const source: ResultTuple<number> = ok(1);
			const [value] = pipe(
				source,
				onTuple<number, number>((t) => {
					(t as [number | null, Err | null])[0] = 99;
					return ok(t[0] as number);
				}),
			);

			expect(source[0]).toBe(1);
			expect(value).toBe(99);
		});

		test("any() hands back a tuple the caller owns", () => {
			const winner: ResultTuple<number> = ok(1);
			const result = any([fail("nope"), winner]);

			expect(result).toBe(winner);
		});
	});

	// ══════════════════════════════════════════════════════════════════════
	// Integration
	// ══════════════════════════════════════════════════════════════════════

	describe("integration", () => {
		let sandbox: sinon.SinonSandbox;

		beforeEach(() => {
			sandbox = sinon.createSandbox();
		});

		afterEach(() => {
			sandbox.restore();
		});

		test("a config pipeline enriches and recovers", () => {
			const parse = (raw: string): ResultTuple<{ port: number }> =>
				attempt(() => ok(JSON.parse(raw) as { port: number }));

			const load = (raw: string) =>
				pipe(
					ok(raw),
					onOk(parse),
					onOk((cfg: { port: number }) =>
						ensure(
							ok(cfg),
							(c) => c.port > 0,
							(c) => Err.from(`invalid port ${c.port}`, "CONFIG:PORT"),
						),
					),
					onErr((e) =>
						fail(e.wrap("Failed to load config", { code: "CONFIG" })),
					),
				);

			expect(load('{"port":8080}')[0]).toEqual({ port: 8080 });
			expect(load('{"port":0}')[1]?.hasCodePrefix("CONFIG")).toBe(true);
			expect(load("not json")[1]?.code).toBe("CONFIG");
		});

		test("independent work aggregates every failure", () => {
			const readA = (): ResultTuple<number> => fail("a missing", "A");
			const readB = (): ResultTuple<string> => ok("b");
			const readC = (): ResultTuple<boolean> => fail("c missing", "C");

			const [, error] = all([readA(), readB(), readC()] as const);

			expect(error?.flatten()).toHaveLength(2);
			expect(error?.hasCode("A")).toBe(true);
			expect(error?.hasCode("C")).toBe(true);
		});

		test("an async pipeline recovers from a failed fetch", async () => {
			const fetchUser = sandbox.stub().rejects(new Error("network down"));

			const [value] = await pipeAsync(
				ok(7),
				onOkAsync(async (id: number) =>
					attemptAsync(async () => ok(await fetchUser(id))),
				),
				onErr((e) => ok({ id: 0, reason: e.message })),
			);

			expect(value).toEqual({ id: 0, reason: "network down" });
			sinon.assert.calledOnceWithExactly(fetchUser, 7);
		});

		test("a tuple-returning helper composes across tiers", () => {
			const findUser = (
				id: number,
			): ResultTuple<{ id: number; name: string }> =>
				id > 0 ? ok({ id, name: `user-${id}` }) : fail("bad id", "BAD_ID");

			const name = (id: number) =>
				defaultTo(
					map(findUser(id), (u) => u.name),
					(e) => `<${e.code}>`,
				);

			expect(name(1)).toBe("user-1");
			expect(name(-1)).toBe("<BAD_ID>");
		});
	});
});
