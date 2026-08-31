import { describe, expect, test } from "bun:test";
import { Err } from "./err";
import {
	type CallbackReturn,
	type NullErr,
	Outcome,
	type PipeFn,
	type ResultTuple,
} from "./outcome";

describe("Outcome", () => {
	describe("Type Exports", () => {
		test("export NullErr type", () => {
			// Type-level test: if this compiles, the type is exported correctly
			const nullCase: NullErr = null;
			const errCase: NullErr = Err.from("test");
			expect(nullCase).toBeNull();
			expect(errCase).toBeInstanceOf(Err);
		});

		test("export ResultTuple type", () => {
			const success: ResultTuple<number> = [42, null];
			const failure: ResultTuple<number> = [null, Err.from("error")];
			expect(success[0]).toBe(42);
			expect(success[1]).toBeNull();
			expect(failure[0]).toBeNull();
			expect(failure[1]).toBeInstanceOf(Err);
		});

		test("export CallbackReturn type", () => {
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
			test("create success outcome with value", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.isOk).toBe(true);
				expect(outcome.isErr).toBe(false);
				expect(outcome.value).toBe(42);
				expect(outcome.error).toBeNull();
			});

			test("create void success outcome with no argument", () => {
				const outcome: Outcome<void> = Outcome.ok();
				expect(outcome.isOk).toBe(true);
				expect(outcome.isErr).toBe(false);
				expect(outcome.value).toBeUndefined();
				expect(outcome.error).toBeNull();
				expect(outcome.toString()).toBe("Outcome.ok(undefined)");
			});

			test("carry null only when null is passed explicitly", () => {
				const outcome: Outcome<null> = Outcome.ok(null);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
				expect(outcome.toString()).toBe("Outcome.ok(null)");
			});

			test("agree with an explicit undefined argument", () => {
				expect(Outcome.ok().value).toBeUndefined();
				expect(Outcome.ok(undefined).value).toBeUndefined();
			});

			test("handle undefined value", () => {
				const outcome = Outcome.ok(undefined);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeUndefined();
			});

			test("handle object values", () => {
				const obj = { name: "test" };
				const outcome = Outcome.ok(obj);
				expect(outcome.value).toBe(obj);
			});
		});

		describe("err()", () => {
			test("create error outcome from Err instance", () => {
				const err = Err.from("test error");
				const outcome = Outcome.err(err);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error).toBe(err);
			});

			test("create error outcome from message", () => {
				const outcome = Outcome.err("test error");
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("test error");
			});

			test("create error outcome from message and code", () => {
				const outcome = Outcome.err("not found", "NOT_FOUND");
				expect(outcome.error?.message).toBe("not found");
				expect(outcome.error?.code).toBe("NOT_FOUND");
			});

			test("create error outcome from message and options", () => {
				const outcome = Outcome.err("timeout", {
					code: "TIMEOUT",
					metadata: { ms: 5000 },
				});
				expect(outcome.error?.code).toBe("TIMEOUT");
				expect(outcome.error?.metadata).toEqual({ ms: 5000 });
			});

			test("create error outcome wrapping Error", () => {
				const nativeErr = new Error("native error");
				const outcome = Outcome.err("wrapped", nativeErr);
				expect(outcome.error?.message).toBe("wrapped");
				expect(outcome.error?.unwrap()?.message).toBe("native error");
			});

			test("create error outcome wrapping Error with custom code", () => {
				const inner = new Error("inner");
				const outcome = Outcome.err("context", inner, {
					code: "CUSTOM_CODE",
				});
				expect(outcome.error?.message).toBe("context");
				expect(outcome.error?.code).toBe("CUSTOM_CODE");
				expect(outcome.error?.unwrap()?.message).toBe("inner");
			});

			test("create error outcome wrapping Err", () => {
				const cause = Err.from("cause");
				const outcome = Outcome.err("wrapper", cause, { code: "WRAPPED" });
				expect(outcome.error?.message).toBe("wrapper");
				expect(outcome.error?.code).toBe("WRAPPED");
				expect(outcome.error?.unwrap()).toBe(cause);
			});

			test("be assignable to any Outcome<T> due to never type", () => {
				const errOutcome = Outcome.err("error");
				const stringOutcome: Outcome<string> = errOutcome;
				const numberOutcome: Outcome<number> = errOutcome;
				expect(stringOutcome.isErr).toBe(true);
				expect(numberOutcome.isErr).toBe(true);
			});
		});

		describe("unit() (deprecated, removed in v0.7.0)", () => {
			test("create success outcome with null value", () => {
				const outcome = Outcome.unit();
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
				expect(outcome.error).toBeNull();
			});

			test("match its Outcome.ok(null) replacement", () => {
				const deprecated = Outcome.unit();
				const replacement = Outcome.ok(null);
				expect(deprecated.isOk).toBe(replacement.isOk);
				expect(deprecated.value).toBe(replacement.value);
				expect(deprecated.toString()).toBe(replacement.toString());
			});

			test("differ from Outcome.ok(), which carries undefined", () => {
				expect(Outcome.unit().value).toBeNull();
				expect(Outcome.ok().value).toBeUndefined();
			});
		});

		describe("from()", () => {
			test("handle tuple success return", () => {
				const outcome = Outcome.from(() => [42, null] as ResultTuple<number>);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			test("handle tuple error return", () => {
				const outcome = Outcome.from(
					() => [null, Err.from("error")] as ResultTuple<number>,
				);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("error");
			});

			test("handle direct Err return", () => {
				const outcome = Outcome.from(() => Err.from("direct error"));
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("direct error");
			});

			test("handle null return (void success)", () => {
				const outcome = Outcome.from(() => null);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
			});

			test("catch thrown exceptions", () => {
				const outcome = Outcome.from(() => {
					throw new Error("thrown");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("thrown");
			});

			test("catch thrown non-Error values", () => {
				const outcome = Outcome.from(() => {
					throw "string error";
				});
				expect(outcome.isErr).toBe(true);
			});
		});

		describe("fromAsync()", () => {
			test("handle async tuple success", async () => {
				const outcome = await Outcome.fromAsync(
					async () => [42, null] as ResultTuple<number>,
				);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			test("handle async tuple error", async () => {
				const outcome = await Outcome.fromAsync(async () => [
					null,
					Err.from("async error"),
				]);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("async error");
			});

			test("handle async direct Err", async () => {
				const outcome = await Outcome.fromAsync(async () => Err.from("direct"));
				expect(outcome.isErr).toBe(true);
			});

			test("handle async null return", async () => {
				const outcome = await Outcome.fromAsync(async () => null);
				expect(outcome.isOk).toBe(true);
			});

			test("catch rejected promises", async () => {
				const outcome = await Outcome.fromAsync(async () => {
					throw new Error("rejected");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("rejected");
			});
		});

		describe("invalid callback returns", () => {
			test("bare string return is rejected, not destructured per char", () => {
				const fn = (() => "hello") as unknown as () => CallbackReturn<string>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.error?.message).toContain("Invalid callback return");
				expect(outcome.error?.metadata?.received).toBe("string");
				expect(outcome.value).not.toBe("h");
			});

			test("bare number return is rejected without cryptic TypeError", () => {
				const fn = (() => 42) as unknown as () => CallbackReturn<number>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.error?.message).not.toContain("not iterable");
			});

			test("bare object return is rejected", () => {
				const fn = (() => ({
					a: 1,
				})) as unknown as () => CallbackReturn<object>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.error?.metadata?.received).toBe("object");
			});

			test("undefined return is rejected", () => {
				const fn = (() => undefined) as unknown as () => CallbackReturn<null>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.error?.metadata?.received).toBe("undefined");
			});

			test("one-element array is rejected", () => {
				const fn = (() => ["only"]) as unknown as () => CallbackReturn<string>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.error?.metadata).toEqual({
					received: "array",
					length: 1,
				});
			});

			test("three-element array is rejected", () => {
				const fn = (() => [
					"a",
					null,
					"extra",
				]) as unknown as () => CallbackReturn<string>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.error?.metadata).toEqual({
					received: "array",
					length: 3,
				});
			});

			test("empty array is rejected", () => {
				const fn = (() => []) as unknown as () => CallbackReturn<null>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.error?.metadata).toEqual({
					received: "array",
					length: 0,
				});
			});

			test("non-null non-Err second slot is rejected, not swallowed", () => {
				const fn = (() => [
					null,
					"string error",
				]) as unknown as () => CallbackReturn<null>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
			});

			test("bare two-element array is rejected, not read as tuple", () => {
				const fn = (() => [
					"a",
					"b",
				]) as unknown as () => CallbackReturn<string>;
				const outcome = Outcome.from(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
				expect(outcome.value).not.toBe("a");
			});

			test("array success value wrapped in tuple still works", () => {
				const outcome = Outcome.from(
					() => [["a", "b"], null] as ResultTuple<string[]>,
				);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toEqual(["a", "b"]);
			});

			test("map() with bare value return is a plain success", () => {
				const outcome = Outcome.ok(1).map((v: number) => `${v}`);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe("1");
			});

			test("pipe() with bare value return is rejected", () => {
				const outcome = Outcome.ok(1).pipe(
					(() => "bare") as unknown as PipeFn<number, string>,
				);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
			});

			test("fromAsync() with bare value return is rejected", async () => {
				const fn = (async () => "hello") as unknown as () => Promise<
					CallbackReturn<string>
				>;
				const outcome = await Outcome.fromAsync(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_CALLBACK_RETURN");
			});
		});

		describe("fromTuple()", () => {
			test("create outcome from success tuple", () => {
				const tuple: ResultTuple<number> = [42, null];
				const outcome = Outcome.fromTuple(tuple);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			test("create outcome from error tuple", () => {
				const tuple: ResultTuple<number> = [null, Err.from("error")];
				const outcome = Outcome.fromTuple(tuple);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("error");
			});
		});

		describe("fromJSON()", () => {
			test("restore success outcome from toJSON() payload", () => {
				const original = Outcome.ok({ id: 1, name: "test" });
				const restored = Outcome.fromJSON(original.toJSON());
				expect(restored.isOk).toBe(true);
				expect(restored.value).toEqual({ id: 1, name: "test" });
			});

			test("restore error outcome from toJSON() payload", () => {
				const original = Outcome.err("err", "CODE");
				const restored = Outcome.fromJSON(original.toJSON());
				expect(restored.isErr).toBe(true);
				expect(restored.error?.message).toBe("err");
				expect(restored.error?.code).toBe("CODE");
			});
		});
	});

	describe("Combinators", () => {
		describe("all()", () => {
			test("return success with all values when all succeed", () => {
				const outcomes = [Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)];
				const result = Outcome.all(outcomes);
				expect(result.isOk).toBe(true);
				expect(result.value).toEqual([1, 2, 3]);
			});

			test("return aggregate error when any fails", () => {
				const outcomes = [
					Outcome.ok(1),
					Outcome.err("second failed"),
					Outcome.ok(3),
				];
				const result = Outcome.all(outcomes);
				expect(result.isErr).toBe(true);
				expect(result.error?.isAggregate).toBe(true);
				expect(result.error?.message).toBe("Multiple failed");
				expect(result.error?.errors).toHaveLength(1);
			});

			test("aggregate every error, not just the first", () => {
				const result = Outcome.all([
					Outcome.ok(1),
					Outcome.err("err1"),
					Outcome.err("err2"),
				]);
				expect(result.isErr).toBe(true);
				expect(result.error?.errors).toHaveLength(2);
			});

			test("return ok([]) for empty array", () => {
				const result = Outcome.all([]);
				expect(result.isOk).toBe(true);
				expect(result.value).toEqual([]);
			});

			test("preserve order of values", () => {
				const outcomes = [Outcome.ok("a"), Outcome.ok("b"), Outcome.ok("c")];
				const result = Outcome.all(outcomes);
				expect(result.value).toEqual(["a", "b", "c"]);
			});
		});

		describe("any()", () => {
			test("return first success", () => {
				const outcomes = [
					Outcome.err("first erred"),
					Outcome.ok(42),
					Outcome.ok(100),
				];
				const result = Outcome.any(outcomes);
				expect(result.isOk).toBe(true);
				expect(result.value).toBe(42);
			});

			test("return aggregate error when all err", () => {
				const outcomes = [Outcome.err("error 1"), Outcome.err("error 2")];
				const result = Outcome.any(outcomes);
				expect(result.isErr).toBe(true);
				expect(result.error?.isAggregate).toBe(true);
				expect(result.error?.message).toContain("All failed");
				expect(result.error?.errors).toHaveLength(2);
			});

			test("return error for empty array", () => {
				const result = Outcome.any([]);
				expect(result.isErr).toBe(true);
				expect(result.error?.code).toBe("EMPTY_INPUT");
			});
		});
	});

	describe("Instance Accessors", () => {
		describe("isOk / isErr deprecation (methods in v0.7.0)", () => {
			test("remain accessors, not methods, in v0.6.x", () => {
				const outcome = Outcome.ok(42);
				expect(typeof outcome.isOk).toBe("boolean");
				expect(typeof outcome.isErr).toBe("boolean");
			});

			test("stay mutually exclusive across both states", () => {
				const ok = Outcome.ok(1);
				const err = Outcome.err("failed");
				expect(ok.isOk).toBe(!ok.isErr);
				expect(err.isOk).toBe(!err.isErr);
			});

			test("agree with the toTuple() narrowing path that replaces them", () => {
				for (const outcome of [Outcome.ok(1), Outcome.err("failed")]) {
					const [, err] = outcome.toTuple();
					expect(outcome.isErr).toBe(err !== null);
					expect(outcome.isOk).toBe(err === null);
				}
			});
		});

		describe("isOk / isErr", () => {
			test("report correctly for success", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.isOk).toBe(true);
				expect(outcome.isErr).toBe(false);
			});

			test("report correctly for error", () => {
				const outcome = Outcome.err("failed");
				expect(outcome.isOk).toBe(false);
				expect(outcome.isErr).toBe(true);
			});
		});

		describe("value / error", () => {
			test("provide value and null error for success", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.value).toBe(42);
				expect(outcome.error).toBeNull();
			});

			test("provide null value and error for failure", () => {
				const outcome = Outcome.err("failed");
				expect(outcome.value).toBeNull();
				expect(outcome.error?.message).toBe("failed");
			});
		});
	});

	describe("Transformation", () => {
		describe("map()", () => {
			test("transform success value", () => {
				const outcome = Outcome.ok(5).map((n) => n * 2);
				expect(outcome.value).toBe(10);
			});

			test("chain multiple maps", () => {
				const outcome = Outcome.ok(2)
					.map((n) => n * 3)
					.map((n) => n.toString());
				expect(outcome.value).toBe("6");
			});

			test("pass through errors", () => {
				const outcome = Outcome.err("original").map((n) => (n as number) * 2);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("original");
			});

			test("obey the functor identity law", () => {
				const outcome = Outcome.ok(5).map((n) => n);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(5);
			});

			test("carry a tuple value instead of unwrapping it", () => {
				const payload: [number, null] = [1, null];
				const outcome = Outcome.ok(payload).map((t) => t);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toEqual([1, null]);
			});

			test("carry an Err value as data instead of failing", () => {
				const carried = Err.from("this is data, not a failure", "VALIDATION");
				const outcome = Outcome.ok(carried).map((v) => v);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(carried);
			});

			test("carry a returned Err as the success value", () => {
				const outcome = Outcome.ok(5).map(() => Err.from("not a failure"));
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeInstanceOf(Err);
			});

			test("carry a returned null as the success value", () => {
				const outcome = Outcome.ok(5).map(() => null);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBeNull();
			});

			test("catch callback exceptions", () => {
				const outcome = Outcome.ok(5).map(() => {
					throw new Error("callback threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("callback threw");
			});
		});

		describe("mapAsync()", () => {
			test("transform success value asynchronously", async () => {
				const outcome = await Outcome.ok(5).mapAsync(async (n) => n * 2);
				expect(outcome.value).toBe(10);
			});

			test("pass through errors", async () => {
				const outcome = await Outcome.err("original").mapAsync(
					async (n) => (n as number) * 2,
				);
				expect(outcome.isErr).toBe(true);
			});

			test("catch async exceptions", async () => {
				const outcome = await Outcome.ok(5).mapAsync(async () => {
					throw new Error("async threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("async threw");
			});
		});

		describe("flatMap()", () => {
			test("flatten a success Outcome", () => {
				const outcome = Outcome.ok(5).flatMap((n) => Outcome.ok(n * 2));
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(10);
			});

			test("adopt an error returned by the callback", () => {
				const outcome = Outcome.ok(5).flatMap(() =>
					Outcome.err("flatMap failed", "STEP_FAILED"),
				);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("flatMap failed");
				expect(outcome.error?.code).toBe("STEP_FAILED");
			});

			test("pass through errors without calling the callback", () => {
				let called = false;
				const outcome = Outcome.err("original").flatMap((n) => {
					called = true;
					return Outcome.ok(n);
				});
				expect(called).toBe(false);
				expect(outcome.error?.message).toBe("original");
			});

			test("chain multiple flatMaps", () => {
				const outcome = Outcome.ok(2)
					.flatMap((n) => Outcome.ok(n * 3))
					.flatMap((n) => Outcome.ok(n.toString()));
				expect(outcome.value).toBe("6");
			});

			test("short-circuit the rest of the chain on error", () => {
				const outcome = Outcome.ok(2)
					.flatMap(() => Outcome.err("boom", "BOOM"))
					.flatMap(() => Outcome.ok("unreachable"));
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("BOOM");
			});

			test("not double-wrap the returned Outcome", () => {
				const inner = Outcome.ok(42);
				const outcome = Outcome.ok(1).flatMap(() => inner);
				expect(outcome).toBe(inner);
			});

			test("catch callback exceptions", () => {
				const outcome = Outcome.ok(5).flatMap(() => {
					throw new Error("flatMap threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("flatMap threw");
			});

			test("reject a non-Outcome return", () => {
				const fn = ((n: number) => n * 2) as unknown as (
					n: number,
				) => Outcome<number>;
				const outcome = Outcome.ok(5).flatMap(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_FLATMAP_RETURN");
				expect(outcome.error?.metadata?.received).toBe("number");
			});

			test("reject a bare tuple return", () => {
				const fn = (() => [10, null]) as unknown as () => Outcome<number>;
				const outcome = Outcome.ok(5).flatMap(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_FLATMAP_RETURN");
			});
		});

		describe("flatMapAsync()", () => {
			test("flatten a success Outcome asynchronously", async () => {
				const outcome = await Outcome.ok(5).flatMapAsync(async (n) =>
					Outcome.ok(n * 2),
				);
				expect(outcome.value).toBe(10);
			});

			test("adopt an error returned by the callback", async () => {
				const outcome = await Outcome.ok(5).flatMapAsync(async () =>
					Outcome.err("async flatMap failed"),
				);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("async flatMap failed");
			});

			test("pass through errors", async () => {
				const outcome = await Outcome.err("original").flatMapAsync(async (n) =>
					Outcome.ok(n),
				);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("original");
			});

			test("catch async exceptions", async () => {
				const outcome = await Outcome.ok(5).flatMapAsync(async () => {
					throw new Error("async flatMap threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("async flatMap threw");
			});

			test("reject a non-Outcome return", async () => {
				const fn = (async () => "nope") as unknown as () => Promise<
					Outcome<string>
				>;
				const outcome = await Outcome.ok(5).flatMapAsync(fn);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.code).toBe("INVALID_FLATMAP_RETURN");
			});
		});

		describe("mapErr()", () => {
			test("transform error", () => {
				const outcome = Outcome.err("original").mapErr((err) =>
					err.wrap("wrapped"),
				);
				expect(outcome.error?.message).toBe("wrapped");
			});

			test("recover from error", () => {
				const outcome = Outcome.err("failed").mapErr(() => [42, null]);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			test("pass through success", () => {
				const outcome = Outcome.ok(42).mapErr(() => [0, null]);
				expect(outcome.value).toBe(42);
			});

			test("handle callback returning Err", () => {
				const outcome = Outcome.err("original").mapErr(() =>
					Err.from("new error"),
				);
				expect(outcome.error?.message).toBe("new error");
			});

			test("catch callback exceptions", () => {
				const outcome = Outcome.err("original").mapErr(() => {
					throw new Error("mapErr threw");
				});
				expect(outcome.error?.message).toBe("mapErr threw");
			});
		});

		describe("mapErrAsync()", () => {
			test("transform error asynchronously", async () => {
				const outcome = await Outcome.err("original").mapErrAsync(async (err) =>
					err.wrap("async wrapped"),
				);
				expect(outcome.error?.message).toBe("async wrapped");
			});

			test("recover asynchronously", async () => {
				const outcome = await Outcome.err("failed").mapErrAsync(async () => [
					42,
					null,
				]);
				expect(outcome.isOk).toBe(true);
				expect(outcome.value).toBe(42);
			});

			test("pass through success", async () => {
				const outcome = await Outcome.ok(42).mapErrAsync(async () => [0, null]);
				expect(outcome.value).toBe(42);
			});
		});
	});

	describe("Side Effects", () => {
		describe("effect()", () => {
			test("execute side effect and return same outcome", () => {
				let captured: ResultTuple<number> = [0, null];
				const outcome = Outcome.ok(42).effect((tuple) => {
					captured = tuple;
				});
				expect(captured).toEqual([42, null]);
				expect(outcome.value).toBe(42);
			});

			test("provide error in tuple for error outcomes", () => {
				let captured: ResultTuple<unknown> = [0, null];
				const outcome = Outcome.err("failed").effect((tuple) => {
					captured = tuple;
				});
				expect(captured[0]).toBeNull();
				const err = captured[1] as unknown as Err;
				expect(err?.message).toBe("failed");
				expect(outcome.isErr).toBe(true);
			});

			test("return error outcome if callback throws", () => {
				const outcome = Outcome.ok(42).effect(() => {
					throw new Error("effect threw");
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("effect threw");
			});

			test("be chainable", () => {
				const logs: string[] = [];
				const outcome = Outcome.ok(1)
					.effect(() => logs.push("first"))
					.map((n) => n + 1)
					.effect(() => logs.push("second"));
				expect(logs).toEqual(["first", "second"]);
				expect(outcome.value).toBe(2);
			});
		});

		describe("effectAsync()", () => {
			test("execute async side effect", async () => {
				let captured: ResultTuple<number> = [0, null];
				const outcome = await Outcome.ok(42).effectAsync(async (tuple) => {
					captured = tuple;
				});
				expect(captured).toEqual([42, null]);
				expect(outcome.value).toBe(42);
			});

			test("return error if async callback throws", async () => {
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
			test("return value when ok", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.defaultTo(0)).toBe(42);
			});

			test("return fallback value when err", () => {
				const outcome = Outcome.err("failed") as Outcome<number>;
				expect(outcome.defaultTo(0)).toBe(0);
			});

			test("return computed fallback when err", () => {
				const outcome = Outcome.err("failed", "NOT_FOUND") as Outcome<number>;
				const result = outcome.defaultTo((err: Err) =>
					err.hasCode("NOT_FOUND") ? -1 : 0,
				);
				expect(result).toBe(-1);
			});

			test("pass error to handler", () => {
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

			test("not call handler when ok", () => {
				const outcome = Outcome.ok(42);
				let called = false;
				outcome.defaultTo(() => {
					called = true;
					return 0;
				});
				expect(called).toBe(false);
			});

			test("propagate handler exceptions", () => {
				const outcome = Outcome.err("failed") as Outcome<unknown>;
				expect(() => {
					outcome.defaultTo(() => {
						throw new Error("handler threw");
					});
				}).toThrow("handler threw");
			});

			test("handle null as valid ok value", () => {
				const outcome = Outcome.ok<string | null>(null);
				expect(outcome.defaultTo("fallback")).toBeNull();
			});

			test("handle object fallback", () => {
				const outcome = Outcome.err("failed") as Outcome<{ port: number }>;
				const fallback = { port: 3000 };
				expect(outcome.defaultTo(fallback)).toBe(fallback);
			});

			test("treat function as value when asValue is true", () => {
				const outcome = Outcome.err("failed") as Outcome<() => number>;
				const defaultFn = () => 42;
				const result = outcome.defaultTo(defaultFn, true);
				expect(result).toBe(defaultFn);
				expect(result()).toBe(42);
			});

			test("return function value when ok with asValue true", () => {
				const okFn = () => 100;
				const outcome = Outcome.ok(okFn);
				const defaultFn = () => 42;
				const result = outcome.defaultTo(defaultFn, true);
				expect(result).toBe(okFn);
				expect(result()).toBe(100);
			});

			test("still use handler when asValue is not provided for function type", () => {
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
			test("call onOk for success", () => {
				const outcome = Outcome.ok(42);
				const result = outcome.either(
					(v) => `value: ${v}`,
					(e) => `error: ${e.message}`,
				);
				expect(result).toBe("value: 42");
			});

			test("call onErr for error", () => {
				const outcome = Outcome.err("failed") as Outcome<number>;
				const result = outcome.either(
					(v) => `value: ${v}`,
					(e) => `error: ${e.message}`,
				);
				expect(result).toBe("error: failed");
			});

			test("transform to different type", () => {
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

			test("propagate onOk exceptions", () => {
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

			test("propagate onErr exceptions", () => {
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

			test("handle union return types", () => {
				const outcome = Outcome.ok(42);
				const result: "success" | "error" = outcome.either(
					() => "success",
					() => "error",
				);
				expect(result).toBe("success");
			});

			test("provide typed value to onOk", () => {
				const outcome = Outcome.ok({ id: 1, name: "test" });
				const result = outcome.either(
					(user) => user.name.toUpperCase(),
					() => "UNKNOWN",
				);
				expect(result).toBe("TEST");
			});

			test("provide Err instance to onErr", () => {
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
			test("chain single transformation", () => {
				const result = Outcome.ok(5).pipe(([val, err]) => {
					if (err) return err;
					return [val * 2, null];
				});
				expect(result.value).toBe(10);
			});

			test("chain multiple transformations", () => {
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

			test("pass through errors", () => {
				const result = Outcome.err("initial error").pipe(([val, err]) => {
					if (err) return err;
					return [(val as number) * 2, null];
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("initial error");
			});

			test("allow mid-chain error creation", () => {
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

			test("allow mid-chain recovery", () => {
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

			test("catch exceptions in predicates", () => {
				const result = Outcome.ok(5).pipe(([_val, _err]) => {
					throw new Error("predicate threw");
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("predicate threw");
			});

			test("handle null return (void success)", () => {
				const result = Outcome.ok(5).pipe(([_val, err]) => {
					if (err) return err;
					return null;
				});
				expect(result.isOk).toBe(true);
				expect(result.value).toBeNull();
			});

			test("type-check through transformations", () => {
				// This test verifies type inference works
				const result: Outcome<string> = Outcome.ok(5).pipe(
					([val, err]) => (err ? err : ([val * 2, null] as [number, null])),
					([val, err]) =>
						err ? err : ([val.toString(), null] as [string, null]),
				);
				expect(result.value).toBe("10");
			});

			test("work with complex objects", () => {
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
			test("chain single async transformation", async () => {
				const result = await Outcome.ok(5).pipeAsync(async ([val, err]) => {
					if (err) return err;
					return [val * 2, null];
				});
				expect(result.value).toBe(10);
			});

			test("chain multiple async transformations", async () => {
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

			test("pass through errors", async () => {
				const result = await Outcome.err("initial").pipeAsync(
					async ([val, err]) => {
						if (err) return err;
						return [(val as number) * 2, null];
					},
				);
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("initial");
			});

			test("allow async mid-chain recovery", async () => {
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

			test("catch async exceptions", async () => {
				const result = await Outcome.ok(5).pipeAsync(async () => {
					throw new Error("async threw");
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("async threw");
			});

			test("catch rejected promises", async () => {
				const result = await Outcome.ok(5).pipeAsync(async () => {
					return Promise.reject(new Error("rejected"));
				});
				expect(result.isErr).toBe(true);
				expect(result.error?.message).toBe("rejected");
			});

			test("execute predicates sequentially", async () => {
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
			test("return success tuple", () => {
				const outcome = Outcome.ok(42);
				const tuple = outcome.toTuple();
				expect(tuple).toEqual([42, null]);
			});

			test("return error tuple", () => {
				const outcome = Outcome.err("failed");
				const [value, error] = outcome.toTuple();
				expect(value).toBeNull();
				expect(error?.message).toBe("failed");
			});

			test("allow destructuring", () => {
				const [value, error] = Outcome.ok("hello").toTuple();
				expect(value).toBe("hello");
				expect(error).toBeNull();
			});
		});

		describe("toJSON()", () => {
			test("serialize success outcome", () => {
				const outcome = Outcome.ok({ name: "test" });
				const json = outcome.toJSON();
				expect(json[0]).toEqual({ name: "test" });
				expect(json[1]).toBeNull();
			});

			test("serialize error outcome with Err.toJSON()", () => {
				const outcome = Outcome.err("failed", "ERROR_CODE");
				const json = outcome.toJSON();
				expect(json[0]).toBeNull();
				expect(json[1]?.message).toBe("failed");
				expect(json[1]?.code).toBe("ERROR_CODE");
			});

			test("be JSON.stringify compatible", () => {
				const outcome = Outcome.ok(42);
				const str = JSON.stringify(outcome.toJSON());
				expect(str).toBe("[42,null]");
			});

			test("support round-trip serialization", () => {
				const original = Outcome.ok({ id: 1, name: "test" });
				const json = JSON.stringify(original.toJSON());
				const parsed = JSON.parse(json);
				const restored = Outcome.fromTuple(parsed);
				expect(restored.value).toEqual({ id: 1, name: "test" });
			});
		});

		describe("toString()", () => {
			test("format success outcome", () => {
				const outcome = Outcome.ok(42);
				expect(outcome.toString()).toBe("Outcome.ok(42)");
			});

			test("format error outcome", () => {
				const outcome = Outcome.err("failed", "MY_CODE");
				expect(outcome.toString()).toContain("Outcome.err");
				expect(outcome.toString()).toContain("MY_CODE");
				expect(outcome.toString()).toContain("failed");
			});

			test("handle object values", () => {
				const outcome = Outcome.ok({ a: 1 });
				expect(outcome.toString()).toBe('Outcome.ok({"a":1})');
			});

			test("handle null/undefined values", () => {
				expect(Outcome.ok(null).toString()).toBe("Outcome.ok(null)");
				expect(Outcome.unit().toString()).toBe("Outcome.ok(null)");
			});
		});
	});

	describe("Integration & Edge Cases", () => {
		test("handle complex chaining", () => {
			const result = Outcome.ok(10)
				.map((n) => n * 2)
				.flatMap((n) => (n > 15 ? Outcome.err("Too big") : Outcome.ok(n)))
				.mapErr((_err) => [0, null]) // recover
				.map((n) => n.toString())
				.toTuple();
			expect(result).toEqual(["0", null]);
		});

		test("handle async chaining", async () => {
			const result = await Outcome.ok(5)
				.mapAsync(async (n) => n * 2)
				.then((o) => o.mapAsync(async (n) => n + 1));

			expect(result.value).toBe(11);
		});

		test("work with Promise.all", async () => {
			const outcomes = await Promise.all([
				Outcome.fromAsync(async () => [1, null] as ResultTuple<number>),
				Outcome.fromAsync(async () => [2, null] as ResultTuple<number>),
				Outcome.fromAsync(async () => [3, null] as ResultTuple<number>),
			]);

			const combined = Outcome.all(outcomes);
			expect(combined.value).toEqual([1, 2, 3]);
		});

		test("handle nested outcomes with flatMap", () => {
			const outer = Outcome.ok(Outcome.ok(42));
			const inner = outer.flatMap((o) => o.map((n) => n * 2));
			expect(inner.value).toBe(84);
		});

		test("preserve immutability", () => {
			const original = Outcome.ok(42);
			const mapped = original.map((n) => n * 2);
			expect(original.value).toBe(42);
			expect(mapped.value).toBe(84);
		});
	});
});
