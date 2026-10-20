import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sinon from "sinon";
import { Err } from "../types/err";
import {
	type AnyOp,
	type AsyncSource,
	attempt,
	attemptAsync,
	attemptValue,
	attemptValueAsync,
	effect,
	ensure,
	fail,
	flatMap,
	flatMapAsync,
	map,
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

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;
type Expect<T extends true> = T;

// Uncalled: negative async examples must never create rejections in Bun.
function _rejectedTypes(raw: string): unknown[] {
	const step = onOk((n: number) => ok(n + 1));
	const asyncStep = onOkAsync(async (n: number) => ok(n + 1));
	// The direct-call negative also runs against emitted declarations.
	type TupleEffectRejected = Expect<
		Equal<
			(() => ResultTuple<void>) extends Parameters<typeof effect<number>>[1]
				? true
				: false,
			false
		>
	>;
	const tupleEffectRejected: TupleEffectRejected = true;
	return [
		tupleEffectRejected,
		// @ts-expect-error response.json belongs to the async adapter
		attemptValue(() => new Response("{}").json()),
		// @ts-expect-error synchronous value adapters must not float promises
		attemptValue(() => Promise.resolve(JSON.parse(raw))),
		// @ts-expect-error async value callbacks belong to attemptValueAsync
		attemptValue(async () => 1),
		// @ts-expect-error PromiseLike values also belong to attemptValueAsync
		attemptValue(() => Promise.resolve(1) as PromiseLike<number>),
		// @ts-expect-error any promised branch makes the callback asynchronous
		attemptValue(() => (raw ? 1 : Promise.resolve(1))),
		// @ts-expect-error a bare value is not a ResultTuple
		flatMap(ok(1), (n: number) => n * 2),
		// @ts-expect-error a bare Err is not a ResultTuple
		flatMap(ok(1), () => Err.from("nope")),
		// @ts-expect-error a missing return is not a ResultTuple
		flatMap(ok(1), () => {}),
		// @ts-expect-error raw any is not a fallible protocol
		attempt(() => JSON.parse(raw)),
		// @ts-expect-error awaited any is not a fallible protocol
		attemptAsync(async () => JSON.parse(raw)),
		// @ts-expect-error raw any from a nominally async callback
		attemptAsync(() => JSON.parse(raw)),
		// @ts-expect-error raw any
		flatMap(ok(raw), (value) => JSON.parse(value)),
		// @ts-expect-error awaited any
		flatMapAsync(ok(raw), async (value) => JSON.parse(value)),
		// @ts-expect-error raw any
		mapErr(fail("x"), () => JSON.parse(raw)),
		// @ts-expect-error awaited any
		mapErrAsync(fail("x"), async () => JSON.parse(raw)),
		ensure(
			ok(1),
			// @ts-expect-error predicates cannot return any
			() => JSON.parse("true"),
			() => Err.from("no"),
		),
		ensure(
			ok(1),
			() => false,
			// @ts-expect-error error factories cannot return any
			() => JSON.parse("null"),
		),
		// @ts-expect-error raw any
		onOk((value: string) => JSON.parse(value)),
		// @ts-expect-error awaited any
		onOkAsync(async (value: string) => JSON.parse(value)),
		// @ts-expect-error raw any
		onErr(() => JSON.parse(raw)),
		// @ts-expect-error awaited any
		onErrAsync(async () => JSON.parse(raw)),
		// @ts-expect-error raw any
		onTuple(() => JSON.parse(raw)),
		// @ts-expect-error awaited any
		onTupleAsync(async () => JSON.parse(raw)),
		// @ts-expect-error raw source any
		pipe(JSON.parse(raw)),
		// @ts-expect-error raw async source any
		pipeAsync(JSON.parse(raw)),
		// @ts-expect-error Promise<any> source
		pipeAsync(Promise.resolve(JSON.parse(raw))),
		// @ts-expect-error Promise<any> IIFE source
		pipeAsync((async () => JSON.parse(raw))()),
		// @ts-expect-error direct stage any
		pipe(ok(1), () => JSON.parse(raw)),
		// @ts-expect-error direct async stage Promise<any>
		pipeAsync(ok(1), async () => JSON.parse(raw)),
		pipe(
			ok(123),
			// @ts-expect-error wrong stage input, throwing example
			onOk((s: string) => ok(s.toUpperCase())),
		),
		pipe(
			ok(123),
			// @ts-expect-error wrong stage input, silent undefined example
			onOk((s: string) => ok(s.length)),
		),
		pipeAsync(
			ok(123),
			// @ts-expect-error wrong async stage input, throwing example
			onOkAsync(async (s: string) => ok(s.toUpperCase())),
		),
		pipeAsync(
			ok(123),
			// @ts-expect-error wrong async stage input, silent undefined example
			onOk((s: string) => ok(s.length)),
		),
		pipe(
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
			// @ts-expect-error eleven stages exceed the public ladder
			step,
		),
		pipeAsync(
			ok(0),
			asyncStep,
			asyncStep,
			asyncStep,
			asyncStep,
			asyncStep,
			asyncStep,
			asyncStep,
			asyncStep,
			asyncStep,
			asyncStep,
			// @ts-expect-error eleven async stages exceed the public ladder
			asyncStep,
		),
		// @ts-expect-error effect must not discard a promise
		effect(ok(1), async () => {
			throw new Error("boom");
		}),
		// @ts-expect-error async-only callback factories still require promises
		onOkAsync((n: number) => ok(n)),
	];
}

function _positiveTypes(raw: string): unknown[] {
	const literal = attempt(() => [1, null]);
	const branches = attempt(() => (raw ? [1, null] : [null, Err.from("no")]));
	const asyncLiteral = attemptAsync(async () => [1, null]);
	const asyncBranches = attemptAsync(async () =>
		raw ? [1, null] : [null, Err.from("no")],
	);
	const chained = flatMap(ok(1), (n) => [n.toString(), null]);
	const chainedAsync = flatMapAsync(ok(1), async (n) => [n.toString(), null]);
	const refined = ensure(
		ok(1) as ResultTuple<number | string>,
		(v): v is string => typeof v === "string",
		() => Err.from("no"),
	);
	const recover = onErr(() => ["fixed", null]);
	const recoverAsync = onErrAsync(async () => ["fixed", null]);
	const recovered = pipe(ok(1), recover);
	const recoveredMixed = pipeAsync(ok(1), recover);
	const recoveredAsync = pipeAsync(ok(1), recoverAsync);
	const never = attempt(() => {
		throw new Error("boom");
	});
	const neverAsync = attemptAsync(async () => {
		throw new Error("boom");
	});
	const neverPredicate = ensure(
		ok(1),
		() => {
			throw new Error("predicate");
		},
		() => Err.from("no"),
	);
	const neverFactory = ensure(
		ok(1),
		() => false,
		() => {
			throw new Error("factory");
		},
	);
	const data = attemptValue(() => JSON.parse(raw));
	const dataAsync = attemptValueAsync(async () => JSON.parse(raw));
	const step = onOk((n: number) => [n + 1, null]);
	const ten = pipe(
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
		onOk((n: number) => [n.toString(), null]),
	);
	const tenAsync = pipeAsync(
		Promise.resolve(ok(0)),
		step,
		step,
		step,
		step,
		step,
		step,
		step,
		step,
		step,
		onOkAsync(async (n: number) => [n.toString(), null]),
	);
	const rawStages = pipe(
		ok(1),
		([v, e]) => (e === null ? [v.toString(), null] : [null, e]),
		([v, e]) => (e === null ? [v.length, null] : [null, e]),
	);
	const typed: [
		Expect<Equal<typeof literal, ResultTuple<number>>>,
		Expect<Equal<typeof branches, ResultTuple<number>>>,
		Expect<Equal<typeof asyncLiteral, Promise<ResultTuple<number>>>>,
		Expect<Equal<typeof asyncBranches, Promise<ResultTuple<number>>>>,
		Expect<Equal<typeof chained, ResultTuple<string>>>,
		Expect<Equal<typeof chainedAsync, Promise<ResultTuple<string>>>>,
		Expect<Equal<typeof refined, ResultTuple<string>>>,
		Expect<Equal<typeof recovered, ResultTuple<number | string>>>,
		Expect<Equal<typeof recoveredMixed, Promise<ResultTuple<number | string>>>>,
		Expect<Equal<typeof recoveredAsync, Promise<ResultTuple<number | string>>>>,
		Expect<Equal<typeof never, ResultTuple<never>>>,
		Expect<Equal<typeof neverAsync, Promise<ResultTuple<never>>>>,
		Expect<Equal<typeof data, ResultTuple<unknown>>>,
		Expect<Equal<typeof dataAsync, Promise<ResultTuple<unknown>>>>,
		Expect<Equal<typeof ten, ResultTuple<string>>>,
		Expect<Equal<typeof tenAsync, Promise<ResultTuple<string>>>>,
		Expect<Equal<typeof rawStages, ResultTuple<number>>>,
	] = [
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
		true,
	];
	const [value, error] = data;
	if (error === null) {
		// @ts-expect-error success still contains unknown until schema validation
		const _unchecked = value.id;
	}

	// Documented limits: explicit generic arguments and annotations erase raw any.
	const explicit: ResultTuple<number> = attempt<number>(() => JSON.parse(raw));
	const annotated: () => ResultTuple<unknown> = () => JSON.parse(raw);
	const erased = attempt(annotated);
	const annotatedStage: Op<number, string> = () => JSON.parse(raw);
	const annotatedAsyncStage: OpAsync<number, string> = async () =>
		JSON.parse(raw);
	const annotatedMixedStage: AnyOp<number, string> = () => JSON.parse(raw);
	const annotatedSource: AsyncSource<number> = JSON.parse(raw);
	// @ts-expect-error an explicitly supplied raw any parameter is rejected
	const rejectedOp: Op<number, string, ReturnType<typeof JSON.parse>> = () =>
		JSON.parse(raw);
	// @ts-expect-error explicitly supplied Promise<any> is rejected
	const rejectedAsyncOp: OpAsync<
		number,
		string,
		Promise<ReturnType<typeof JSON.parse>>
	> = async () => JSON.parse(raw);
	// @ts-expect-error an explicitly supplied raw any parameter is rejected
	const rejectedAnyOp: AnyOp<
		number,
		string,
		ReturnType<typeof JSON.parse>
	> = () => JSON.parse(raw);
	// @ts-expect-error an explicitly supplied raw any source parameter is rejected
	const rejectedSource: AsyncSource<
		number,
		ReturnType<typeof JSON.parse>
	> = JSON.parse(raw);
	// @ts-expect-error an explicitly supplied Promise<any> source is rejected
	const rejectedPromiseSource: AsyncSource<
		number,
		Promise<ReturnType<typeof JSON.parse>>
	> = Promise.resolve(JSON.parse(raw));
	return [
		typed,
		neverPredicate,
		neverFactory,
		explicit,
		erased,
		annotatedStage,
		annotatedAsyncStage,
		annotatedMixedStage,
		annotatedSource,
		rejectedOp,
		rejectedAsyncOp,
		rejectedAnyOp,
		rejectedSource,
		rejectedPromiseSource,
		effect(ok(1), () => {}),
		effect(ok(1), () => undefined),
		map(ok(1), () => fail("data")),
	];
}

function _contextualStageTypes(): unknown[] {
	const inline = pipe(
		ok(1),
		onOk((n) => {
			const _input: Expect<Equal<typeof n, number>> = true;
			return ok(n + 1);
		}),
		onOk((n) => ok(String(n))),
	);
	const tuple = pipe(
		ok(1),
		onTuple(([n, e]) => (e === null ? ok(n + 1) : fail(e))),
		onOk((n) => ok(String(n))),
	);
	const asyncInline = pipeAsync(
		ok(1),
		onOkAsync(async (n) => {
			const _input: Expect<Equal<typeof n, number>> = true;
			return ok(n + 1);
		}),
		onOk((n) => ok(String(n))),
	);
	const mixed = pipeAsync(
		Promise.resolve(ok(1)),
		onOk((n) => ok(n + 1)),
		onOkAsync(async (n) => ok(String(n))),
	);
	const asyncTuple = pipeAsync(
		ok(1),
		onTuple(([n, e]) => (e === null ? ok(n + 1) : fail(e))),
		onOk((n) => ok(String(n))),
	);
	const awaitedTuple = pipeAsync(
		Promise.resolve(ok(1)),
		onTupleAsync(async ([n, e]) => (e === null ? ok(n + 1) : fail(e))),
		onOk((n) => ok(String(n))),
	);
	const recover = onErr(() => ok("fixed"));
	const recoverAsync = onErrAsync(async () => ok("fixed"));
	const stored = onOk((n: number) => ok(n + 1));
	const storedRecovered = pipe(
		ok(1),
		stored,
		recover,
		onOk((n) => {
			const _input: Expect<Equal<typeof n, number | string>> = true;
			return ok(String(n));
		}),
	);
	const storedRecoveredAsync = pipeAsync(
		ok(1),
		stored,
		recoverAsync,
		onOk((n) => {
			const _input: Expect<Equal<typeof n, number | string>> = true;
			return ok(String(n));
		}),
	);
	const ten = pipe(
		ok(0),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(n + 1)),
		onOk((n) => ok(String(n))),
	);
	const types: [
		Expect<Equal<typeof inline, ResultTuple<string>>>,
		Expect<Equal<typeof tuple, ResultTuple<string>>>,
		Expect<Equal<typeof asyncInline, Promise<ResultTuple<string>>>>,
		Expect<Equal<typeof mixed, Promise<ResultTuple<string>>>>,
		Expect<Equal<typeof asyncTuple, Promise<ResultTuple<string>>>>,
		Expect<Equal<typeof awaitedTuple, Promise<ResultTuple<string>>>>,
		Expect<Equal<typeof storedRecovered, ResultTuple<string>>>,
		Expect<Equal<typeof storedRecoveredAsync, Promise<ResultTuple<string>>>>,
		Expect<Equal<typeof ten, ResultTuple<string>>>,
	] = [true, true, true, true, true, true, true, true, true];
	return types;
}

