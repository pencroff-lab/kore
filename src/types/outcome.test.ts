import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sinon from "sinon";
import { Err } from "./err";
import {
	type CallbackReturn,
	Outcome,
	type PipeFn,
	type ResultTuple,
	type ValueOf,
} from "./outcome";

// Compile-time equality assertion used by the type-inference tests below.
type Expect<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

describe("Outcome", () => {
	// Must stay first in this file: the legacy-tuple warning fires at most once
	// per process, so any earlier value-protocol callback returning a
	// `[value, error]` shape would consume it. No other test does.
	describe("legacy tuple deprecation warning", () => {
		let sandbox: sinon.SinonSandbox;

		beforeEach(() => {
			sandbox = sinon.createSandbox();
		});

		afterEach(() => {
			sandbox.restore();
		});

		test("not warn for arrays that never were a tuple shape", () => {
			const warn = sandbox.stub(console, "warn");

			Outcome.from(() => [1, 2, 3]);
			Outcome.from(() => ["a", "b"]);

			sinon.assert.notCalled(warn);
		});

		test("warn once when a callback returns the old [value, error] shape", () => {
			const warn = sandbox.stub(console, "warn");

			const first = Outcome.from(() => [1, null]);
			const second = Outcome.from(() => [null, Err.from("boom")]);

			sinon.assert.calledOnce(warn);
			expect(warn.firstCall.args[0]).toContain("Outcome.fromTuple()");
			// The tuple is now the success value, not control flow.
			expect(first.toTuple()[0]).toEqual([1, null]);
			expect(second.toTuple()[1]).toBeNull();
		});

		test("not warn again once the window has been reported", () => {
			const warn = sandbox.stub(console, "warn");

			Outcome.from(() => [2, null]);

			sinon.assert.notCalled(warn);
		});
	});

	describe("Type Exports", () => {
		test("export ResultTuple type", () => {
			const success: ResultTuple<number> = [42, null];
			const failure: ResultTuple<number> = [null, Err.from("error")];
			expect(success[0]).toBe(42);
			expect(success[1]).toBeNull();
			expect(failure[0]).toBeNull();
			expect(failure[1]).toBeInstanceOf(Err);
		});

		test("export CallbackReturn type covering the value protocol", () => {
			const bare: CallbackReturn<number> = 42;
			const errReturn: CallbackReturn<number> = Err.from("error");
			const outcomeReturn: CallbackReturn<number> = Outcome.ok(7);
			expect(bare).toBe(42);
			expect(errReturn).toBeInstanceOf(Err);
			expect(outcomeReturn).toBeInstanceOf(Outcome);
		});

		test("export ValueOf, resolving each protocol arm", () => {
			const plain: ValueOf<number> = 42;
			const unwrapped: ValueOf<Outcome<string>> = "hello";
			const errIsNever: Expect<ValueOf<Err>, never> = true;
			const unionDistributes: Expect<ValueOf<42 | Err>, 42> = true;
			expect(plain).toBe(42);
			expect(unwrapped).toBe("hello");
			expect(errIsNever).toBe(true);
			expect(unionDistributes).toBe(true);
		});
	});

	describe("Static Constructors", () => {
		describe("ok()", () => {
			test("create success outcome with value", () => {
				const [value, error] = Outcome.ok(42).toTuple();
				expect(value).toBe(42);
				expect(error).toBeNull();
			});

			test("create void success outcome with no argument", () => {
				const outcome: Outcome<void> = Outcome.ok();
				const [value, error] = outcome.toTuple();
				expect(value).toBeUndefined();
				expect(error).toBeNull();
				expect(outcome.toString()).toBe("Outcome.ok(undefined)");
			});

			test("carry null only when null is passed explicitly", () => {
				const outcome: Outcome<null> = Outcome.ok(null);
				expect(outcome.toTuple()[0]).toBeNull();
				expect(outcome.toString()).toBe("Outcome.ok(null)");
			});

			test("agree with an explicit undefined argument", () => {
				expect(Outcome.ok().toTuple()[0]).toBeUndefined();
				expect(Outcome.ok(undefined).toTuple()[0]).toBeUndefined();
			});

			test("handle object values", () => {
				const obj = { name: "test" };
				expect(Outcome.ok(obj).toTuple()[0]).toBe(obj);
			});

			test("carry an Err as a success value", () => {
				const carried = Err.from("data, not a failure");
				const [value, error] = Outcome.ok(carried).toTuple();
				expect(value).toBe(carried);
				expect(error).toBeNull();
			});
		});

		describe("err()", () => {
			test("create error outcome from Err instance", () => {
				const err = Err.from("test error");
				const [value, error] = Outcome.err(err).toTuple();
				expect(value).toBeNull();
				expect(error).toBe(err);
			});

			test("create error outcome from message", () => {
				const [, error] = Outcome.err("test error").toTuple();
				expect(error?.message).toBe("test error");
			});

			test("create error outcome from message and code", () => {
				const [, error] = Outcome.err("not found", "NOT_FOUND").toTuple();
				expect(error?.message).toBe("not found");
				expect(error?.code).toBe("NOT_FOUND");
			});

			test("create error outcome from message and options", () => {
				const [, error] = Outcome.err("timeout", {
					code: "TIMEOUT",
					metadata: { ms: 5000 },
				}).toTuple();
				expect(error?.code).toBe("TIMEOUT");
				expect(error?.metadata).toEqual({ ms: 5000 });
			});

			test("create error outcome wrapping Error", () => {
				const nativeErr = new Error("native error");
				const [, error] = Outcome.err("wrapped", nativeErr).toTuple();
				expect(error?.message).toBe("wrapped");
				expect(error?.unwrap()?.message).toBe("native error");
			});

			test("create error outcome wrapping Error with custom code", () => {
				const inner = new Error("inner");
				const [, error] = Outcome.err("context", inner, {
					code: "CUSTOM_CODE",
				}).toTuple();
				expect(error?.message).toBe("context");
				expect(error?.code).toBe("CUSTOM_CODE");
				expect(error?.unwrap()?.message).toBe("inner");
			});

			test("create error outcome wrapping Err", () => {
				const cause = Err.from("cause");
				const [, error] = Outcome.err("wrapper", cause, {
					code: "WRAPPED",
				}).toTuple();
				expect(error?.message).toBe("wrapper");
				expect(error?.code).toBe("WRAPPED");
				expect(error?.unwrap()).toBe(cause);
			});

			test("be assignable to any Outcome<T> due to never type", () => {
				const errOutcome = Outcome.err("error");
				const stringOutcome: Outcome<string> = errOutcome;
				const numberOutcome: Outcome<number> = errOutcome;
				expect(stringOutcome.toTuple()[1]).not.toBeNull();
				expect(numberOutcome.toTuple()[1]).not.toBeNull();
			});

			test("claim a success type so terminal operations chain", () => {
				expect(Outcome.err<number>("msg").defaultTo(0)).toBe(0);
				expect(Outcome.err<number>("msg", "CODE").defaultTo(1)).toBe(1);
			});

			test("default the claimed type to never", () => {
				const inferred: Expect<
					ReturnType<typeof Outcome.err<never>>,
					Outcome<never>
				> = true;
				expect(inferred).toBe(true);
			});
		});

		describe("from()", () => {
			test("carry a bare value as the success value", () => {
				const [value, error] = Outcome.from(() => 42).toTuple();
				expect(value).toBe(42);
				expect(error).toBeNull();
			});

			test("handle direct Err return as a failure", () => {
				const [, error] = Outcome.from(() =>
					Err.from("direct error"),
				).toTuple();
				expect(error?.message).toBe("direct error");
			});

			test("pass a returned Outcome through by reference", () => {
				const inner = Outcome.ok(9);
				expect(Outcome.from(() => inner)).toBe(inner);
			});

			test("adopt the error of a returned failing Outcome", () => {
				const [, error] = Outcome.from(() =>
					Outcome.err("inner failure", "INNER"),
				).toTuple();
				expect(error?.code).toBe("INNER");
			});

			test("carry null as the success value", () => {
				const [value, error] = Outcome.from(() => null).toTuple();
				expect(value).toBeNull();
				expect(error).toBeNull();
			});

			test("carry a bare string without destructuring it per char", () => {
				const [value] = Outcome.from(() => "hello").toTuple();
				expect(value).toBe("hello");
			});

			test("carry arbitrary arrays as values", () => {
				const [value] = Outcome.from(() => [1, 2, 3]).toTuple();
				expect(value).toEqual([1, 2, 3]);
			});

			test("carry an array of Err values without collapsing it", () => {
				const e1 = Err.from("e1");
				const e2 = Err.from("e2");
				const [value, error] = Outcome.from(() => [e1, e2]).toTuple();
				expect(value).toEqual([e1, e2]);
				expect(error).toBeNull();
			});

			test("carry undefined as the success value", () => {
				const [value, error] = Outcome.from(() => undefined).toTuple();
				expect(value).toBeUndefined();
				expect(error).toBeNull();
			});

			test("catch thrown exceptions", () => {
				const [, error] = Outcome.from(() => {
					throw new Error("thrown");
				}).toTuple();
				expect(error?.message).toBe("thrown");
			});

			test("catch thrown non-Error values", () => {
				const [, error] = Outcome.from(() => {
					throw "string error";
				}).toTuple();
				expect(error).not.toBeNull();
			});

			test("infer the resolved value type", () => {
				const bare: Expect<
					ReturnType<typeof Outcome.from<number>>,
					Outcome<number>
				> = true;
				const failure: Expect<
					ReturnType<typeof Outcome.from<Err>>,
					Outcome<never>
				> = true;
				const nested: Expect<
					ReturnType<typeof Outcome.from<Outcome<string>>>,
					Outcome<string>
				> = true;
				expect([bare, failure, nested]).toEqual([true, true, true]);
			});
		});

		describe("fromAsync()", () => {
			test("carry a bare async value", async () => {
				const [value, error] = (
					await Outcome.fromAsync(async () => 42)
				).toTuple();
				expect(value).toBe(42);
				expect(error).toBeNull();
			});

			test("handle async direct Err", async () => {
				const [, error] = (
					await Outcome.fromAsync(async () => Err.from("direct"))
				).toTuple();
				expect(error?.message).toBe("direct");
			});

			test("pass a returned Outcome through", async () => {
				const inner = Outcome.ok("done");
				expect(await Outcome.fromAsync(async () => inner)).toBe(inner);
			});

			test("carry a bare async string", async () => {
				const [value] = (
					await Outcome.fromAsync(async () => "hello")
				).toTuple();
				expect(value).toBe("hello");
			});

			test("catch rejected promises", async () => {
				const [, error] = (
					await Outcome.fromAsync(async () => {
						throw new Error("rejected");
					})
				).toTuple();
				expect(error?.message).toBe("rejected");
			});
		});

		describe("fromTuple()", () => {
			test("create outcome from success tuple", () => {
				const tuple: ResultTuple<number> = [42, null];
				const [value, error] = Outcome.fromTuple(tuple).toTuple();
				expect(value).toBe(42);
				expect(error).toBeNull();
			});

			test("create outcome from error tuple", () => {
				const tuple: ResultTuple<number> = [null, Err.from("error")];
				const [, error] = Outcome.fromTuple(tuple).toTuple();
				expect(error?.message).toBe("error");
			});

			test("accept a callback returning a tuple", () => {
				const [value] = Outcome.fromTuple(() => [42, null]).toTuple();
				expect(value).toBe(42);
			});

			test("accept a multi-branch callback", () => {
				const load = (id: string) =>
					Outcome.fromTuple(() => {
						if (id !== "1") return [null, Err.from("missing", "NOT_FOUND")];
						return [{ id }, null];
					});

				expect(load("1").toTuple()[0]).toEqual({ id: "1" });
				expect(load("2").toTuple()[1]?.code).toBe("NOT_FOUND");
			});

			test("catch throws from the callback form", () => {
				const [, error] = Outcome.fromTuple<number>(() => {
					throw new Error("tuple callback threw");
				}).toTuple();
				expect(error?.message).toBe("tuple callback threw");
			});

			test("treat a function in the value slot as a value", () => {
				const fn = () => 1;
				const [value] = Outcome.fromTuple([fn, null] as ResultTuple<
					() => number
				>).toTuple();
				expect(value).toBe(fn);
			});
		});

		describe("fromTupleAsync()", () => {
			test("accept an async callback returning a tuple", async () => {
				const [value] = (
					await Outcome.fromTupleAsync(async () => [42, null])
				).toTuple();
				expect(value).toBe(42);
			});

			test("accept a promise of a tuple", async () => {
				const promise = Promise.resolve([7, null] as ResultTuple<number>);
				const [value] = (await Outcome.fromTupleAsync(promise)).toTuple();
				expect(value).toBe(7);
			});

			test("carry an error tuple", async () => {
				const [, error] = (
					await Outcome.fromTupleAsync<number>(async () => [
						null,
						Err.from("async tuple error"),
					])
				).toTuple();
				expect(error?.message).toBe("async tuple error");
			});

			test("catch rejections", async () => {
				const [, error] = (
					await Outcome.fromTupleAsync<number>(async () => {
						throw new Error("async tuple threw");
					})
				).toTuple();
				expect(error?.message).toBe("async tuple threw");
			});
		});

		describe("fromJSON()", () => {
			test("restore success outcome from toJSON() payload", () => {
				const original = Outcome.ok({ id: 1, name: "test" });
				const [value] = Outcome.fromJSON(original.toJSON()).toTuple();
				expect(value).toEqual({ id: 1, name: "test" });
			});

			test("restore error outcome from toJSON() payload", () => {
				const original = Outcome.err("err", "CODE");
				const [, error] = Outcome.fromJSON(original.toJSON()).toTuple();
				expect(error?.message).toBe("err");
				expect(error?.code).toBe("CODE");
			});

			test("return an error outcome for an invalid payload", () => {
				const [, error] = Outcome.fromJSON(
					{} as unknown as [unknown, null],
				).toTuple();
				expect(error?.message).toBe("Invalid Outcome JSON");
			});
		});
	});

	describe("Combinators", () => {
		describe("all()", () => {
			test("return success with all values when all succeed", () => {
				const result = Outcome.all([
					Outcome.ok(1),
					Outcome.ok(2),
					Outcome.ok(3),
				]);
				expect(result.toTuple()[0]).toEqual([1, 2, 3]);
			});

			test("return aggregate error when any fails", () => {
				const [, error] = Outcome.all([
					Outcome.ok(1),
					Outcome.err<number>("second failed"),
					Outcome.ok(3),
				]).toTuple();
				expect(error?.isAggregate).toBe(true);
				expect(error?.message).toBe("Multiple failed");
				expect(error?.errors).toHaveLength(1);
			});

			test("aggregate every error, not just the first", () => {
				const [, error] = Outcome.all([
					Outcome.ok(1),
					Outcome.err<number>("err1"),
					Outcome.err<number>("err2"),
				]).toTuple();
				expect(error?.errors).toHaveLength(2);
			});

			test("return ok([]) for empty array", () => {
				const [value, error] = Outcome.all([]).toTuple();
				expect(value).toEqual([]);
				expect(error).toBeNull();
			});

			test("preserve order of values", () => {
				const result = Outcome.all([
					Outcome.ok("a"),
					Outcome.ok("b"),
					Outcome.ok("c"),
				]);
				expect(result.toTuple()[0]).toEqual(["a", "b", "c"]);
			});
		});

		describe("any()", () => {
			test("return first success", () => {
				const result = Outcome.any([
					Outcome.err<number>("first erred"),
					Outcome.ok(42),
					Outcome.ok(100),
				]);
				expect(result.toTuple()[0]).toBe(42);
			});

			test("return aggregate error when all err", () => {
				const [, error] = Outcome.any([
					Outcome.err<number>("error 1"),
					Outcome.err<number>("error 2"),
				]).toTuple();
				expect(error?.isAggregate).toBe(true);
				expect(error?.message).toContain("All failed");
				expect(error?.errors).toHaveLength(2);
			});

			test("return error for empty array", () => {
				const [, error] = Outcome.any([]).toTuple();
				expect(error?.code).toBe("EMPTY_INPUT");
			});
		});
	});

	describe("Extraction", () => {
		test("narrow both branches through toTuple()", () => {
			const read = (outcome: Outcome<number>): number | string => {
				const [value, error] = outcome.toTuple();
				if (error !== null) return error.message;
				return value;
			};

			expect(read(Outcome.ok(42))).toBe(42);
			expect(read(Outcome.err<number>("failed"))).toBe("failed");
		});

		test("filter a collection down to success values", () => {
			const list: Outcome<number>[] = [
				Outcome.ok(1),
				Outcome.err<number>("nope"),
				Outcome.ok(3),
			];
			const values: number[] = list
				.map((o) => o.toTuple())
				.filter((t) => t[1] === null)
				.map((t) => t[0]);
			expect(values).toEqual([1, 3]);
		});
	});

	describe("Transformation", () => {
		describe("map()", () => {
			test("transform success value", () => {
				expect(
					Outcome.ok(5)
						.map((n) => n * 2)
						.toTuple()[0],
				).toBe(10);
			});

			test("chain multiple maps", () => {
				const [value] = Outcome.ok(2)
					.map((n) => n * 3)
					.map((n) => n.toString())
					.toTuple();
				expect(value).toBe("6");
			});

			test("pass through errors", () => {
				const [, error] = Outcome.err<number>("original")
					.map((n) => n * 2)
					.toTuple();
				expect(error?.message).toBe("original");
			});

			test("obey the functor identity law", () => {
				const [value, error] = Outcome.ok(5)
					.map((n) => n)
					.toTuple();
				expect(value).toBe(5);
				expect(error).toBeNull();
			});

			test("carry a tuple value instead of unwrapping it", () => {
				const payload: [number, null] = [1, null];
				const [value, error] = Outcome.ok(payload)
					.map((t) => t)
					.toTuple();
				expect(value).toEqual([1, null]);
				expect(error).toBeNull();
			});

			test("carry a returned Err as the success value", () => {
				const [value, error] = Outcome.ok(5)
					.map(() => Err.from("not a failure"))
					.toTuple();
				expect(value).toBeInstanceOf(Err);
				expect(error).toBeNull();
			});

			test("carry a returned null as the success value", () => {
				const [value, error] = Outcome.ok(5)
					.map(() => null)
					.toTuple();
				expect(value).toBeNull();
				expect(error).toBeNull();
			});

			test("carry a returned Outcome without flattening it", () => {
				const inner = Outcome.ok(1);
				const [value, error] = Outcome.ok(5)
					.map(() => inner)
					.toTuple();
				expect(value).toBe(inner);
				expect(error).toBeNull();
			});

			test("catch callback exceptions", () => {
				const [, error] = Outcome.ok(5)
					.map(() => {
						throw new Error("callback threw");
					})
					.toTuple();
				expect(error?.message).toBe("callback threw");
			});
		});

		describe("mapAsync()", () => {
			test("transform success value asynchronously", async () => {
				const outcome = await Outcome.ok(5).mapAsync(async (n) => n * 2);
				expect(outcome.toTuple()[0]).toBe(10);
			});

			test("pass through errors", async () => {
				const outcome = await Outcome.err<number>("original").mapAsync(
					async (n) => n * 2,
				);
				expect(outcome.toTuple()[1]?.message).toBe("original");
			});

			test("catch async exceptions", async () => {
				const outcome = await Outcome.ok(5).mapAsync(async () => {
					throw new Error("async threw");
				});
				expect(outcome.toTuple()[1]?.message).toBe("async threw");
			});
		});

		describe("flatMap()", () => {
			test("flatten a success Outcome", () => {
				const [value] = Outcome.ok(5)
					.flatMap((n) => Outcome.ok(n * 2))
					.toTuple();
				expect(value).toBe(10);
			});

			test("adopt an error returned by the callback", () => {
				const [, error] = Outcome.ok(5)
					.flatMap(() => Outcome.err("flatMap failed", "STEP_FAILED"))
					.toTuple();
				expect(error?.message).toBe("flatMap failed");
				expect(error?.code).toBe("STEP_FAILED");
			});

			test("treat a bare Err return as a failure", () => {
				const [, error] = Outcome.ok(5)
					.flatMap(() => Err.from("bare failure", "BARE"))
					.toTuple();
				expect(error?.code).toBe("BARE");
			});

			test("carry a bare value return as a success", () => {
				const [value, error] = Outcome.ok(5)
					.flatMap((n) => n * 2)
					.toTuple();
				expect(value).toBe(10);
				expect(error).toBeNull();
			});

			test("pass through errors without calling the callback", () => {
				let called = false;
				const [, error] = Outcome.err<number>("original")
					.flatMap((n) => {
						called = true;
						return Outcome.ok(n);
					})
					.toTuple();
				expect(called).toBe(false);
				expect(error?.message).toBe("original");
			});

			test("chain multiple flatMaps", () => {
				const [value] = Outcome.ok(2)
					.flatMap((n) => Outcome.ok(n * 3))
					.flatMap((n) => Outcome.ok(n.toString()))
					.toTuple();
				expect(value).toBe("6");
			});

			test("short-circuit the rest of the chain on error", () => {
				const [, error] = Outcome.ok(2)
					.flatMap(() => Outcome.err<number>("boom", "BOOM"))
					.flatMap(() => Outcome.ok("unreachable"))
					.toTuple();
				expect(error?.code).toBe("BOOM");
			});

			test("not double-wrap the returned Outcome", () => {
				const inner = Outcome.ok(42);
				expect(Outcome.ok(1).flatMap(() => inner)).toBe(inner);
			});

			test("catch callback exceptions", () => {
				const [, error] = Outcome.ok(5)
					.flatMap(() => {
						throw new Error("flatMap threw");
					})
					.toTuple();
				expect(error?.message).toBe("flatMap threw");
			});
		});

		describe("flatMapAsync()", () => {
			test("flatten a success Outcome asynchronously", async () => {
				const outcome = await Outcome.ok(5).flatMapAsync(async (n) =>
					Outcome.ok(n * 2),
				);
				expect(outcome.toTuple()[0]).toBe(10);
			});

			test("adopt an error returned by the callback", async () => {
				const outcome = await Outcome.ok(5).flatMapAsync(async () =>
					Outcome.err("async flatMap failed"),
				);
				expect(outcome.toTuple()[1]?.message).toBe("async flatMap failed");
			});

			test("treat a bare Err return as a failure", async () => {
				const outcome = await Outcome.ok(5).flatMapAsync(async () =>
					Err.from("async bare failure"),
				);
				expect(outcome.toTuple()[1]?.message).toBe("async bare failure");
			});

			test("pass through errors", async () => {
				const outcome = await Outcome.err<number>("original").flatMapAsync(
					async (n) => Outcome.ok(n),
				);
				expect(outcome.toTuple()[1]?.message).toBe("original");
			});

			test("catch async exceptions", async () => {
				const outcome = await Outcome.ok(5).flatMapAsync(async () => {
					throw new Error("async flatMap threw");
				});
				expect(outcome.toTuple()[1]?.message).toBe("async flatMap threw");
			});
		});

		describe("mapErr()", () => {
			test("transform error", () => {
				const [, error] = Outcome.err("original")
					.mapErr((err) => err.wrap("wrapped"))
					.toTuple();
				expect(error?.message).toBe("wrapped");
			});

			test("recover with a bare value", () => {
				const [value, error] = Outcome.err("failed")
					.mapErr(() => 42)
					.toTuple();
				expect(value).toBe(42);
				expect(error).toBeNull();
			});

			test("recover with a returned Outcome", () => {
				const [value, error] = Outcome.err("failed")
					.mapErr(() => Outcome.ok(5))
					.toTuple();
				expect(value).toBe(5);
				expect(error).toBeNull();
			});

			test("re-fail with a returned failing Outcome", () => {
				const [, error] = Outcome.err("failed")
					.mapErr(() => Outcome.err("replacement", "REPLACED"))
					.toTuple();
				expect(error?.code).toBe("REPLACED");
			});

			test("recover with an Err carried as a value via Outcome.ok", () => {
				const carried = Err.from("payload");
				const [value, error] = Outcome.err("failed")
					.mapErr(() => Outcome.ok(carried))
					.toTuple();
				expect(value).toBe(carried);
				expect(error).toBeNull();
			});

			test("pass through success", () => {
				const [value] = Outcome.ok(42)
					.mapErr(() => 0)
					.toTuple();
				expect(value).toBe(42);
			});

			test("handle callback returning Err", () => {
				const [, error] = Outcome.err("original")
					.mapErr(() => Err.from("new error"))
					.toTuple();
				expect(error?.message).toBe("new error");
			});

			test("catch callback exceptions", () => {
				const [, error] = Outcome.err("original")
					.mapErr(() => {
						throw new Error("mapErr threw");
					})
					.toTuple();
				expect(error?.message).toBe("mapErr threw");
			});
		});

		describe("mapErrAsync()", () => {
			test("transform error asynchronously", async () => {
				const outcome = await Outcome.err("original").mapErrAsync(async (err) =>
					err.wrap("async wrapped"),
				);
				expect(outcome.toTuple()[1]?.message).toBe("async wrapped");
			});

			test("recover asynchronously with a bare value", async () => {
				const outcome = await Outcome.err("failed").mapErrAsync(async () => 42);
				const [value, error] = outcome.toTuple();
				expect(value).toBe(42);
				expect(error).toBeNull();
			});

			test("pass through success", async () => {
				const outcome = await Outcome.ok(42).mapErrAsync(async () => 0);
				expect(outcome.toTuple()[0]).toBe(42);
			});

			test("catch async exceptions", async () => {
				const outcome = await Outcome.err("original").mapErrAsync(async () => {
					throw new Error("async mapErr threw");
				});
				expect(outcome.toTuple()[1]?.message).toBe("async mapErr threw");
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
				expect(outcome.toTuple()[0]).toBe(42);
			});

			test("provide error in tuple for error outcomes", () => {
				let captured: ResultTuple<unknown> = [0, null];
				const outcome = Outcome.err("failed").effect((tuple) => {
					captured = tuple;
				});
				const [capturedValue, capturedErr] = captured as ResultTuple<unknown>;
				expect(capturedValue).toBeNull();
				expect(capturedErr?.message).toBe("failed");
				expect(outcome.toTuple()[1]).not.toBeNull();
			});

			test("return error outcome if callback throws", () => {
				const [, error] = Outcome.ok(42)
					.effect(() => {
						throw new Error("effect threw");
					})
					.toTuple();
				expect(error?.message).toBe("effect threw");
			});

			test("be chainable", () => {
				const logs: string[] = [];
				const [value] = Outcome.ok(1)
					.effect(() => logs.push("first"))
					.map((n) => n + 1)
					.effect(() => logs.push("second"))
					.toTuple();
				expect(logs).toEqual(["first", "second"]);
				expect(value).toBe(2);
			});
		});

		describe("effectAsync()", () => {
			test("execute async side effect", async () => {
				let captured: ResultTuple<number> = [0, null];
				const outcome = await Outcome.ok(42).effectAsync(async (tuple) => {
					captured = tuple;
				});
				expect(captured).toEqual([42, null]);
				expect(outcome.toTuple()[0]).toBe(42);
			});

			test("return error if async callback throws", async () => {
				const outcome = await Outcome.ok(42).effectAsync(async () => {
					throw new Error("async effect threw");
				});
				expect(outcome.toTuple()[1]?.message).toBe("async effect threw");
			});
		});
	});

	describe("Terminal Operations", () => {
		describe("defaultTo()", () => {
			test("return value when ok", () => {
				expect(Outcome.ok(42).defaultTo(0)).toBe(42);
			});

			test("return fallback value when err", () => {
				expect(Outcome.err<number>("failed").defaultTo(0)).toBe(0);
			});

			test("return computed fallback when err", () => {
				const result = Outcome.err<number>("failed", "NOT_FOUND").defaultTo(
					(err: Err) => (err.hasCode("NOT_FOUND") ? -1 : 0),
				);
				expect(result).toBe(-1);
			});

			test("pass error to handler", () => {
				let capturedErr: Err | null = null;
				Outcome.err<number>("test message", "TEST_CODE").defaultTo(
					(err: Err) => {
						capturedErr = err;
						return 0;
					},
				);
				const seen = capturedErr as Err | null;
				expect(seen?.message).toBe("test message");
				expect(seen?.code).toBe("TEST_CODE");
			});

			test("not call handler when ok", () => {
				let called = false;
				Outcome.ok(42).defaultTo(() => {
					called = true;
					return 0;
				});
				expect(called).toBe(false);
			});

			test("propagate handler exceptions", () => {
				const outcome = Outcome.err<unknown>("failed");
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
				const fallback = { port: 3000 };
				expect(
					Outcome.err<{ port: number }>("failed").defaultTo(fallback),
				).toBe(fallback);
			});

			test("treat function as value when asValue is true", () => {
				const defaultFn = () => 42;
				const result = Outcome.err<() => number>("failed").defaultTo(
					defaultFn,
					true,
				);
				expect(result).toBe(defaultFn);
				expect(result()).toBe(42);
			});

			test("return function value when ok with asValue true", () => {
				const okFn = () => 100;
				const result = Outcome.ok(okFn).defaultTo(() => 42, true);
				expect(result).toBe(okFn);
				expect(result()).toBe(100);
			});

			test("still use handler when asValue is not provided for function type", () => {
				const result = Outcome.err<() => number>(
					"failed",
					"NOT_FOUND",
				).defaultTo((err: Err) => {
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
				const result = Outcome.ok(42).either(
					(v) => `value: ${v}`,
					(e) => `error: ${e.message}`,
				);
				expect(result).toBe("value: 42");
			});

			test("call onErr for error", () => {
				const result = Outcome.err<number>("failed").either(
					(v) => `value: ${v}`,
					(e) => `error: ${e.message}`,
				);
				expect(result).toBe("error: failed");
			});

			test("transform to different type", () => {
				type Response = { status: number; body: { name: string } | null };
				const onOk = (user: { name: string }): Response => ({
					status: 200,
					body: user,
				});
				const onErr = (): Response => ({ status: 404, body: null });

				expect(Outcome.ok({ name: "John" }).either(onOk, onErr)).toEqual({
					status: 200,
					body: { name: "John" },
				});
				expect(
					Outcome.err<{ name: string }>("not found", "NOT_FOUND").either(
						onOk,
						onErr,
					),
				).toEqual({ status: 404, body: null });
			});

			test("propagate onOk exceptions", () => {
				expect(() => {
					Outcome.ok(42).either(
						() => {
							throw new Error("onOk threw");
						},
						() => "fallback",
					);
				}).toThrow("onOk threw");
			});

			test("propagate onErr exceptions", () => {
				expect(() => {
					Outcome.err("failed").either(
						() => "success",
						() => {
							throw new Error("onErr threw");
						},
					);
				}).toThrow("onErr threw");
			});

			test("handle union return types", () => {
				const result: "success" | "error" = Outcome.ok(42).either(
					() => "success",
					() => "error",
				);
				expect(result).toBe("success");
			});

			test("provide typed value to onOk", () => {
				const result = Outcome.ok({ id: 1, name: "test" }).either(
					(user) => user.name.toUpperCase(),
					() => "UNKNOWN",
				);
				expect(result).toBe("TEST");
			});

			test("provide Err instance to onErr", () => {
				const result = Outcome.err("failed", {
					code: "TEST",
					metadata: { x: 1 },
				}).either(
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
				const [value] = Outcome.ok(5)
					.pipe(([val, err]) => (err ? err : val * 2))
					.toTuple();
				expect(value).toBe(10);
			});

			test("chain multiple transformations", () => {
				const [value] = Outcome.ok(2)
					.pipe(
						([val, err]) => (err ? err : val * 3),
						([val, err]) => (err ? err : val + 1),
						([val, err]) => (err ? err : val.toString()),
					)
					.toTuple();
				expect(value).toBe("7");
			});

			test("pass through errors", () => {
				const [, error] = Outcome.err<number>("initial error")
					.pipe(([val, err]) => (err ? err : val * 2))
					.toTuple();
				expect(error?.message).toBe("initial error");
			});

			test("allow mid-chain error creation", () => {
				const [, error] = Outcome.ok(10)
					.pipe(
						([val, err]) => {
							if (err) return err;
							if (val > 5) return Err.from("Too big", "VALIDATION");
							return val;
						},
						([val, err]) => (err ? err : val * 2),
					)
					.toTuple();
				expect(error?.code).toBe("VALIDATION");
			});

			test("allow mid-chain recovery", () => {
				const [value, error] = Outcome.ok(10)
					.pipe(
						([val, err]) => {
							if (err) return err;
							if (val > 5) return Err.from("Too big", "VALIDATION");
							return val;
						},
						([val, err]) => {
							if (err?.hasCode("VALIDATION")) return 0; // recover
							if (err) return err;
							return val;
						},
						([val, err]) => (err ? err : val + 1),
					)
					.toTuple();
				expect(error).toBeNull();
				expect(value).toBe(1);
			});

			test("accept an Outcome returned mid-chain", () => {
				const [value] = Outcome.ok(5)
					.pipe(([val, err]) => (err ? err : Outcome.ok(val * 3)))
					.toTuple();
				expect(value).toBe(15);
			});

			test("catch exceptions in predicates", () => {
				const [, error] = Outcome.ok(5)
					.pipe(() => {
						throw new Error("predicate threw");
					})
					.toTuple();
				expect(error?.message).toBe("predicate threw");
			});

			test("carry a returned null as the value", () => {
				const [value, error] = Outcome.ok(5)
					.pipe(([, err]) => (err ? err : null))
					.toTuple();
				expect(value).toBeNull();
				expect(error).toBeNull();
			});

			test("type-check through transformations", () => {
				const result: Outcome<string> = Outcome.ok(5).pipe(
					([val, err]) => (err ? err : val * 2),
					([val, err]) => (err ? err : val.toString()),
				);
				expect(result.toTuple()[0]).toBe("10");
			});

			test("work with complex objects", () => {
				interface User {
					id: number;
					name: string;
				}

				const [value] = Outcome.ok<User>({ id: 1, name: "John" })
					.pipe(([user, err]) => (err ? err : { ...user, role: "admin" }))
					.toTuple();
				expect(value).toEqual({ id: 1, name: "John", role: "admin" });
			});

			test("accept a typed PipeFn built outside the chain", () => {
				const double: PipeFn<number, number> = ([val, err]) =>
					err ? err : val * 2;
				expect(Outcome.ok(4).pipe(double).toTuple()[0]).toBe(8);
			});
		});

		describe("pipeAsync()", () => {
			test("chain single async transformation", async () => {
				const result = await Outcome.ok(5).pipeAsync(async ([val, err]) =>
					err ? err : val * 2,
				);
				expect(result.toTuple()[0]).toBe(10);
			});

			test("chain multiple async transformations", async () => {
				const result = await Outcome.ok(2).pipeAsync(
					async ([val, err]) => {
						if (err) return err;
						await Promise.resolve();
						return val * 3;
					},
					async ([val, err]) => (err ? err : val + 1),
				);
				expect(result.toTuple()[0]).toBe(7);
			});

			test("pass through errors", async () => {
				const result = await Outcome.err<number>("initial").pipeAsync(
					async ([val, err]) => (err ? err : val * 2),
				);
				expect(result.toTuple()[1]?.message).toBe("initial");
			});

			test("allow async mid-chain recovery", async () => {
				const result = await Outcome.ok(10).pipeAsync(
					async ([val, err]) => {
						if (err) return err;
						if (val > 5) return Err.from("Too big", "VALIDATION");
						return val;
					},
					async ([val, err]) => {
						if (err?.hasCode("VALIDATION")) {
							await Promise.resolve();
							return 0;
						}
						if (err) return err;
						return val;
					},
				);
				const [value, error] = result.toTuple();
				expect(error).toBeNull();
				expect(value).toBe(0);
			});

			test("catch async exceptions", async () => {
				const result = await Outcome.ok(5).pipeAsync(async () => {
					throw new Error("async threw");
				});
				expect(result.toTuple()[1]?.message).toBe("async threw");
			});

			test("catch rejected promises", async () => {
				const result = await Outcome.ok(5).pipeAsync(async () =>
					Promise.reject(new Error("rejected")),
				);
				expect(result.toTuple()[1]?.message).toBe("rejected");
			});

			test("execute predicates sequentially", async () => {
				const order: number[] = [];
				await Outcome.ok(1).pipeAsync(
					async ([val, _err]) => {
						order.push(1);
						await new Promise((r) => setTimeout(r, 10));
						order.push(2);
						return val;
					},
					async ([val, _err]) => {
						order.push(3);
						return val;
					},
				);
				expect(order).toEqual([1, 2, 3]);
			});
		});
	});

	describe("Conversion", () => {
		describe("toTuple()", () => {
			test("return success tuple", () => {
				expect(Outcome.ok(42).toTuple()).toEqual([42, null]);
			});

			test("return error tuple", () => {
				const [value, error] = Outcome.err("failed").toTuple();
				expect(value).toBeNull();
				expect(error?.message).toBe("failed");
			});

			test("allow destructuring", () => {
				const [value, error] = Outcome.ok("hello").toTuple();
				expect(value).toBe("hello");
				expect(error).toBeNull();
			});

			test("return a copy, not the internal tuple", () => {
				const outcome = Outcome.ok(1);
				expect(outcome.toTuple()).not.toBe(outcome.toTuple());
			});
		});

		describe("toJSON()", () => {
			test("serialize success outcome", () => {
				const json = Outcome.ok({ name: "test" }).toJSON();
				expect(json[0]).toEqual({ name: "test" });
				expect(json[1]).toBeNull();
			});

			test("serialize error outcome with Err.toJSON()", () => {
				const json = Outcome.err("failed", "ERROR_CODE").toJSON();
				expect(json[0]).toBeNull();
				expect(json[1]?.message).toBe("failed");
				expect(json[1]?.code).toBe("ERROR_CODE");
			});

			test("be JSON.stringify compatible", () => {
				expect(JSON.stringify(Outcome.ok(42).toJSON())).toBe("[42,null]");
			});

			test("support round-trip serialization", () => {
				const json = JSON.stringify(
					Outcome.ok({ id: 1, name: "test" }).toJSON(),
				);
				const restored = Outcome.fromTuple(JSON.parse(json));
				expect(restored.toTuple()[0]).toEqual({ id: 1, name: "test" });
			});
		});

		describe("toString()", () => {
			test("format success outcome", () => {
				expect(Outcome.ok(42).toString()).toBe("Outcome.ok(42)");
			});

			test("format error outcome", () => {
				const str = Outcome.err("failed", "MY_CODE").toString();
				expect(str).toContain("Outcome.err");
				expect(str).toContain("MY_CODE");
				expect(str).toContain("failed");
			});

			test("handle object values", () => {
				expect(Outcome.ok({ a: 1 }).toString()).toBe('Outcome.ok({"a":1})');
			});

			test("handle null and undefined values", () => {
				expect(Outcome.ok(null).toString()).toBe("Outcome.ok(null)");
				expect(Outcome.ok().toString()).toBe("Outcome.ok(undefined)");
			});

			test("handle strings and non-serializable values", () => {
				expect(Outcome.ok("hi").toString()).toBe('Outcome.ok("hi")');
				const circular: Record<string, unknown> = {};
				circular.self = circular;
				expect(Outcome.ok(circular).toString()).toContain("object Object");
			});
		});
	});

	describe("Integration & Edge Cases", () => {
		test("handle complex chaining", () => {
			const result = Outcome.ok(10)
				.map((n) => n * 2)
				.flatMap((n) =>
					n > 15 ? Outcome.err<number>("Too big") : Outcome.ok(n),
				)
				.mapErr(() => 0) // recover
				.map((n) => n.toString())
				.toTuple();
			expect(result).toEqual(["0", null]);
		});

		test("handle async chaining", async () => {
			const result = await Outcome.ok(5)
				.mapAsync(async (n) => n * 2)
				.then((o) => o.mapAsync(async (n) => n + 1));

			expect(result.toTuple()[0]).toBe(11);
		});

		test("work with Promise.all", async () => {
			const outcomes = await Promise.all([
				Outcome.fromAsync(async () => 1),
				Outcome.fromAsync(async () => 2),
				Outcome.fromAsync(async () => 3),
			]);

			expect(Outcome.all(outcomes).toTuple()[0]).toEqual([1, 2, 3]);
		});

		test("handle nested outcomes with flatMap", () => {
			const outer = Outcome.ok(Outcome.ok(42));
			const inner = outer.flatMap((o) => o.map((n) => n * 2));
			expect(inner.toTuple()[0]).toBe(84);
		});

		test("preserve immutability", () => {
			const original = Outcome.ok(42);
			const mapped = original.map((n) => n * 2);
			expect(original.toTuple()[0]).toBe(42);
			expect(mapped.toTuple()[0]).toBe(84);
		});
	});

	// v0.7.0: `Err.isErr` is nominal. Outcome is otherwise frozen — these rows
	// pin the behavior it inherits from the corrected guard.
	describe("nominal Err recognition", () => {
		const marker = { kind: "Err", message: "marker" };

		test("from() carries a marker-shaped object as success data", () => {
			const [value, error] = Outcome.from(() => marker).toTuple();

			expect(error).toBeNull();
			expect(value).toBe(marker);
		});

		test("fromAsync() carries a marker-shaped object as success data", async () => {
			const [value, error] = (
				await Outcome.fromAsync(async () => marker)
			).toTuple();

			expect(error).toBeNull();
			expect(value).toBe(marker);
		});

		test("err() normalizes a marker object through Err.from", () => {
			const [, error] = Outcome.err(marker as unknown as Err).toTuple();

			expect(error).toBeInstanceOf(Err);
			expect(error).not.toBe(marker);
			expect(error?.message).toBe("marker");
		});

		test("a callback tuple holding a marker object stays success data", () => {
			// The second slot is not an Err instance, so this is an ordinary array
			// value rather than the legacy control tuple.
			const payload = [null, marker];
			const [value, error] = Outcome.from(() => payload).toTuple();

			expect(error).toBeNull();
			expect(value).toBe(payload);
		});

		test("a thrown malformed marker becomes a failure instead of escaping", () => {
			const [, error] = Outcome.from(() => {
				throw { kind: "Err" };
			}).toTuple();

			expect(error).toBeInstanceOf(Err);
			expect(error?.code).toBe("UNKNOWN");
		});

		test("a thrown malformed marker rejects nothing in fromAsync", async () => {
			const [, error] = (
				await Outcome.fromAsync(async () => {
					throw { isErr: true };
				})
			).toTuple();

			expect(error).toBeInstanceOf(Err);
			expect(error?.code).toBe("UNKNOWN");
		});

		test("a thrown serialized Err is reconstructed", () => {
			const wire = JSON.parse(JSON.stringify(Err.from("wire", "WIRE")));
			const [, error] = Outcome.from(() => {
				throw wire;
			}).toTuple();

			expect(error).toBeInstanceOf(Err);
			expect(error?.message).toBe("wire");
			expect(error?.code).toBe("WIRE");
		});
	});
});
