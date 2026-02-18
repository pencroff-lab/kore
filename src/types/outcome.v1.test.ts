import { describe, expect, test } from "bun:test";
import { Err } from "./err";
import { Outcome } from "./outcome";

describe("Outcome", () => {
	describe("Factory Methods", () => {
		test("ok() creates successful Outcome", () => {
			const outcome = Outcome.ok(42);
			expect(outcome.isOk).toBe(true);
			expect(outcome.value).toBe(42);
		});

		test("err() creates failed Outcome from Err", () => {
			const error = Err.from("test error");
			const outcome = Outcome.err(error);
			expect(outcome.isErr).toBe(true);
			expect(outcome.error).toBe(error);
		});

		describe("fail() -> err()", () => {
			test("fail() -> err() creates new error with message and code", () => {
				const outcome = Outcome.err("message", "CODE");
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("message");
				expect(outcome.error?.code).toBe("CODE");
			});

			test("fail() -> err() wraps existing Error", () => {
				const inner = new Error("inner");
				const outcome = Outcome.err("context", inner);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("context");
				expect(outcome.error?.unwrap()?.message).toBe("inner");
			});

			test("fail() -> err() wraps existing Err", () => {
				const inner = Err.from("inner", "INNER_CODE");
				const outcome = Outcome.err("context", inner);
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("context");
				expect(outcome.error?.unwrap()).toBe(inner);
			});

			test("fail() -> err() wraps Error with custom code (3rd parameter)", () => {
				const inner = new Error("inner");
				const outcome = Outcome.err("context", inner, {
					code: "CUSTOM_CODE",
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("context");
				expect(outcome.error?.code).toBe("CUSTOM_CODE");
				expect(outcome.error?.unwrap()?.message).toBe("inner");
			});

			test("fail() -> err() wraps Err with custom code (3rd parameter)", () => {
				const inner = Err.from("inner", "INNER_CODE");
				const outcome = Outcome.err("context", inner, {
					code: "WRAPPER_CODE",
				});
				expect(outcome.isErr).toBe(true);
				expect(outcome.error?.message).toBe("context");
				expect(outcome.error?.code).toBe("WRAPPER_CODE");
				expect(outcome.error?.unwrap()).toBe(inner);
			});
		});

		test("from() captures success", () => {
			const outcome = Outcome.from(() => [42, null]);
			expect(outcome.isOk).toBe(true);
			expect(outcome.value).toBe(42);
		});

		test("from() captures exception as Err", () => {
			const outcome = Outcome.from(() => {
				throw new Error("boom");
			});
			expect(outcome.isErr).toBe(true);
			expect(outcome.error).toBeInstanceOf(Err);
			expect(outcome.error?.message).toBe("boom");
		});

		test("fromAsync() captures success", async () => {
			const outcome = await Outcome.fromAsync(async () => [42, null]);
			expect(outcome.isOk).toBe(true);
			expect(outcome.value).toBe(42);
		});

		test("fromAsync() captures rejection as Err", async () => {
			const outcome = await Outcome.fromAsync(async () => {
				throw new Error("async boom");
			});
			expect(outcome.isErr).toBe(true);
			expect(outcome.error?.message).toBe("async boom");
		});
	});

	describe("Core Accessors", () => {
		test("isOk and isErr are mutually exclusive", () => {
			const ok = Outcome.ok(1);
			const err = Outcome.err("error");
			expect(ok.isOk).toBe(true);
			expect(ok.isErr).toBe(false);
			expect(err.isOk).toBe(false);
			expect(err.isErr).toBe(true);
		});

		test("value and error accessors", () => {
			const ok = Outcome.ok(1);
			const err = Outcome.err("error");
			expect(ok.value).toBe(1);
			expect(ok.error).toBe(null);
			expect(err.value).toBe(null);
			expect(err.error).toBeInstanceOf(Err);
		});
	});

	describe("Transformation Methods", () => {
		test("map transforms value", () => {
			const outcome = Outcome.ok(21).map((x) => [x * 2, null]);
			expect(outcome.value).toBe(42);
		});

		test("map catches exceptions", () => {
			const outcome = Outcome.ok(21).map(() => {
				throw new Error("map boom");
			});
			expect(outcome.isErr).toBe(true);
			expect(outcome.error?.message).toBe("map boom");
		});

		test("mapErr transforms error", () => {
			const outcome = Outcome.err("original").mapErr((e) =>
				Err.wrap("transformed", e),
			);
			expect(outcome.error?.message).toBe("transformed");
			expect(outcome.error?.unwrap()?.message).toBe("original");
		});

		test("mapAsync transforms value asynchronously", async () => {
			const outcome = await Outcome.ok(21).mapAsync(async (x) => [x * 2, null]);
			expect(outcome.value).toBe(42);
		});
	});

	describe("Recovery and Matching", () => {
		test("recover provides replacement value", () => {
			const outcome = Outcome.err("err").mapErr(() => [42, null]);
			expect(outcome.value).toBe(42);
		});

		test("tap executes side effect on success", () => {
			let called = false;
			Outcome.ok(42).effect(([v, _]) => {
				called = true;
				expect(v).toBe(42);
			});
			expect(called).toBe(true);
		});

		test("tapErr executes side effect on failure", () => {
			let called = false;
			Outcome.err("err").effect(([_, e]) => {
				called = true;
				expect(e?.message).toBe("err");
			});
			expect(called).toBe(true);
		});
	});

	describe("Conversion Methods", () => {
		test("toTuple", () => {
			const [v1, e1] = Outcome.ok(42).toTuple();
			expect(v1).toBe(42);
			expect(e1).toBe(null);

			const [v2, e2] = Outcome.err("err").toTuple();
			expect(v2).toBe(null);
			expect(e2).toBeInstanceOf(Err);
			expect(e2?.message).toBe("err");
		});

		test("toJSON and fromJSON", () => {
			const original = Outcome.err("err", "CODE");
			const json = original.toJSON();
			const restored = Outcome.fromJSON(json);
			expect(restored.isErr).toBe(true);
			expect(restored.error?.message).toBe("err");
			expect(restored.error?.code).toBe("CODE");
		});
	});

	describe("Combinators", () => {
		test("all succeeds if all succeed", () => {
			const outcome = Outcome.all([Outcome.ok(1), Outcome.ok(2)]);
			expect(outcome.value).toEqual([1, 2]);
		});

		test("all aggregates errors if any fail", () => {
			const outcome = Outcome.all([
				Outcome.ok(1),
				Outcome.err("err1"),
				Outcome.err("err2"),
			]);
			expect(outcome.isErr).toBe(true);
			expect(outcome.error?.message).toContain("Multiple failed");
			expect(outcome.error?.errors).toHaveLength(2);
		});

		test("any returns first success", () => {
			const outcome = Outcome.any([
				Outcome.err("err1"),
				Outcome.ok(1),
				Outcome.ok(2),
			]);
			expect(outcome.value).toBe(1);
		});

		test("any aggregates errors if all fail", () => {
			const outcome = Outcome.any([Outcome.err("err1"), Outcome.err("err2")]);
			expect(outcome.isErr).toBe(true);
			expect(outcome.error?.message).toContain("All failed");
			expect(outcome.error?.errors).toHaveLength(2);
		});
	});
});