describe("value adapters", () => {
	let sandbox: sinon.SinonSandbox;
	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});
	afterEach(() => sandbox.restore());

	test.each([
		{ label: "object", make: () => ({ id: 1 }) },
		{ label: "tuple-shaped data", make: () => [7, null] },
		{
			label: "error-shaped data",
			make: () => ({ kind: "Err", message: "data" }),
		},
		{ label: "Err data", make: () => Err.from("data") },
		{ label: "null", make: () => null },
		{ label: "undefined", make: () => undefined },
	])("always envelopes $label exactly once", async ({ make }) => {
		const data = make();
		const callback = sandbox.stub<[], unknown>().returns(data);
		const sync = attemptValue(callback);
		const asyncCallback = sandbox.stub<[], Promise<unknown>>().resolves(data);
		const async = await attemptValueAsync(asyncCallback);
		expect(sync).toEqual([data, null]);
		expect(async).toEqual([data, null]);
		expect(sync[0] === data).toEqual(true);
		expect(async[0] === data).toEqual(true);
		sinon.assert.calledOnce(callback);
		sinon.assert.calledOnce(asyncCallback);
	});

	test("async value adapters assimilate thenables", async () => {
		const then = sandbox
			.stub<[unknown, unknown], unknown>()
			.callsFake((resolve) => {
				(resolve as (value: number) => void)(42);
			});
		const thenable = { then } as unknown as PromiseLike<number>;
		const result: ResultTuple<number> = await attemptValueAsync(() => thenable);
		expect(result).toEqual([42, null]);
		sinon.assert.calledOnce(then);
	});

	test.each([
		{ label: "native error", make: () => new Error("boom") },
		{ label: "Err", make: () => Err.from("boom") },
		{
			label: "hostile value",
			make: () =>
				new Proxy(
					{},
					{
						getPrototypeOf() {
							throw new Error("trap");
						},
					},
				),
		},
	])("normalizes a thrown or rejected $label", async ({ make }) => {
		const caught = make();
		const throwing = sandbox.stub<[], never>().callsFake(() => {
			throw caught;
		});
		const rejecting = sandbox.stub<[], Promise<never>>().callsFake(async () => {
			throw caught;
		});
		for (const tuple of [
			attemptValue(throwing),
			await attemptValueAsync(throwing),
			await attemptValueAsync(rejecting),
		]) {
			expect(tuple[0]).toEqual(null);
			expect(tuple[1] instanceof Err).toEqual(true);
			expect(tuple[1]?.code).toEqual(Err.from(caught).code);
			expect(tuple[1]?.message).toEqual(Err.from(caught).message);
		}
	});

	test("effect accepts void and undefined and converts throws", () => {
		const callback = sandbox.stub<[ResultTuple<number>], void>();
		const tuple = effect(ok(1), callback);
		expect(tuple).toEqual([1, null]);
		sinon.assert.calledOnceWithExactly(callback, tuple);
		expect(effect(ok(1), () => undefined)).toEqual([1, null]);
		const caught = Err.from("effect failed");
		const [value, error] = effect(ok(1), () => {
			throw caught;
		});
		expect(value).toEqual(null);
		expect(error instanceof Err).toEqual(true);
		expect(error?.message).toEqual(caught.message);
	});
});
