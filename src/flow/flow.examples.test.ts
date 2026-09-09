import { describe, expect, test } from "bun:test";
import { Err } from "../types/err";
import {
	all,
	any,
	attempt,
	attemptAsync,
	defaultTo,
	effect,
	either,
	ensure,
	fail,
	flatMap,
	fromJSON,
	map,
	mapErr,
	ok,
	onErr,
	onOk,
	onOkAsync,
	onTuple,
	pipe,
	pipeAsync,
	type ResultTuple,
} from "./flow";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Creating results
// ══════════════════════════════════════════════════════════════════════════════

describe("Creating results", () => {
	test("ok() and fail() are the boundary", () => {
		const [value, error] = ok(42);
		const [, failure] = fail("Not found", "NOT_FOUND");

		expect(value).toBe(42);
		expect(error).toBeNull();
		expect(failure?.code).toBe("NOT_FOUND");
	});

	test("a result destructures directly — there is nothing to unwrap", () => {
		const parsePort = (raw: string): ResultTuple<number> => {
			const port = Number(raw);
			return Number.isInteger(port) ? ok(port) : fail("not a port", "PORT");
		};

		const [port, error] = parsePort("8080");

		expect(port).toBe(8080);
		expect(error).toBeNull();
	});

	test("rich errors are built with Err and passed to fail()", () => {
		const [, error] = fail(
			Err.from("read failed", {
				code: "READ_FAILED",
				metadata: { path: "/etc/app.json" },
			}),
		);

		expect(error?.code).toBe("READ_FAILED");
		expect(error?.getMetadata<string>("path")).toBe("/etc/app.json");
	});

	test("null, undefined and void are ordinary successes", () => {
		expect(ok(null)[1]).toBeNull();
		expect(ok(undefined)[1]).toBeNull();
		expect(ok()[0]).toBeUndefined();
	});

	test("ok() carries error-shaped data as success", () => {
		const carried = Err.from("this is data, not a failure");
		const [value, error] = ok(carried);

		expect(error).toBeNull();
		expect(value).toBe(carried);
	});

	test("ok() carries a tuple as success — nesting is explicit", () => {
		const inner = ok(1);
		const [value, error] = ok(inner);

		expect(error).toBeNull();
		expect(value).toBe(inner);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Exception boundaries
// ══════════════════════════════════════════════════════════════════════════════

describe("Exception boundaries", () => {
	test("attempt() wraps a throwing API", () => {
		const parse = (raw: string) =>
			attempt(() => ok(JSON.parse(raw) as unknown));

		expect(parse('{"a":1}')[0]).toEqual({ a: 1 });
		expect(parse("nope")[1]).toBeInstanceOf(Err);
	});

	test("attempt() also hosts a fallible callback", () => {
		const pick = (flag: boolean) =>
			attempt(() => (flag ? ok("yes") : fail("no", "NO")));

		expect(pick(true)[0]).toBe("yes");
		expect(pick(false)[1]?.code).toBe("NO");
	});

	test("attemptAsync() converts rejections", async () => {
		const [, error] = await attemptAsync(async () => {
			throw new Error("network down");
		});

		expect(error?.message).toBe("network down");
	});

	test("a sync callback treats a promise as data — use the async form instead", () => {
		const [value] = flatMap(ok(1), () => ok(Promise.resolve(2)));

		expect(value).toBeInstanceOf(Promise);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Transforming results
// ══════════════════════════════════════════════════════════════════════════════

describe("Transforming results", () => {
	test("map() is return-preserving — its callback returns plain data", () => {
		const [doubled] = map(ok(21), (n) => n * 2);
		const [asData] = map(ok(1), () => Err.from("data"));

		expect(doubled).toBe(42);
		expect(asData).toBeInstanceOf(Err);
	});

	test("flatMap() takes a fallible callback and composes a callee directly", () => {
		const readConfig = (id: number): ResultTuple<string> =>
			id > 0 ? ok(`config-${id}`) : fail("bad id", "BAD_ID");

		expect(flatMap(ok(7), readConfig)[0]).toBe("config-7");
		expect(flatMap(ok(-1), readConfig)[1]?.code).toBe("BAD_ID");
	});

	test("a value-returning callback gains an explicit ok()", () => {
		const [value] = flatMap(ok(2), (n) => ok(n * 2));

		expect(value).toBe(4);
	});

	test("mapErr() enriches through Err methods", () => {
		const [, error] = mapErr(fail("socket closed"), (e) =>
			fail(
				e
					.wrap("Failed to load project")
					.withCode("PROJECT_LOAD")
					.withMetadata({ projectId: 42 }),
			),
		);

		expect(error?.code).toBe("PROJECT_LOAD");
		expect(error?.root.message).toBe("socket closed");
	});

	test("mapErr() recovers with ok()", () => {
		const [value, error] = mapErr(fail("cache miss"), () => ok("default"));

		expect(error).toBeNull();
		expect(value).toBe("default");
	});

	test("ensure() validates and can refine the success type", () => {
		const isNonEmpty = (v: string): v is string => v.length > 0;

		const checked = ensure(ok("name"), isNonEmpty, () =>
			Err.from("empty", "EMPTY"),
		);
		const [, error] = ensure(ok(""), isNonEmpty, () =>
			Err.from("empty", "EMPTY"),
		);

		expect(checked[0]).toBe("name");
		expect(error?.code).toBe("EMPTY");
	});

	test("effect() observes without changing the result", () => {
		const seen: unknown[] = [];
		const [value] = effect(ok(1), ([v]) => {
			seen.push(v);
		});

		expect(value).toBe(1);
		expect(seen).toEqual([1]);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Pipelines
// ══════════════════════════════════════════════════════════════════════════════

describe("Pipelines", () => {
	test("pipe() composes stages over a tuple source", () => {
		const [value] = pipe(
			ok(" 42 "),
			onOk((raw: string) => ok(raw.trim())),
			onOk((raw: string) => attempt(() => ok(Number(raw)))),
			onOk((n: number) =>
				ensure(ok(n), Number.isInteger, () => Err.from("not an int", "INT")),
			),
		);

		expect(value).toBe(42);
	});

	test("a failing stage skips later success stages until onErr recovers", () => {
		const [value] = pipe(
			ok(1),
			onOk(() => fail("stage failed", "STAGE")),
			onOk((n: number) => ok(n * 2)),
			onErr((e) => ok(`recovered:${e.code}`)),
		);

		expect(value).toBe("recovered:STAGE");
	});

	test("a throwing custom stage is caught per stage", () => {
		const [value] = pipe(
			ok(1),
			() => {
				throw new Error("stage boom");
			},
			onErr((e) => ok(e.message)),
		);

		expect(value).toBe("stage boom");
	});

	test("a return-preserving map stage is written explicitly", () => {
		const [value] = pipe(ok(2), (tuple) => map(tuple, (n) => n * 3));

		expect(value).toBe(6);
	});

	test("onTuple() sees both channels", () => {
		const label = (source: ResultTuple<number>) =>
			pipe(
				source,
				onTuple<number, string>(([v, e]) => ok(e === null ? `ok:${v}` : "err")),
			)[0];

		expect(label(ok(1))).toBe("ok:1");
		expect(label(fail("nope"))).toBe("err");
	});

	test("pipeAsync() accepts a promised source and mixed stages", async () => {
		const [value] = await pipeAsync(
			Promise.resolve(ok(2)),
			onOkAsync(async (n: number) => ok(n * 2)),
			onOk((n: number) => ok(`n=${n}`)),
		);

		expect(value).toBe("n=4");
	});

	test("a rejected source is recoverable", async () => {
		const [value] = await pipeAsync(
			Promise.reject(new Error("source down")) as Promise<ResultTuple<number>>,
			onErr((e) => ok(e.message)),
		);

		expect(value).toBe("source down");
	});

	test("a reusable pipeline is an ordinary typed function", () => {
		const normalize = (source: ResultTuple<string>) =>
			pipe(
				source,
				onOk((raw: string) => ok(raw.trim().toLowerCase())),
				onErr(() => ok("")),
			);

		expect(normalize(ok("  Hello "))[0]).toBe("hello");
		expect(normalize(fail("nope"))[0]).toBe("");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Terminal operations
// ══════════════════════════════════════════════════════════════════════════════

describe("Terminal operations", () => {
	test("defaultTo() is handler-only — a constant fallback is a thunk", () => {
		expect(defaultTo(ok(1), () => 0)).toBe(1);
		expect(defaultTo(fail("nope"), () => 0)).toBe(0);
	});

	test("defaultTo() can recover from the error itself", () => {
		expect(defaultTo(fail("nope", "NOPE"), (e) => `<${e.code}>`)).toBe(
			"<NOPE>",
		);
	});

	test("either() folds both channels", () => {
		const render = (source: ResultTuple<number>) =>
			either(
				source,
				(v) => `value ${v}`,
				(e) => `error ${e.message}`,
			);

		expect(render(ok(1))).toBe("value 1");
		expect(render(fail("nope"))).toBe("error nope");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Collections
// ══════════════════════════════════════════════════════════════════════════════

describe("Collections", () => {
	test("all() keeps order and infers a tuple for heterogeneous input", () => {
		const [value] = all([ok(1), ok("two"), ok(true)] as const);

		expect(value).toEqual([1, "two", true]);
	});

	test("all() aggregates every failure — it evaluates already-started work", () => {
		const [, error] = all([fail("a", "A"), ok(1), fail("b", "B")]);

		expect(error?.flatten()).toHaveLength(2);
	});

	test("any() returns the first success", () => {
		const [value] = any([fail("primary down"), ok("replica"), ok("cache")]);

		expect(value).toBe("replica");
	});

	test("any([]) fails with EMPTY_INPUT", () => {
		expect(any([])[1]?.code).toBe("EMPTY_INPUT");
	});

	test("filtering a collection of results", () => {
		const results: ResultTuple<number>[] = [ok(1), fail("nope"), ok(3)];

		const values = results
			.filter((t): t is readonly [number, null] => t[1] === null)
			.map(([v]) => v);

		expect(values).toEqual([1, 3]);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Serialization
// ══════════════════════════════════════════════════════════════════════════════

describe("Serialization", () => {
	test("a result serializes with JSON.stringify — no wrapper needed", () => {
		const wire = JSON.stringify(ok({ id: 1 }));

		expect(JSON.parse(wire)).toEqual([{ id: 1 }, null]);
	});

	test("fromJSON() reconstructs an error slot as a real Err", () => {
		const wire = JSON.parse(JSON.stringify(fail("wire", "WIRE")));
		const [, error] = fromJSON(wire);

		expect(error).toBeInstanceOf(Err);
		expect(error?.code).toBe("WIRE");
	});

	test("fromJSON() validates only the envelope and the error slot", () => {
		const [value] = fromJSON<{ kind: string }>([{ kind: "Err" }, null]);

		expect(value).toEqual({ kind: "Err" });
	});

	test("fromJSON() rejects invalid payloads instead of throwing", () => {
		const [, error] = fromJSON({ not: "a tuple" });

		expect(error?.code).toBe("INVALID_JSON");
	});

	test("ok() does not round-trip as void — it comes back as ok(null)", () => {
		const wire = JSON.parse(JSON.stringify(ok()));

		expect(wire).toEqual([null, null]);
		expect(fromJSON(wire)[0]).toBeNull();
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. Input protection
// ══════════════════════════════════════════════════════════════════════════════

describe("Input protection", () => {
	test("a pipeline copies its source once, so stages cannot reach it", () => {
		const source: ResultTuple<number> = ok(1);

		pipe(source, (tuple) => {
			(tuple as [number | null, Err | null])[0] = 99;
			return tuple;
		});

		expect(source[0]).toBe(1);
	});

	test("a tuple callback receives a copy", () => {
		const source: ResultTuple<number> = ok(1);

		pipe(
			source,
			onTuple<number, number>((tuple) => {
				(tuple as [number | null, Err | null])[0] = 99;
				return ok(1);
			}),
		);

		expect(source[0]).toBe(1);
	});

	test("payloads are never cloned — nested data stays the caller's", () => {
		const payload = { count: 0 };

		const [value] = map(ok(payload), (p) => p);
		payload.count = 1;

		expect(value).toBe(payload);
		expect(value?.count).toBe(1);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. Errors are nominal
// ══════════════════════════════════════════════════════════════════════════════

describe("Errors are nominal", () => {
	test("a marker-shaped plain object is data, not an error", () => {
		const marker = { kind: "Err", message: "looks like an error" };

		expect(Err.isErr(marker)).toBe(false);
		expect(ok(marker)[1]).toBeNull();
	});

	test("Err.from() reconstructs a real instance from wire data", () => {
		const marker = { kind: "Err", message: "from the wire", code: "WIRE" };

		const [, error] = fail(Err.from(marker));

		expect(error).toBeInstanceOf(Err);
		expect(error?.code).toBe("WIRE");
	});
});
