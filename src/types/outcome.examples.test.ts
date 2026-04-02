import { describe, expect, test } from "bun:test";
import { Err } from "./err";
import type { ResultTuple } from "./outcome";
import { Outcome } from "./outcome";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Creating outcomes
// ══════════════════════════════════════════════════════════════════════════════

describe("Creating outcomes", () => {
	test("Outcome.ok() creates a success outcome", () => {
		const outcome = Outcome.ok(42);
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toBe(42);

		const [val, err] = outcome.toTuple();
		expect(val).toBe(42);
		expect(err).toBeNull();
	});

	test("Outcome.err() creates an error outcome from Err instance", () => {
		const err = Err.from("Something failed");
		const outcome = Outcome.err(err);
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.message).toBe("Something failed");
	});

	test("Outcome.err() creates an error outcome from message with code", () => {
		const outcome = Outcome.err("Not found", "NOT_FOUND");
		const [, err] = outcome.toTuple();
		expect(err?.code).toBe("NOT_FOUND");
	});

	test("Outcome.err() creates an error outcome from message with options", () => {
		const outcome = Outcome.err("Timeout", {
			code: "TIMEOUT",
			metadata: { durationMs: 5000 },
		});
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.code).toBe("TIMEOUT");
		expect(outcome.error?.metadata).toEqual({ durationMs: 5000 });
	});

	test("Outcome.err() wraps a native Error", () => {
		const nativeErr = new Error("parse error");
		const outcome = Outcome.err("Parse failed", nativeErr, {
			code: "PARSE_ERROR",
		});
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.message).toBe("Parse failed");
		expect(outcome.error?.code).toBe("PARSE_ERROR");
		expect(outcome.error?.unwrap()).not.toBeUndefined();
	});

	test("Outcome.unit() creates a void success", () => {
		const outcome = Outcome.unit();
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toBeNull();
	});

	test("isOk and isErr are complementary", () => {
		const success = Outcome.ok(42);
		const failure = Outcome.err("Failed");

		expect(success.isOk).toBe(true);
		expect(success.isErr).toBe(false);
		expect(failure.isOk).toBe(false);
		expect(failure.isErr).toBe(true);
	});

	test("value is null for error outcomes", () => {
		const success = Outcome.ok(42);
		const failure = Outcome.err("Failed");

		expect(success.value).toBe(42);
		expect(failure.value).toBeNull();
	});

	test("error is null for success outcomes", () => {
		const success = Outcome.ok(42);
		const failure = Outcome.err("Failed");

		expect(success.error).toBeNull();
		expect(failure.error?.message).toBe("Failed");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Factory methods
// ══════════════════════════════════════════════════════════════════════════════

describe("Factory methods", () => {
	test("Outcome.from() with success tuple", () => {
		const outcome = Outcome.from(() => {
			return [42, null] as [number, null];
		});
		expect(outcome.value).toBe(42);
	});

	test("Outcome.from() with Err shorthand", () => {
		const outcome = Outcome.from(() => {
			return Err.from("Invalid input");
		});
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.message).toBe("Invalid input");
	});

	test("Outcome.from() catches throws from external libraries", () => {
		const outcome = Outcome.from(() => {
			const data = JSON.parse("not valid json");
			return [data, null] as [unknown, null];
		});
		expect(outcome.isErr).toBe(true);
	});

	test("Outcome.from() basic usage from module header", () => {
		const [val, err] = Outcome.from(
			() => [42, null] as [number, null],
		).toTuple();
		expect(val).toBe(42);
		expect(err).toBeNull();
	});

	test("Outcome.fromAsync() with success", async () => {
		const outcome = await Outcome.fromAsync(async () => {
			return [42, null] as [number, null];
		});
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toBe(42);
	});

	test("Outcome.fromAsync() with error", async () => {
		const outcome = await Outcome.fromAsync(async () => {
			return Err.from("Request failed", { code: "HTTP_ERROR" });
		});
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.code).toBe("HTTP_ERROR");
	});

	test("Outcome.fromAsync() catches async throws", async () => {
		const outcome = await Outcome.fromAsync(async () => {
			throw new Error("network failure");
		});
		expect(outcome.isErr).toBe(true);
	});

	test("Outcome.fromAsync() with error aggregation pattern", async () => {
		const outcome = await Outcome.fromAsync(async () => {
			let errors = Err.from("Batch failed");
			errors = errors.add(Err.from("task A failed"));
			errors = errors.add(Err.from("task B failed"));

			if (errors.isAggregate) return errors;
			return [null, null] as [null, null];
		});
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.isAggregate).toBe(true);
	});

	test("Outcome.fromTuple() from a tuple", () => {
		const tuple: ResultTuple<string> = ["hello", null];
		const outcome = Outcome.fromTuple(tuple);
		expect(outcome.value).toBe("hello");
	});

	test("Outcome.fromTuple() round-trip", () => {
		const original = Outcome.ok(42);
		const tuple = original.toTuple();
		const restored = Outcome.fromTuple(tuple);
		expect(restored.value).toBe(42);
	});

	test("Outcome.fromJSON() round-trip", () => {
		const outcome = Outcome.ok({ name: "John" });
		const json = JSON.stringify(outcome.toJSON());
		const restored = Outcome.fromJSON(JSON.parse(json));
		expect(restored.value).toEqual({ name: "John" });
	});

	test("Outcome.fromJSON() with invalid payload", () => {
		const result = Outcome.fromJSON({ not: "a tuple" } as unknown as [
			unknown,
			null,
		]);
		expect(result.isErr).toBe(true);
		expect(result.error?.message).toBe("Invalid Outcome JSON");
	});

	test("Outcome.fromJSON() with error outcome round-trip", () => {
		const original = Outcome.err("Something failed", "FAIL_CODE");
		const json = JSON.stringify(original.toJSON());
		const restored = Outcome.fromJSON(JSON.parse(json));
		expect(restored.isErr).toBe(true);
		expect(restored.error?.message).toBe("Something failed");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Transformations
// ══════════════════════════════════════════════════════════════════════════════

describe("Transformations", () => {
	test("map() simple transformation", () => {
		const outcome = Outcome.ok(5)
			.map((n) => [n * 2, null] as [number, null])
			.map((n) => [n.toString(), null] as [string, null]);

		expect(outcome.value).toBe("10");
	});

	test("map() chaining from class docblock", () => {
		const result = Outcome.ok(5)
			.map((n) => [n * 2, null] as [number, null])
			.map((n) => [n.toString(), null] as [string, null])
			.toTuple();
		expect(result).toEqual(["10", null]);
	});

	test("map() transformation that can fail", () => {
		const outcome = Outcome.ok('{"name":"John"}').map((json) => {
			try {
				return [JSON.parse(json), null] as [unknown, null];
			} catch {
				return Err.from("Invalid JSON");
			}
		});
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toEqual({ name: "John" });
	});

	test("map() transformation that fails with invalid JSON", () => {
		const outcome = Outcome.ok("not json").map((json) => {
			try {
				return [JSON.parse(json), null] as [unknown, null];
			} catch {
				return Err.from("Invalid JSON");
			}
		});
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.message).toBe("Invalid JSON");
	});

	test("map() error passes through", () => {
		const outcome = Outcome.err("Original error").map(
			(v) => [v, null] as [never, null],
		);
		expect(outcome.error?.message).toBe("Original error");
	});

	test("mapAsync() transforms success value", async () => {
		const outcome = await Outcome.ok("user-123").mapAsync(async (id) => {
			const user = { id, name: "John" };
			return [user, null] as [typeof user, null];
		});
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toEqual({ id: "user-123", name: "John" });
	});

	test("mapErr() recovery from error", () => {
		const defaultValue = "default";
		const outcome = Outcome.err("Not found", "NOT_FOUND").mapErr((err) => {
			if (err.hasCode("NOT_FOUND")) {
				return [defaultValue, null] as [string, null];
			}
			return err;
		});
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toBe("default");
	});

	test("mapErr() error transformation via wrap", () => {
		const outcome = Outcome.err("Low-level error").mapErr((err) =>
			err.wrap("High-level context"),
		);
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.message).toBe("High-level context");
		expect(outcome.error?.unwrap()).not.toBeUndefined();
	});

	test("mapErr() passes through on success", () => {
		const outcome = Outcome.ok(42).mapErr((err) => {
			return err;
		});
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toBe(42);
	});

	test("mapErrAsync() async recovery", async () => {
		const outcome = await Outcome.err("Primary failed").mapErrAsync(
			async (err) => {
				const fallback = "backup-data";
				if (fallback) return [fallback, null] as [string, null];
				return err.wrap("Backup also failed");
			},
		);
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toBe("backup-data");
	});

	test("pipe() basic pipeline", () => {
		const validate = (s: string) => (s.length > 0 ? s : Err.from("empty"));
		const transform = (s: string) => s.toUpperCase();

		const result = Outcome.ok("hello").pipe(
			([val, err]) => {
				if (err) return err;
				const v = validate(val as string);
				if (Err.isErr(v)) return v;
				return [v, null] as [string, null];
			},
			([val, err]) => {
				if (err) return err;
				return [transform(val as string), null] as [string, null];
			},
		);
		expect(result.value).toBe("HELLO");
	});

	test("pipe() mid-chain recovery", () => {
		const DEFAULT_VALUE = "recovered";

		const result = Outcome.ok("input").pipe(
			([_val, err]) => {
				if (err) return err;
				return Err.from("Invalid", "VALIDATION");
			},
			([val, err]) => {
				if (err?.hasCode("VALIDATION")) {
					return [DEFAULT_VALUE, null] as [string, null];
				}
				if (err) return err;
				return [val, null] as [string, null];
			},
		);
		expect(result.isOk).toBe(true);
		expect(result.value).toBe("recovered");
	});

	test("pipeAsync() async pipeline", async () => {
		const result = await Outcome.ok("user-1").pipeAsync(
			async ([val, err]) => {
				if (err) return err;
				const user = { id: val, name: "Alice" };
				return [user, null] as [typeof user, null];
			},
			async ([user, err]) => {
				if (err) return err;
				const u = user as { id: string; name: string };
				const profile = { ...u, bio: "Developer" };
				return [profile, null] as [typeof profile, null];
			},
		);
		expect(result.isOk).toBe(true);
		expect(result.value).toEqual({
			id: "user-1",
			name: "Alice",
			bio: "Developer",
		});
	});

	test("pipeAsync() async recovery", async () => {
		const result = await Outcome.ok("id-1").pipeAsync(
			async ([_val, err]) => {
				if (err) return err;
				return Err.from("primary down");
			},
			async ([val, err]) => {
				if (err) {
					return ["fallback-data", null] as [string, null];
				}
				return [val, null] as [string, null];
			},
		);
		expect(result.isOk).toBe(true);
		expect(result.value).toBe("fallback-data");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Terminal operations
// ══════════════════════════════════════════════════════════════════════════════

describe("Terminal operations", () => {
	test("toTuple() extracts value and null error on success", () => {
		const outcome = Outcome.ok(42);
		const [value, error] = outcome.toTuple();
		expect(value).toBe(42);
		expect(error).toBeNull();
	});

	test("toTuple() extracts null value and error on failure", () => {
		const outcome = Outcome.err("Failed");
		const [value, error] = outcome.toTuple();
		expect(value).toBeNull();
		expect(error).not.toBeNull();
		expect(error?.message).toBe("Failed");
	});

	test("defaultTo() with static fallback", () => {
		const errOutcome = Outcome.err("bad input") as Outcome<number>;
		const count = errOutcome.defaultTo(0);
		expect(count).toBe(0);
	});

	test("defaultTo() returns success value when ok", () => {
		const count = Outcome.ok(42).defaultTo(0);
		expect(count).toBe(42);
	});

	test("defaultTo() with object fallback", () => {
		const errOutcome = Outcome.err("no config") as Outcome<{
			port: number;
			host: string;
		}>;
		const config = errOutcome.defaultTo({ port: 3000, host: "localhost" });
		expect(config).toEqual({ port: 3000, host: "localhost" });
	});

	test("defaultTo() with computed fallback from error", () => {
		const errOutcome = Outcome.err("Not found", "NOT_FOUND") as Outcome<string>;
		const name = errOutcome.defaultTo((err) =>
			err.hasCode("NOT_FOUND") ? "Guest" : "Unknown",
		);
		expect(name).toBe("Guest");
	});

	test("defaultTo() with function as value using asValue flag", () => {
		const defaultHandler = () => "default";
		const errOutcome = Outcome.err("no handler") as Outcome<() => string>;
		const handler = errOutcome.defaultTo(defaultHandler, true);
		expect(handler).toBe(defaultHandler);
		expect(handler()).toBe("default");
	});

	test("either() basic transformation", () => {
		const successMessage = Outcome.ok({ name: "John" }).either(
			(user) => `Welcome, ${user.name}!`,
			(err) => `Error: ${err.message}`,
		);
		expect(successMessage).toBe("Welcome, John!");

		const errOutcome = Outcome.err("Connection lost") as Outcome<{
			name: string;
		}>;
		const errorMessage = errOutcome.either(
			() => "ok",
			(err) => `Error: ${err.message}`,
		);
		expect(errorMessage).toBe("Error: Connection lost");
	});

	test("either() default value on error", () => {
		const errOutcome = Outcome.err("bad") as Outcome<number>;
		const count = errOutcome.either(
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

		const errOutcome = Outcome.err("fail") as Outcome<number>;
		const errorStatus: "success" | "error" = errOutcome.either(
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

		const errOutcome = Outcome.err("Not found", "NOT_FOUND") as Outcome<{
			id: string;
		}>;
		const errorResponse = errOutcome.either<HttpResponse>(
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

		const outcome = Outcome.ok(42)
			.effect(([val, err]) => {
				if (err) logged = `Failed: ${err.message}`;
				else logged = `Success: ${val}`;
			})
			.map((v) => [v * 2, null] as [number, null]);

		expect(logged).toBe("Success: 42");
		expect(outcome.value).toBe(84);
	});

	test("effect() runs side effect on error", () => {
		let logged = "";

		Outcome.err("Something broke").effect(([val, err]) => {
			if (err) logged = `Failed: ${err.message}`;
			else logged = `Success: ${val}`;
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
		const outcome = Outcome.ok(42).effect(() => {
			throw new Error("effect blew up");
		});
		expect(outcome.isErr).toBe(true);
		expect(outcome.error?.message).toBe("effect blew up");
	});

	test("effectAsync() runs async side effect", async () => {
		let logged = false;

		const outcome = await Outcome.ok({ data: "test" }).effectAsync(
			async ([_val, _err]) => {
				logged = true;
			},
		);

		expect(logged).toBe(true);
		expect(outcome.isOk).toBe(true);
		expect(outcome.value).toEqual({ data: "test" });
	});

	test("effectAsync() becomes error if async callback throws", async () => {
		const outcome = await Outcome.ok(1).effectAsync(async () => {
			throw new Error("async effect failed");
		});
		expect(outcome.isErr).toBe(true);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Combinators
// ══════════════════════════════════════════════════════════════════════════════

describe("Combinators", () => {
	test("Outcome.all() succeeds when all succeed", () => {
		const outcomes = [Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)];
		const combined = Outcome.all(outcomes);
		expect(combined.value).toEqual([1, 2, 3]);
	});

	test("Outcome.all() fails when one fails", () => {
		const outcomes = [Outcome.ok(1), Outcome.err("Failed"), Outcome.ok(3)];
		const combined = Outcome.all(outcomes);
		expect(combined.isErr).toBe(true);
		expect(combined.error?.isAggregate).toBe(true);
		expect(combined.error?.message).toBe("Multiple failed");
	});

	test("Outcome.all() collects multiple errors", () => {
		const mixed = [
			Outcome.ok(1),
			Outcome.err("Error A"),
			Outcome.err("Error B"),
		];
		const failed = Outcome.all(mixed);
		expect(failed.isErr).toBe(true);
	});

	test("Outcome.all() with empty array returns ok([])", () => {
		const combined = Outcome.all([]);
		expect(combined.value).toEqual([]);
	});

	test("Outcome.any() returns first success", () => {
		const outcomes = [
			Outcome.err("First failed"),
			Outcome.ok(42),
			Outcome.ok(100),
		];
		const result = Outcome.any(outcomes);
		expect(result.value).toBe(42);
	});

	test("Outcome.any() fails when all fail", () => {
		const outcomes = [Outcome.err("Error 1"), Outcome.err("Error 2")];
		const result = Outcome.any(outcomes);
		expect(result.isErr).toBe(true);
		expect(result.error?.isAggregate).toBe(true);
	});

	test("Outcome.any() with empty array returns error", () => {
		const result = Outcome.any([]);
		expect(result.isErr).toBe(true);
		expect(result.error?.message).toBe("No outcomes provided");
		expect(result.error?.code).toBe("EMPTY_INPUT");
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
				return [user, null] as [{ name: string }, null];
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
		expect(err2).not.toBeNull();
		expect(err2?.message).toBe("Not found");
		expect(err2?.hasCode("NOT_FOUND")).toBe(true);
	});

	test("class docblock: from() with conditional success/error", () => {
		// Simulates the class-level @example with a deterministic condition
		const shouldSucceed = false;
		const outcome = Outcome.from(() => {
			if (shouldSucceed) return [42, null] as [number, null];
			return Err.from("Bad luck");
		});

		const [value, err] = outcome.toTuple();
		expect(value).toBeNull();
		expect(err).not.toBeNull();
		expect(err?.message).toBe("Bad luck");
	});

	test("toString() for success and error", () => {
		expect(Outcome.ok(42).toString()).toBe("Outcome.ok(42)");
		expect(Outcome.err("Failed").toString()).toBe(
			"Outcome.err([ERROR] Failed)",
		);
	});

	test("toJSON() round-trip for success outcome", () => {
		const outcome = Outcome.ok({ name: "John" });
		const json = JSON.stringify(outcome.toJSON());
		expect(json).toBe('[{"name":"John"},null]');

		const restored = Outcome.fromJSON(JSON.parse(json));
		expect(restored.isOk).toBe(true);
		expect(restored.value).toEqual({ name: "John" });
	});
});
