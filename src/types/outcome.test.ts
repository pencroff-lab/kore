import { describe, expect, it } from "bun:test";
import { Err } from "./err";
import {
	type CallbackReturn,
	type NullErr,
	Outcome,
	type ResultTuple,
} from "./outcome";

describe("Outcome", () => {
	describe("Type Exports", () => {
		it("should export NullErr type", () => {
			// Type-level test: if this compiles, the type is exported correctly
			const nullCase: NullErr = null;
			const errCase: NullErr = Err.from("test");
			expect(nullCase).toBeNull();
			expect(errCase).toBeInstanceOf(Err);
		});

		it("should export ResultTuple type", () => {
			const success: ResultTuple<number> = [42, null];
			const failure: ResultTuple<number> = [null, Err.from("error")];
			expect(success[0]).toBe(42);
			expect(success[1]).toBeNull();
			expect(failure[0]).toBeNull();
			expect(failure[1]).toBeInstanceOf(Err);
		});

		it("should export CallbackReturn type", () => {
			const tuple: CallbackReturn<number> = [42, null];
			const nullReturn: CallbackReturn<number> = null;
			const errReturn: CallbackReturn<number> = Err.from("error");
			expect(tuple).toEqual([42, null]);
			expect(nullReturn).toBeNull();
			expect(errReturn).toBeInstanceOf(Err);
		});
	});

	describe("Static Constructors", () => {
		describe("ok()", () => {
			it("should create success outcome with value", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.isOk).toBe(true);
				expect(outcome.isErr).toBe(false);
				expect(outcome.value).toBe(42);
				expect(outcome.error).toBeNull();
			});

			it("should handle null value", () => {
				const outcome = Outcome.ok(null);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
			});

			it("should handle undefined value", () => {
				const outcome = Outcome.ok(undefined);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeUndefined();
			});

			it("should handle object values", () => {
				const obj = { name: "test" };
				const outcome = Outcome.ok(obj);
				expect(outcome.value).toBe(obj);
			});
		});

		describe("err()", () => {
			it("should create error outcome from Err instance", () => {
				const err = Err.from("test error");
				const outcome = Outcome.err(err);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error).toBe(err);
			});

			it("should create error outcome from message", () => {
				const outcome = Outcome.err("test error");
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("test error");
			});

			it("should create error outcome from message and code", () => {
				const outcome = Outcome.err("not found", "NOT_FOUND");
				expect(outcome.error?.message).toBe("not found");
				expect(outcome.error?.code).toBe("NOT_FOUND");
			});

			it("should create error outcome from message and options", () => {
				const outcome = Outcome.err("timeout", {
					code: "TIMEOUT",
					metadata: { ms: 5000 },
				});
				expect(outcome.error?.code).toBe("TIMEOUT");
				expect(outcome.error?.metadata).toEqual({ ms: 5000 });
			});

			it("should create error outcome wrapping Error", () => {
				const nativeErr = new Error("native error");
				const outcome = Outcome.err("wrapped", nativeErr);
				expect(outcome.error?.message).toBe("wrapped");
				expect(outcome.error?.unwrap()?.message).toBe("native error");
			});

			it("should create error outcome wrapping Err", () => {
				const cause = Err.from("cause");
				const outcome = Outcome.err("wrapper", cause, { code: "WRAPPED" });
				expect(outcome.error?.message).toBe("wrapper");
				expect(outcome.error?.code).toBe("WRAPPED");
				expect(outcome.error?.unwrap()).toBe(cause);
			});

			it("should be assignable to any Outcome<T> due to never type", () => {
				const errOutcome = Outcome.err("error");
				const stringOutcome: Outcome<string> = errOutcome;
				const numberOutcome: Outcome<number> = errOutcome;
				expect(stringOutcome.isErr).toBe(true);
				expect(numberOutcome.isErr).toBe(true);
			});
		});

		describe("unit()", () => {
			it("should create success outcome with null value", () => {
				const outcome = Outcome.unit();
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
				expect(outcome.error).toBeNull();
			});
		});

		describe("from()", () => {
			it("should handle tuple success return", () => {
				const outcome = Outcome.from(() => [42, null] as ResultTuple<number>);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			it("should handle tuple error return", () => {
				const outcome = Outcome.from(
					() => [null, Err.from("error")] as ResultTuple<number>,
				);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("error");
			});

			it("should handle direct Err return", () => {
				const outcome = Outcome.from(() => Err.from("direct error"));
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("direct error");
			});

			it("should handle null return (void success)", () => {
				const outcome = Outcome.from(() => null);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
			});

			it("should catch thrown exceptions", () => {
				const outcome = Outcome.from(() => {
					throw new Error("thrown");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("thrown");
			});

			it("should catch thrown non-Error values", () => {
				const outcome = Outcome.from(() => {
					throw "string error";
				});
				expect(outcome.isErr).toBe(true);
			});
		});

		describe("fromAsync()", () => {
			it("should handle async tuple success", async () => {
				const outcome = await Outcome.fromAsync(
					async () => [42, null] as ResultTuple<number>,
				);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			it("should handle async tuple error", async () => {
				const outcome = await Outcome.fromAsync(async () => [
					null,
					Err.from("async error"),
				]);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("async error");
			});

			it("should handle async direct Err", async () => {
				const outcome = await Outcome.fromAsync(async () => Err.from("direct"));
				expect(outcome.isErr).toBe(true);
			});

			it("should handle async null return", async () => {
				const outcome = await Outcome.fromAsync(async () => null);
				expect(outcome.isOk).toBe(true);
			});

			it("should catch rejected promises", async () => {
				const outcome = await Outcome.fromAsync(async () => {
					throw new Error("rejected");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("rejected");
			});
		});

		describe("fromTuple()", () => {
			it("should create outcome from success tuple", () => {
				const tuple: ResultTuple<number> = [42, null];
				const outcome = Outcome.fromTuple(tuple);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			it("should create outcome from error tuple", () => {
				const tuple: ResultTuple<number> = [null, Err.from("error")];
				const outcome = Outcome.fromTuple(tuple);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("error");
			});
		});
	});

	describe("Combinators", () => {
		describe("all()", () => {
			it("should return success with all values when all succeed", () => {
				const outcomes = [Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)];
				const result = Outcome.all(outcomes);
				expect(result.isOk).toBe(true);
				expect(result.value).toEqual([1, 2, 3]);
			});

			it("should return aggregate error when any fails", () => {
				const outcomes = [
					Outcome.ok(1),
					Outcome.err("second failed"),
					Outcome.ok(3),
				];
				const result = Outcome.all(outcomes);
				expect(result.isErr).toBe(true);
				expect(result.error?.isAggregate).toBe(true);
				expect(result.error?.message).toBe("Multiple failed");
			});

			it("should return ok([]) for empty array", () => {
				const result = Outcome.all([]);
				expect(result.isOk).toBe(true);
				expect(result.value).toEqual([]);
			});

			it("should preserve order of values", () => {
				const outcomes = [Outcome.ok("a"), Outcome.ok("b"), Outcome.ok("c")];
				const result = Outcome.all(outcomes);
				expect(result.value).toEqual(["a", "b", "c"]);
			});

			it("all succeeds if all succeed", () => {
				const outcome = Outcome.all([Outcome.ok(1), Outcome.ok(2)]);
				expect(outcome.value).toEqual([1, 2]);
			});
		});

		describe("any()", () => {
			it("should return first success", () => {
				const outcomes = [
					Outcome.err("first erred"),
					Outcome.ok(42),
					Outcome.ok(100),
				];
				const result = Outcome.any(outcomes);
				expect(result.isOk).toBe(true);
				expect(result.value).toBe(42);
			});

			it("should return aggregate error when all err", () => {
				const outcomes = [Outcome.err("error 1"), Outcome.err("error 2")];
				const result = Outcome.any(outcomes);
				expect(result.isErr).toBe(true);
				expect(result.error?.isAggregate).toBe(true);
				expect(result.error?.count).toBe(2);
			});

			it("should return error for empty array", () => {
				const result = Outcome.any([]);
				expect(result.isErr).toBe(true);
				expect(result.error?.code).toBe("EMPTY_INPUT");
			});

			it("any returns first success", () => {
				const outcome = Outcome.any([
					Outcome.err("err1"),
					Outcome.ok(1),
					Outcome.ok(2),
				]);
				expect(outcome.value).toBe(1);
			});

			it("any aggregates errors if all err", () => {
				const outcome = Outcome.any([Outcome.err("err1"), Outcome.err("err2")]);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toContain("All failed");
				expect(outcome.error?.errors).toHaveLength(2);
			});
		});
	});

	describe("Instance Accessors", () => {
		describe("isOk / isErr", () => {
			it("should report correctly for success", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.isOk).toBe(true);
				expect(outcome.isErr).toBe(false);
			});

			it("should report correctly for error", () => {
				const outcome = Outcome.err("failed");
				expect(outcome.isOk).toBe(false);
				expect(outcome.isErr).toBe(true);
			});
		});

		describe("value / error", () => {
			it("should provide value and null error for success", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.value).toBe(42);
				expect(outcome.error).toBeNull();
			});

			it("should provide null value and error for failure", () => {
				const outcome = Outcome.err("failed");
				expect(outcome.value).toBeNull();
				expect(outcome.error?.message).toBe("failed");
			});
		});
	});

	describe("Transformation", () => {
		describe("map()", () => {
			it("should transform success value", () => {
				const outcome = Outcome.ok(5).map((n) => [n * 2, null]);
				expect(outcome.value).toBe(10);
			});

			it("should chain multiple maps", () => {
				const outcome = Outcome.ok(2)
					.map((n) => [n * 3, null])
					.map((n) => [n.toString(), null]);
				expect(outcome.value).toBe("6");
			});

			it("should pass through errors", () => {
				const outcome = Outcome.err("original").map((n) => [
					(n as number) * 2,
					null,
				]);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("original");
			});

			it("should handle callback returning Err", () => {
				const outcome = Outcome.ok(5).map(() => Err.from("map failed"));
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("map failed");
			});

			it("should handle callback returning null (void)", () => {
				const outcome = Outcome.ok(5).map(() => null);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
			});

			it("should catch callback exceptions", () => {
				const outcome = Outcome.ok(5).map(() => {
					throw new Error("callback threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("callback threw");
			});
		});

		describe("mapAsync()", () => {
			it("should transform success value asynchronously", async () => {
				const outcome = await Outcome.ok(5).mapAsync(async (n) => [
					n * 2,
					null,
				]);
				expect(outcome.value).toBe(10);
			});

			it("should pass through errors", async () => {
				const outcome = await Outcome.err("original").mapAsync(async (n) => [
					(n as number) * 2,
					null,
				]);
				expect(outcome.isErr).toBe(true);
			});

			it("should catch async exceptions", async () => {
				const outcome = await Outcome.ok(5).mapAsync(async () => {
					throw new Error("async threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("async threw");
			});
		});

		describe("mapErr()", () => {
			it("should transform error", () => {
				const outcome = Outcome.err("original").mapErr((err) =>
					err.wrap("wrapped"),
				);
				expect(outcome.error?.message).toBe("wrapped");
			});

			it("should recover from error", () => {
				const outcome = Outcome.err("failed").mapErr(() => [42, null]);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			it("should pass through success", () => {
				const outcome = Outcome.ok(42).mapErr(() => [0, null]);
				expect(outcome.value).toBe(42);
			});

			it("should handle callback returning Err", () => {
				const outcome = Outcome.err("original").mapErr(() =>
					Err.from("new error"),
				);
				expect(outcome.error?.message).toBe("new error");
			});

			it("should catch callback exceptions", () => {
				const outcome = Outcome.err("original").mapErr(() => {
					throw new Error("mapErr threw");
				});
				expect(outcome.error?.message).toBe("mapErr threw");
			});
		});

		describe("mapErrAsync()", () => {
			it("should transform error asynchronously", async () => {
				const outcome = await Outcome.err("original").mapErrAsync(async (err) =>
					err.wrap("async wrapped"),
				);
				expect(outcome.error?.message).toBe("async wrapped");
			});

			it("should recover asynchronously", async () => {
				const outcome = await Outcome.err("failed").mapErrAsync(async () => [
					42,
					null,
				]);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			it("should pass through success", async () => {
				const outcome = await Outcome.ok(42).mapErrAsync(async () => [0, null]);
				expect(outcome.value).toBe(42);
			});
		});
	});

	describe("Side Effects", () => {
		describe("effect()", () => {
			it("should execute side effect and return same outcome", () => {
				let captured: ResultTuple<number> = [0, null];
				const outcome = Outcome.ok(42).effect((tuple) => {
					captured = tuple;
				});
				expect(captured).toEqual([42, null]);
				expect(outcome.value).toBe(42);
			});

			it("should provide error in tuple for error outcomes", () => {
				let captured: ResultTuple<unknown> = [0, null];
				const outcome = Outcome.err("failed").effect((tuple) => {
					captured = tuple;
				});
				expect(captured[0]).toBeNull();
				const err = captured[1] as unknown as Err;
				expect(err?.message).toBe("failed");
				expect(outcome.isErr).toBe(true);
			});

			it("should return error outcome if callback throws", () => {
				const outcome = Outcome.ok(42).effect(() => {
					throw new Error("effect threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("effect threw");
			});

			it("should be chainable", () => {
				const logs: string[] = [];
				const outcome = Outcome.ok(1)
					.effect(() => logs.push("first"))
					.map((n) => [n + 1, null])
					.effect(() => logs.push("second"));
				expect(logs).toEqual(["first", "second"]);
				expect(outcome.value).toBe(2);
			});
		});

		describe("effectAsync()", () => {
			it("should execute async side effect", async () => {
				let captured: ResultTuple<number> = [0, null];
				const outcome = await Outcome.ok(42).effectAsync(async (tuple) => {
					captured = tuple;
				});
				expect(captured).toEqual([42, null]);
				expect(outcome.value).toBe(42);
			});

			it("should return error if async callback throws", async () => {
				const outcome = await Outcome.ok(42).effectAsync(async () => {
					throw new Error("async effect threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("async effect threw");
			});
		});
	});

	describe("Terminal Operations", () => {
		describe("defaultTo()", () => {
			it("should return value when ok", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.defaultTo(0)).toBe(42);
			});

			it("should return fallback value when err", () => {
				const outcome = Outcome.err("failed") as Outcome<number>;
				expect(outcome.defaultTo(0)).toBe(0);
			});

			it("should return computed fallback when err", () => {
				const outcome = Outcome.err("failed", "NOT_FOUND") as Outcome<number>;
				const result = outcome.defaultTo((err: Err) =>
					err.hasCode("NOT_FOUND") ? -1 : 0,
				);
				expect(result).toBe(-1);
			});

			it("should pass error to handler", () => {
				const outcome = Outcome.err(
					"test message",
					"TEST_CODE",
				) as Outcome<number>;
				let capturedErr: Err | null = null;
				outcome.defaultTo((err: Err) => {
					capturedErr = err;
					return 0;
				});
				if (capturedErr !== null) capturedErr = capturedErr as Err;
				expect(capturedErr?.message).toBe("test message");
				expect(capturedErr?.code).toBe("TEST_CODE");
			});

			it("should not call handler when ok", () => {
				const outcome = Outcome.ok(42);
				let called = false;
				outcome.defaultTo(() => {
					called = true;
					return 0;
				});
				expect(called).toBe(false);
			});

			it("should propagate handler exceptions", () => {
				const outcome = Outcome.err("failed") as Outcome<unknown>;
				expect(() => {
					outcome.defaultTo(() => {
						throw new Error("handler threw");
					});
				}).toThrow("handler threw");
			});

			it("should handle null as valid ok value", () => {
				const outcome = Outcome.ok<string | null>(null);
				expect(outcome.defaultTo("fallback")).toBeNull();
			});

			it("should handle object fallback", () => {
				const outcome = Outcome.err("failed") as Outcome<{ port: number }>;
				const fallback = { port: 3000 };
				expect(outcome.defaultTo(fallback)).toBe(fallback);
			});

			it("should treat function as value when asValue is true", () => {
				const outcome = Outcome.err("failed") as Outcome<() => number>;
				const defaultFn = () => 42;
				const result = outcome.defaultTo(defaultFn, true);
				expect(result).toBe(defaultFn);
				expect(result()).toBe(42);
			});

			it("should return function value when ok with asValue true", () => {
				const okFn = () => 100;
				const outcome = Outcome.ok(okFn);
				const defaultFn = () => 42;
				const result = outcome.defaultTo(defaultFn, true);
				expect(result).toBe(okFn);
				expect(result()).toBe(100);
			});

			it("should still use handler when asValue is not provided for function type", () => {
				const outcome = Outcome.err("failed", "NOT_FOUND") as Outcome<
					() => number
				>;
				const result = outcome.defaultTo((err: Err) => {
					if (err.hasCode("NOT_FOUND")) {
						return () => -1;
					}
					return () => 0;
				});
				expect(result()).toBe(-1);
			});
		});

		describe("either()", () => {
			it("should call onOk for success", () => {
				const outcome = Outcome.ok(42);
				const result = outcome.either(
					(v) => `value: ${v}`,
					(e) => `error: ${e.message}`,
				);
				expect(result).toBe("value: 42");
			});

			it("should call onErr for error", () => {
				const outcome = Outcome.err("failed") as Outcome<number>;
				const result = outcome.either(
					(v) => `value: ${v}`,
					(e) => `error: ${e.message}`,
				);
				expect(result).toBe("error: failed");
			});

			it("should transform to different type", () => {
				const success = Outcome.ok({ name: "John" });
				const failure = Outcome.err("not found", "NOT_FOUND");

				const successResult = success.either<{
					status: number;
					body: { name: string } | null;
				}>(
					(user) => ({ status: 200, body: user }),
					(_err) => ({ status: 404, body: null }),
				);
				const failureResult = failure.either<{
					status: number;
					body: { name: string } | null;
				}>(
					(user) => ({ status: 200, body: user }),
					(_err) => ({ status: 404, body: null }),
				);

				expect(successResult).toEqual({ status: 200, body: { name: "John" } });
				expect(failureResult).toEqual({ status: 404, body: null });
			});

			it("should propagate onOk exceptions", () => {
				const outcome = Outcome.ok(42);
				expect(() => {
					outcome.either(
						() => {
							throw new Error("onOk threw");
						},
						() => "fallback",
					);
				}).toThrow("onOk threw");
			});

			it("should propagate onErr exceptions", () => {
				const outcome = Outcome.err("failed");
				expect(() => {
					outcome.either(
						() => "success",
						() => {
							throw new Error("onErr threw");
						},
					);
				}).toThrow("onErr threw");
			});

			it("should handle union return types", () => {
				const outcome = Outcome.ok(42);
				const result: "success" | "error" = outcome.either(
					() => "success",
					() => "error",
				);
				expect(result).toBe("success");
			});

			it("should provide typed value to onOk", () => {
				const outcome = Outcome.ok({ id: 1, name: "test" });
				const result = outcome.either(
					(user) => user.name.toUpperCase(),
					() => "UNKNOWN",
				);
				expect(result).toBe("TEST");
			});

			it("should provide Err instance to onErr", () => {
				const outcome = Outcome.err("failed", {
					code: "TEST",
					metadata: { x: 1 },
				});
				const result = outcome.either(
					() => null,
					(err) => ({ code: err.code, meta: err.metadata }),
				);
				expect(result).toEqual({ code: "TEST", meta: { x: 1 } });
			});
		});
	});

	describe("Transformation Pipeline", () => {
		describe("pipe()", () => {
			it("should chain single transformation", () => {
				const result = Outcome.ok(5).pipe(([val, err]) => {
					if (err) return err;
					return [val * 2, null];
				});
				expect(result.value).toBe(10);
			});

			it("should chain multiple transformations", () => {
				const result = Outcome.ok(2).pipe(
					([val, err]) => {
						if (err) return err;
						return [val * 3, null];
					},
					([val, err]) => {
						if (err) return err;
						return [val + 1, null];
					},
					([val, err]) => {
						if (err) return err;
						return [val.toString(), null];
					},
				);
				expect(result.value).toBe("7");
			});

			it("should pass through errors", () => {
				const result = Outcome.err("initial error").pipe(([val, err]) => {
					if (err) return err;
					return [(val as number) * 2, null];
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("initial error");
			});

			it("should allow mid-chain error creation", () => {
				const result = Outcome.ok(10).pipe(
					([val, err]) => {
						if (err) return err;
						if (val > 5) return Err.from("Too big", "VALIDATION");
						return [val, null];
					},
					([val, err]) => {
						if (err) return err;
						return [val * 2, null];
					},
				);
				expect(result.isErr).toBe(true);
				expect(result.error?.code).toBe("VALIDATION");
			});

			it("should allow mid-chain recovery", () => {
				const result = Outcome.ok(10).pipe(
					([val, err]) => {
						if (err) return err;
						if (val > 5) return Err.from("Too big", "VALIDATION");
						return [val, null];
					},
					([val, err]) => {
						if (err?.hasCode("VALIDATION")) {
							return [0, null]; // recover
						}
						if (err) return err;
						return [val, null];
					},
					([val, err]) => {
						if (err) return err;
						return [val + 1, null];
					},
				);
				expect(result.isOk).toBe(true);
				expect(result.value).toBe(1);
			});

			it("should catch exceptions in predicates", () => {
				const result = Outcome.ok(5).pipe(([_val, _err]) => {
					throw new Error("predicate threw");
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("predicate threw");
			});

			it("should handle null return (void success)", () => {
				const result = Outcome.ok(5).pipe(([_val, err]) => {
					if (err) return err;
					return null;
				});
				expect(result.isOk).toBe(true);
				expect(result.value).toBeNull();
			});

			it("should type-check through transformations", () => {
				// This test verifies type inference works
				const result: Outcome<string> = Outcome.ok(5).pipe(
					([val, err]) => (err ? err : ([val * 2, null] as [number, null])),
					([val, err]) =>
						err ? err : ([val.toString(), null] as [string, null]),
				);
				expect(result.value).toBe("10");
			});

			it("should work with complex objects", () => {
				interface User {
					id: number;
					name: string;
				}
				interface UserWithRole extends User {
					role: string;
				}

				const result = Outcome.ok<User>({ id: 1, name: "John" }).pipe(
					([user, err]) => {
						if (err) return err;
						return [{ ...user, role: "admin" } as UserWithRole, null];
					},
				);
				expect(result.value).toEqual({ id: 1, name: "John", role: "admin" });
			});
		});

		describe("pipeAsync()", () => {
			it("should chain single async transformation", async () => {
				const result = await Outcome.ok(5).pipeAsync(async ([val, err]) => {
					if (err) return err;
					return [val * 2, null];
				});
				expect(result.value).toBe(10);
			});

			it("should chain multiple async transformations", async () => {
				const result = await Outcome.ok(2).pipeAsync(
					async ([val, err]) => {
						if (err) return err;
						await Promise.resolve(); // simulate async
						return [val * 3, null];
					},
					async ([val, err]) => {
						if (err) return err;
						return [val + 1, null];
					},
				);
				expect(result.value).toBe(7);
			});

			it("should pass through errors", async () => {
				const result = await Outcome.err("initial").pipeAsync(
					async ([val, err]) => {
						if (err) return err;
						return [(val as number) * 2, null];
					},
				);
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("initial");
			});

			it("should allow async mid-chain recovery", async () => {
				const result = await Outcome.ok(10).pipeAsync(
					async ([val, err]) => {
						if (err) return err;
						if (val > 5) return Err.from("Too big", "VALIDATION");
						return [val, null];
					},
					async ([val, err]) => {
						if (err?.hasCode("VALIDATION")) {
							// async recovery
							await Promise.resolve();
							return [0, null];
						}
						if (err) return err;
						return [val, null];
					},
				);
				expect(result.isOk).toBe(true);
				expect(result.value).toBe(0);
			});

			it("should catch async exceptions", async () => {
				const result = await Outcome.ok(5).pipeAsync(async () => {
					throw new Error("async threw");
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("async threw");
			});

			it("should catch rejected promises", async () => {
				const result = await Outcome.ok(5).pipeAsync(async () => {
					return Promise.reject(new Error("rejected"));
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("rejected");
			});

			it("should execute predicates sequentially", async () => {
				const order: number[] = [];
				await Outcome.ok(1).pipeAsync(
					async ([val, _err]) => {
						order.push(1);
						await new Promise((r) => setTimeout(r, 10));
						order.push(2);
						return [val, null];
					},
					async ([val, _err]) => {
						order.push(3);
						return [val, null];
					},
				);
				expect(order).toEqual([1, 2, 3]);
			});
		});
	});

	describe("Conversion", () => {
		describe("toTuple()", () => {
			it("should return success tuple", () => {
				const outcome = Outcome.ok(42);
				const tuple = outcome.toTuple();
				expect(tuple).toEqual([42, null]);
			});

			it("should return error tuple", () => {
				const outcome = Outcome.err("failed");
				const [value, error] = outcome.toTuple();
				expect(value).toBeNull();
				expect(error?.message).toBe("failed");
			});

			it("should allow destructuring", () => {
				const [value, error] = Outcome.ok("hello").toTuple();
				expect(value).toBe("hello");
				expect(error).toBeNull();
			});
		});

		describe("toJSON()", () => {
			it("should serialize success outcome", () => {
				const outcome = Outcome.ok({ name: "test" });
				const json = outcome.toJSON();
				expect(json[0]).toEqual({ name: "test" });
				expect(json[1]).toBeNull();
			});

			it("should serialize error outcome with Err.toJSON()", () => {
				const outcome = Outcome.err("failed", "ERROR_CODE");
				const json = outcome.toJSON();
				expect(json[0]).toBeNull();
				expect(json[1]?.message).toBe("failed");
				expect(json[1]?.code).toBe("ERROR_CODE");
			});

			it("should be JSON.stringify compatible", () => {
				const outcome = Outcome.ok(42);
				const str = JSON.stringify(outcome.toJSON());
				expect(str).toBe("[42,null]");
			});

			it("should support round-trip serialization", () => {
				const original = Outcome.ok({ id: 1, name: "test" });
				const json = JSON.stringify(original.toJSON());
				const parsed = JSON.parse(json);
				const restored = Outcome.fromTuple(parsed);
				expect(restored.value).toEqual({ id: 1, name: "test" });
			});
		});

		describe("toString()", () => {
			it("should format success outcome", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.toString()).toBe("Outcome.ok(42)");
			});

			it("should format error outcome", () => {
				const outcome = Outcome.err("failed", "MY_CODE");
				expect(outcome.toString()).toContain("Outcome.err");
				expect(outcome.toString()).toContain("MY_CODE");
				expect(outcome.toString()).toContain("failed");
			});

			it("should handle object values", () => {
				const outcome = Outcome.ok({ a: 1 });
				expect(outcome.toString()).toBe('Outcome.ok({"a":1})');
			});

			it("should handle null/undefined values", () => {
				expect(Outcome.ok(null).toString()).toBe("Outcome.ok(null)");
				expect(Outcome.unit().toString()).toBe("Outcome.ok(null)");
			});
		});
	});

	describe("Integration & Edge Cases", () => {
		it("should handle complex chaining", () => {
			const result = Outcome.ok(10)
				.map((n) => [n * 2, null])
				.map((n) => {
					if (n > 15) return Err.from("Too big");
					return [n, null];
				})
				.mapErr((_err) => [0, null]) // recover
				.map((n) => [n.toString(), null])
				.toTuple();
			expect(result).toEqual(["0", null]);
		});

		it("should handle async chaining", async () => {
			const result = await Outcome.ok(5)
				.mapAsync(async (n) => [n * 2, null])
				.then((o) => o.mapAsync(async (n) => [n + 1, null]));

			expect(result.value).toBe(11);
		});

		it("should work with Promise.all", async () => {
			const outcomes = await Promise.all([
				Outcome.fromAsync(async () => [1, null] as ResultTuple<number>),
				Outcome.fromAsync(async () => [2, null] as ResultTuple<number>),
				Outcome.fromAsync(async () => [3, null] as ResultTuple<number>),
			]);

			const combined = Outcome.all(outcomes);
			expect(combined.value).toEqual([1, 2, 3]);
		});

		it("should handle nested outcomes in map", () => {
			const outer = Outcome.ok(Outcome.ok(42));
			const inner = outer.map((o) => [o.value, null]);
			expect(inner.value).toBe(42);
		});

		it("should preserve immutability", () => {
			const original = Outcome.ok(42);
			const mapped = original.map((n) => [n * 2, null]);
			expect(original.value).toBe(42);
			expect(mapped.value).toBe(84);
		});
	});
});
