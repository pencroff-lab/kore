import { describe, expect, test } from "bun:test";
import { Err } from "./err";
import type { ResultTuple } from "./outcome";
import { Outcome } from "./outcome";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Creating outcomes
// ══════════════════════════════════════════════════════════════════════════════

describe("Creating outcomes", () => {
	test("Outcome.ok() creates a success outcome", () => {
		const [val, err] = Outcome.ok(42).toTuple();
		expect(val).toBe(42);
		expect(err).toBeNull();
	});

	test("Outcome.err() creates an error outcome from Err instance", () => {
		const err = Err.from("Something failed");
		const [value, error] = Outcome.err(err).toTuple();
		expect(value).toBeNull();
		expect(error?.message).toBe("Something failed");
	});

	test("Outcome.err() creates an error outcome from message with code", () => {
		const [, err] = Outcome.err("Not found", "NOT_FOUND").toTuple();
		expect(err?.code).toBe("NOT_FOUND");
	});

	test("Outcome.err() creates an error outcome from message with options", () => {
		const [, err] = Outcome.err("Timeout", {
			code: "TIMEOUT",
			metadata: { durationMs: 5000 },
		}).toTuple();
		expect(err?.code).toBe("TIMEOUT");
		expect(err?.metadata).toEqual({ durationMs: 5000 });
	});

	test("Outcome.err() wraps a native Error", () => {
		const nativeErr = new Error("parse error");
		const [, err] = Outcome.err("Parse failed", nativeErr, {
			code: "PARSE_ERROR",
		}).toTuple();
		expect(err?.message).toBe("Parse failed");
		expect(err?.code).toBe("PARSE_ERROR");
		expect(err?.unwrap()).not.toBeUndefined();
	});

	test("Outcome.err<T>() claims a success type so the chain keeps working", () => {
		const count = Outcome.err<number>("bad input").defaultTo(0);
		expect(count).toBe(0);
	});

	test("Outcome.ok() creates a void success", () => {
		const [val, err] = Outcome.ok().toTuple();
		expect(val).toBeUndefined();
		expect(err).toBeNull();
	});

	test("Outcome.ok(null) carries an explicit null value", () => {
		const [val, err] = Outcome.ok(null).toTuple();
		expect(val).toBeNull();
		expect(err).toBeNull();
	});

	test("toTuple() is the single extraction point, narrowing both branches", () => {
		const describeOutcome = (outcome: Outcome<number>): string => {
			const [val, err] = outcome.toTuple();
			if (err !== null) return `failed: ${err.message}`;
			return `ok: ${val.toFixed(1)}`;
		};

		expect(describeOutcome(Outcome.ok(42))).toBe("ok: 42.0");
		expect(describeOutcome(Outcome.err<number>("Failed"))).toBe(
			"failed: Failed",
		);
	});

	test("collections narrow once mapped to tuples", () => {
		const list: Outcome<number>[] = [
			Outcome.ok(1),
			Outcome.err<number>("skipped"),
			Outcome.ok(3),
		];

		const values: number[] = list
			.map((o) => o.toTuple())
			.filter((t) => t[1] === null)
			.map((t) => t[0]);

		expect(values).toEqual([1, 3]);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Factory methods
// ══════════════════════════════════════════════════════════════════════════════

describe("Factory methods", () => {
	test("Outcome.from() carries whatever the callback returns", () => {
		const [val, err] = Outcome.from(() => 42).toTuple();
		expect(val).toBe(42);
		expect(err).toBeNull();
	});

	test("Outcome.from() with Err shorthand", () => {
		const [, err] = Outcome.from(() => Err.from("Invalid input")).toTuple();
		expect(err?.message).toBe("Invalid input");
	});

	test("Outcome.from() passes a returned Outcome through", () => {
		const [val] = Outcome.from(() => Outcome.ok("inner")).toTuple();
		expect(val).toBe("inner");
	});

	test("Outcome.from() catches throws from external libraries", () => {
		const [, err] = Outcome.from(() => JSON.parse("not valid json")).toTuple();
		expect(err).not.toBeNull();
	});

	test("Outcome.ok() is how an Err becomes a success value", () => {
		const carried = Err.from("validation detail");

		const asFailure = Outcome.from(() => carried).toTuple();
		const asValue = Outcome.from(() => Outcome.ok(carried)).toTuple();

		expect(asFailure[1]).toBe(carried);
		expect(asValue[0]).toBe(carried);
	});

	test("Outcome.fromAsync() with success", async () => {
		const [val, err] = (await Outcome.fromAsync(async () => 42)).toTuple();
		expect(val).toBe(42);
		expect(err).toBeNull();
	});

	test("Outcome.fromAsync() with error", async () => {
		const [, err] = (
			await Outcome.fromAsync(async () =>
				Err.from("Request failed", { code: "HTTP_ERROR" }),
			)
		).toTuple();
		expect(err?.code).toBe("HTTP_ERROR");
	});

	test("Outcome.fromAsync() catches async throws", async () => {
		const [, err] = (
			await Outcome.fromAsync(async () => {
				throw new Error("network failure");
			})
		).toTuple();
		expect(err).not.toBeNull();
	});

	test("Outcome.fromAsync() with error aggregation pattern", async () => {
		const [, err] = (
			await Outcome.fromAsync(async () => {
				let errors = Err.from("Batch failed");
				errors = errors.add(Err.from("task A failed"));
				errors = errors.add(Err.from("task B failed"));

				if (errors.isAggregate) return errors;
				return null;
			})
		).toTuple();
		expect(err?.isAggregate).toBe(true);
	});

	test("Outcome.fromTuple() from a tuple", () => {
		const tuple: ResultTuple<string> = ["hello", null];
		expect(Outcome.fromTuple(tuple).toTuple()[0]).toBe("hello");
	});

	test("Outcome.fromTuple() wraps a Go-style function", () => {
		// The tuple protocol lives here and nowhere else.
		const parsePort = (raw: string) =>
			Outcome.fromTuple(() => {
				const n = Number(raw);
				if (Number.isNaN(n)) return [null, Err.from("not a number", "PARSE")];
				return [n, null];
			});

		expect(parsePort("8080").toTuple()[0]).toBe(8080);
		expect(parsePort("nope").toTuple()[1]?.code).toBe("PARSE");
	});

	test("Outcome.fromTupleAsync() wraps an async Go-style function", async () => {
		const load = async (id: string): Promise<ResultTuple<{ id: string }>> =>
			id === "1" ? [{ id }, null] : [null, Err.from("missing", "NOT_FOUND")];

		const found = await Outcome.fromTupleAsync(() => load("1"));
		const missing = await Outcome.fromTupleAsync(() => load("2"));

		expect(found.toTuple()[0]).toEqual({ id: "1" });
		expect(missing.toTuple()[1]?.code).toBe("NOT_FOUND");
	});

	test("Outcome.fromTuple() round-trip", () => {
		const tuple = Outcome.ok(42).toTuple();
		expect(Outcome.fromTuple(tuple).toTuple()[0]).toBe(42);
	});

	test("a tuple returned from Outcome.from() is a plain value", () => {
		// Under the value protocol only Err and Outcome are control flow.
		const [val, err] = Outcome.fromTuple<[number, null]>(() => [
			[1, null],
			null,
		]).toTuple();
		expect(val).toEqual([1, null]);
		expect(err).toBeNull();
	});

	test("Outcome.fromJSON() round-trip", () => {
		const json = JSON.stringify(Outcome.ok({ name: "John" }).toJSON());
		const restored = Outcome.fromJSON(JSON.parse(json));
		expect(restored.toTuple()[0]).toEqual({ name: "John" });
	});

	test("Outcome.fromJSON() with invalid payload", () => {
		const [, err] = Outcome.fromJSON({ not: "a tuple" } as unknown as [
			unknown,
			null,
		]).toTuple();
		expect(err?.message).toBe("Invalid Outcome JSON");
	});

	test("Outcome.fromJSON() with error outcome round-trip", () => {
		const json = JSON.stringify(
			Outcome.err("Something failed", "FAIL_CODE").toJSON(),
		);
		const [, err] = Outcome.fromJSON(JSON.parse(json)).toTuple();
		expect(err?.message).toBe("Something failed");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Transformations
// ══════════════════════════════════════════════════════════════════════════════

describe("Transformations", () => {
	test("map() simple transformation", () => {
		const [val] = Outcome.ok(5)
			.map((n) => n * 2)
			.map((n) => n.toString())
			.toTuple();
		expect(val).toBe("10");
	});

	test("map() carries the return value as-is, never as control flow", () => {
		const [val, err] = Outcome.ok(5)
			.map(() => Err.from("this is data"))
			.toTuple();
		expect(val).toBeInstanceOf(Err);
		expect(err).toBeNull();
	});

	test("flatMap() transformation that can fail", () => {
		const [val, err] = Outcome.ok('{"name":"John"}')
			.flatMap((json) => Outcome.from(() => JSON.parse(json)))
			.toTuple();
		expect(err).toBeNull();
		expect(val).toEqual({ name: "John" });
	});

	test("flatMap() transformation that fails with invalid JSON", () => {
		const [, err] = Outcome.ok("not json")
			.flatMap((json) =>
				Outcome.from(() => JSON.parse(json)).mapErr((e) =>
					e.wrap("Invalid JSON"),
				),
			)
			.toTuple();
		expect(err?.message).toBe("Invalid JSON");
	});

	test("flatMap() treats a bare Err return as the failure", () => {
		const [, err] = Outcome.ok(10)
			.flatMap((n) => (n > 5 ? Err.from("Too big", "RANGE") : n))
			.toTuple();
		expect(err?.code).toBe("RANGE");
	});

	test("flatMap() short-circuits on the returned error", () => {
		const [, err] = Outcome.ok(10)
			.flatMap((n) => (n > 5 ? Outcome.err<number>("Too big", "RANGE") : n))
			.map((n) => n * 2)
			.toTuple();
		expect(err?.code).toBe("RANGE");
	});

	test("map() error passes through", () => {
		const [, err] = Outcome.err<number>("Original error")
			.map((v) => v)
			.toTuple();
		expect(err?.message).toBe("Original error");
	});

	test("mapAsync() transforms success value", async () => {
		const outcome = await Outcome.ok("user-123").mapAsync(async (id) => ({
			id,
			name: "John",
		}));
		expect(outcome.toTuple()[0]).toEqual({ id: "user-123", name: "John" });
	});

	test("flatMapAsync() chains an async step that can fail", async () => {
		const load = async (id: string) =>
			id === "user-123"
				? Outcome.ok({ id, name: "John" })
				: Outcome.err<{ id: string; name: string }>("Not found", "NOT_FOUND");

		const found = await Outcome.ok("user-123").flatMapAsync(load);
		const missing = await Outcome.ok("nobody").flatMapAsync(load);

		expect(found.toTuple()[0]).toEqual({ id: "user-123", name: "John" });
		expect(missing.toTuple()[1]?.code).toBe("NOT_FOUND");
	});

	test("mapErr() recovery from error", () => {
		const [val, err] = Outcome.err<string>("Not found", "NOT_FOUND")
			.mapErr((e) => (e.hasCode("NOT_FOUND") ? "default" : e))
			.toTuple();
		expect(err).toBeNull();
		expect(val).toBe("default");
	});

	test("mapErr() error transformation via wrap", () => {
		const [, err] = Outcome.err("Low-level error")
			.mapErr((e) => e.wrap("High-level context"))
			.toTuple();
		expect(err?.message).toBe("High-level context");
		expect(err?.unwrap()).not.toBeUndefined();
	});

	test("mapErr() recovery with a returned Outcome", () => {
		const [val, err] = Outcome.err("Primary failed")
			.mapErr(() => Outcome.ok("secondary"))
			.toTuple();
		expect(err).toBeNull();
		expect(val).toBe("secondary");
	});

	test("mapErr() passes through on success", () => {
		const [val] = Outcome.ok(42)
			.mapErr((e) => e)
			.toTuple();
		expect(val).toBe(42);
	});

	test("mapErrAsync() async recovery", async () => {
		const outcome = await Outcome.err<string>("Primary failed").mapErrAsync(
			async (e) => {
				const fallback = "backup-data";
				if (fallback) return fallback;
				return e.wrap("Backup also failed");
			},
		);
		expect(outcome.toTuple()[0]).toBe("backup-data");
	});

	test("pipe() basic pipeline", () => {
		const validate = (s: string) => (s.length > 0 ? s : Err.from("empty"));

		const [val] = Outcome.ok("hello")
			.pipe(
				([str, err]) => (err ? err : validate(str)),
				([str, err]) => (err ? err : str.toUpperCase()),
			)
			.toTuple();
		expect(val).toBe("HELLO");
	});

	test("pipe() mid-chain recovery", () => {
		const DEFAULT_VALUE = "recovered";

		const [val, err] = Outcome.ok("input")
			.pipe(
				([, e]) => (e ? e : Err.from("Invalid", "VALIDATION")),
				([str, e]) => {
					if (e?.hasCode("VALIDATION")) return DEFAULT_VALUE;
					if (e) return e;
					return str;
				},
			)
			.toTuple();
		expect(err).toBeNull();
		expect(val).toBe("recovered");
	});

	test("pipeAsync() async pipeline", async () => {
		const result = await Outcome.ok("user-1").pipeAsync(
			async ([id, err]) => (err ? err : { id, name: "Alice" }),
			async ([user, err]) => (err ? err : { ...user, bio: "Developer" }),
		);
		expect(result.toTuple()[0]).toEqual({
			id: "user-1",
			name: "Alice",
			bio: "Developer",
		});
	});

	test("pipeAsync() async recovery", async () => {
		const result = await Outcome.ok("id-1").pipeAsync(
			async ([, err]) => (err ? err : Err.from("primary down")),
			async ([val, err]) => (err ? "fallback-data" : val),
		);
		expect(result.toTuple()[0]).toBe("fallback-data");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Terminal operations
// ══════════════════════════════════════════════════════════════════════════════

describe("Terminal operations", () => {
	test("toTuple() extracts value and null error on success", () => {
		const [value, error] = Outcome.ok(42).toTuple();
		expect(value).toBe(42);
		expect(error).toBeNull();
	});

	test("toTuple() extracts null value and error on failure", () => {
		const [value, error] = Outcome.err("Failed").toTuple();
		expect(value).toBeNull();
		expect(error?.message).toBe("Failed");
	});

	test("defaultTo() with static fallback", () => {
		expect(Outcome.err<number>("bad input").defaultTo(0)).toBe(0);
	});

	test("defaultTo() returns success value when ok", () => {
		expect(Outcome.ok(42).defaultTo(0)).toBe(42);
	});

	test("defaultTo() with object fallback", () => {
		const config = Outcome.err<{ port: number; host: string }>(
			"no config",
		).defaultTo({ port: 3000, host: "localhost" });
		expect(config).toEqual({ port: 3000, host: "localhost" });
	});

	test("defaultTo() with computed fallback from error", () => {
		const name = Outcome.err<string>("Not found", "NOT_FOUND").defaultTo(
			(err) => (err.hasCode("NOT_FOUND") ? "Guest" : "Unknown"),
		);
		expect(name).toBe("Guest");
	});

	test("defaultTo() with function as value using asValue flag", () => {
		const defaultHandler = () => "default";
		const handler = Outcome.err<() => string>("no handler").defaultTo(
			defaultHandler,
			true,
		);
		expect(handler).toBe(defaultHandler);
		expect(handler()).toBe("default");
	});

	test("either() basic transformation", () => {
		const successMessage = Outcome.ok({ name: "John" }).either(
			(user) => `Welcome, ${user.name}!`,
			(err) => `Error: ${err.message}`,
		);
		expect(successMessage).toBe("Welcome, John!");

		const errorMessage = Outcome.err<{ name: string }>(
			"Connection lost",
		).either(
			() => "ok",
			(err) => `Error: ${err.message}`,
		);
		expect(errorMessage).toBe("Error: Connection lost");
	});

	test("either() default value on error", () => {
		const count = Outcome.err<number>("bad").either(
			(n) => n,
			() => 0,
		);
		expect(count).toBe(0);
	});

	test("either() type transformation", () => {
		const successStatus: "success" | "error" = Outcome.ok(42).either(
			() => "success" as const,
			() => "error" as const,
		);
		expect(successStatus).toBe("success");

		const errorStatus: "success" | "error" = Outcome.err<number>("fail").either(
			() => "success" as const,
			() => "error" as const,
		);
		expect(errorStatus).toBe("error");
	});

	test("either() HTTP response building pattern", () => {
		type HttpResponse = { status: number; body: Record<string, unknown> };

		const successResponse = Outcome.ok({
			id: "ord-1",
			total: 99.99,
		}).either<HttpResponse>(
			(order) => ({
				status: 200,
				body: { id: order.id, total: order.total },
			}),
			(err) => ({
				status: 500,
				body: { error: err.message },
			}),
		);
		expect(successResponse.status).toBe(200);
		expect(successResponse.body).toEqual({ id: "ord-1", total: 99.99 });

		const errorResponse = Outcome.err<{ id: string }>(
			"Not found",
			"NOT_FOUND",
		).either<HttpResponse>(
			() => ({ status: 200, body: { id: "x" } }),
			(err) => ({
				status: err.hasCode("NOT_FOUND") ? 404 : 500,
				body: { error: err.message },
			}),
		);
		expect(errorResponse.status).toBe(404);
		expect(errorResponse.body).toEqual({ error: "Not found" });
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Side effects
// ══════════════════════════════════════════════════════════════════════════════

describe("Side effects", () => {
	test("effect() runs side effect on success and chains", () => {
		let logged = "";

		const [val] = Outcome.ok(42)
			.effect(([value, err]) => {
				logged = err ? `Failed: ${err.message}` : `Success: ${value}`;
			})
			.map((v) => v * 2)
			.toTuple();

		expect(logged).toBe("Success: 42");
		expect(val).toBe(84);
	});

	test("effect() runs side effect on error", () => {
		let logged = "";

		Outcome.err("Something broke").effect(([value, err]) => {
			logged = err ? `Failed: ${err.message}` : `Success: ${value}`;
		});

		expect(logged).toBe("Failed: Something broke");
	});

	test("effect() records metrics-like data", () => {
		const metrics: {
			success: boolean;
			value: unknown;
			errorCode?: string;
		}[] = [];

		Outcome.ok(42).effect(([val, err]) => {
			metrics.push({
				success: !err,
				value: val,
				errorCode: err?.code,
			});
		});

		expect(metrics).toHaveLength(1);
		expect(metrics[0]).toEqual({
			success: true,
			value: 42,
			errorCode: undefined,
		});
	});

	test("effect() becomes error outcome if callback throws", () => {
		const [, err] = Outcome.ok(42)
			.effect(() => {
				throw new Error("effect blew up");
			})
			.toTuple();
		expect(err?.message).toBe("effect blew up");
	});

	test("effectAsync() runs async side effect", async () => {
		let logged = false;

		const outcome = await Outcome.ok({ data: "test" }).effectAsync(async () => {
			logged = true;
		});

		expect(logged).toBe(true);
		expect(outcome.toTuple()[0]).toEqual({ data: "test" });
	});

	test("effectAsync() becomes error if async callback throws", async () => {
		const outcome = await Outcome.ok(1).effectAsync(async () => {
			throw new Error("async effect failed");
		});
		expect(outcome.toTuple()[1]).not.toBeNull();
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Combinators
// ══════════════════════════════════════════════════════════════════════════════

describe("Combinators", () => {
	test("Outcome.all() succeeds when all succeed", () => {
		const combined = Outcome.all([Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)]);
		expect(combined.toTuple()[0]).toEqual([1, 2, 3]);
	});

	test("Outcome.all() fails when one fails", () => {
		const [, err] = Outcome.all([
			Outcome.ok(1),
			Outcome.err<number>("Failed"),
			Outcome.ok(3),
		]).toTuple();
		expect(err?.isAggregate).toBe(true);
		expect(err?.message).toBe("Multiple failed");
	});

	test("Outcome.all() collects multiple errors", () => {
		const [, err] = Outcome.all([
			Outcome.ok(1),
			Outcome.err<number>("Error A"),
			Outcome.err<number>("Error B"),
		]).toTuple();
		expect(err?.errors).toHaveLength(2);
	});

	test("Outcome.all() with empty array returns ok([])", () => {
		expect(Outcome.all([]).toTuple()[0]).toEqual([]);
	});

	test("Outcome.any() returns first success", () => {
		const result = Outcome.any([
			Outcome.err<number>("First failed"),
			Outcome.ok(42),
			Outcome.ok(100),
		]);
		expect(result.toTuple()[0]).toBe(42);
	});

	test("Outcome.any() fails when all fail", () => {
		const [, err] = Outcome.any([
			Outcome.err<number>("Error 1"),
			Outcome.err<number>("Error 2"),
		]).toTuple();
		expect(err?.isAggregate).toBe(true);
	});

	test("Outcome.any() with empty array returns error", () => {
		const [, err] = Outcome.any([]).toTuple();
		expect(err?.message).toBe("No outcomes provided");
		expect(err?.code).toBe("EMPTY_INPUT");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Migration from throwing
// ══════════════════════════════════════════════════════════════════════════════

describe("Migration from throwing", () => {
	test("before/after pattern: throwing vs Outcome", () => {
		// "Before" pattern: function that throws
		function getUserThrowing(id: string): { name: string } {
			const db = new Map([["123", { name: "Alice" }]]);
			const user = db.get(id);
			if (!user) throw new Error("Not found");
			return user;
		}

		// "After" pattern: function that returns Outcome
		function getUserOutcome(id: string): Outcome<{ name: string }> {
			return Outcome.from(() => {
				const db = new Map([["123", { name: "Alice" }]]);
				const user = db.get(id);
				if (!user) return Err.from("Not found", "NOT_FOUND");
				return user;
			});
		}

		// Throwing version: success
		expect(getUserThrowing("123")).toEqual({ name: "Alice" });

		// Throwing version: error
		expect(() => getUserThrowing("999")).toThrow("Not found");

		// Outcome version: success
		const [user, err] = getUserOutcome("123").toTuple();
		expect(err).toBeNull();
		expect(user).toEqual({ name: "Alice" });

		// Outcome version: error
		const [user2, err2] = getUserOutcome("999").toTuple();
		expect(user2).toBeNull();
		expect(err2?.message).toBe("Not found");
		expect(err2?.hasCode("NOT_FOUND")).toBe(true);
	});

	test("class docblock: from() with conditional success/error", () => {
		const shouldSucceed = false;
		const outcome = Outcome.from(() => {
			if (shouldSucceed) return 42;
			return Err.from("Bad luck");
		});

		const [value, err] = outcome.toTuple();
		expect(value).toBeNull();
		expect(err?.message).toBe("Bad luck");
	});

	test("toString() for success and error", () => {
		expect(Outcome.ok(42).toString()).toBe("Outcome.ok(42)");
		expect(Outcome.err("Failed").toString()).toBe(
			"Outcome.err([ERROR] Failed)",
		);
	});

	test("toJSON() round-trip for success outcome", () => {
		const json = JSON.stringify(Outcome.ok({ name: "John" }).toJSON());
		expect(json).toBe('[{"name":"John"},null]');

		const restored = Outcome.fromJSON(JSON.parse(json));
		expect(restored.toTuple()[0]).toEqual({ name: "John" });
	});
});
