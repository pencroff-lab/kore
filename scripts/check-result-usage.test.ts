import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type ts from "typescript";
import {
	resultUsageProgram,
	resultUsageViolations,
} from "./check-result-usage.sh";

const cases = [
	{
		label: "suppression still visits children",
		source:
			"// kore-ignore-result: reviewed top-level discard\nvoid (() => { save(); })();",
		count: 1,
	},
	{ label: "array of results", source: "[save(), save()];", count: 1 },
	{
		label: "readonly result collection",
		source: "([save(), save()] as const);",
		count: 1,
	},
	{ label: "nested result collection", source: "[[save()]];", count: 1 },
	{
		label: "Promise.all results",
		source: "await Promise.all([saveAsync(), saveAsync()]);",
		count: 1,
	},
	{
		label: "Promise.allSettled results",
		source: "await Promise.allSettled([saveAsync(), saveAsync()]);",
		count: 1,
	},
	{
		label: "Promise.allSettled ordinary data",
		source: "await Promise.allSettled([Promise.resolve(1)]);",
		count: 0,
	},
	{
		label: "consumed parallel results",
		source: "const results = await Promise.all([saveAsync(), saveAsync()]);",
		count: 0,
	},
	{
		label: "options property void callback",
		source:
			"declare function on(options: { handler: () => void }): void; on({ handler: () => save() });",
		count: 1,
	},
	{
		label: "void variable callback",
		source: "const f: () => void = () => save();",
		count: 1,
	},
	{
		label: "void class field callback",
		source: "class Handler { f: () => void = () => save(); }",
		count: 1,
	},
	{
		label: "void object method callback",
		source:
			"const options: { handler(): void } = { handler() { return save(); } };",
		count: 1,
	},
	{
		label: "test-style callback",
		source:
			"declare function check(fn: () => void | Promise<unknown>): void; check(async () => save());",
		count: 1,
	},
	{ label: "for initializer", source: "for (save(); choice;) {}", count: 1 },
	{ label: "for incrementor", source: "for (; choice; save()) {}", count: 1 },
	{
		label: "for consumed initializer",
		source: "for (let result = save(); choice;) {}",
		count: 0,
	},
	{
		label: "suppression is statement scoped",
		source:
			"// kore-ignore-result: only next statement\nNumber(1); void save();",
		count: 1,
	},
	{
		label: "second void on same line",
		source:
			"// kore-ignore-result: only next statement\nvoid save(); void save();",
		count: 1,
	},
	{
		label: "CRLF suppression",
		source: "// kore-ignore-result: deliberate discard\r\nvoid save();",
		count: 0,
	},
	{
		label: "CRLF empty reason",
		source: "// kore-ignore-result:   \r\nvoid save();",
		count: 1,
	},
	{
		label: "yield input is consumed",
		source:
			"function* generate(): Generator<number, void, ResultTuple<number>> { yield 1; }",
		count: 0,
	},
	{
		label: "yield propagates tuple",
		source: "function* generate() { yield save(); }",
		count: 0,
	},
	{
		label: "yield still visits nested discard",
		source:
			"function* generate(): Generator<number, void, ResultTuple<number>> { yield (void save(), 1); }",
		count: 1,
	},
	{ label: "direct tuple", source: "save();", count: 1 },
	{ label: "promised tuple", source: "saveAsync();", count: 1 },
	{ label: "awaited tuple", source: "await saveAsync();", count: 1 },
	{ label: "PromiseLike tuple", source: "saveLike();", count: 1 },
	{ label: "awaited PromiseLike tuple", source: "await saveLike();", count: 1 },
	{ label: "mixed result union", source: "mixed();", count: 1 },
	{ label: "readonly alias", source: "aliased();", count: 1 },
	{
		label: "asserted result",
		source: "(save() as ResultTuple<void>);",
		count: 1,
	},
	{
		label: "satisfies wrapper",
		source: "(save() satisfies ResultTuple<void>);",
		count: 1,
	},
	{ label: "non-null wrapper", source: "mixed()!;", count: 1 },
	{ label: "void escape without reason", source: "void save();", count: 1 },
	{ label: "void promise escape", source: "void saveAsync();", count: 1 },
	{
		label: "catch handler still drops resolved failure",
		source: "saveAsync().catch(console.error);",
		count: 1,
	},
	{
		label: "conditional result",
		source: "choice ? save() : undefined;",
		count: 1,
	},
	{ label: "logical result", source: "choice && save();", count: 1 },
	{
		label: "comma prefix in assigned expression",
		source: "const value = (save(), 1);",
		count: 1,
	},
	{
		label: "void inside assignment",
		source: "const value = void save();",
		count: 1,
	},
	{ label: "inline void callback", source: "consume(() => save());", count: 1 },
	{
		label: "block-bodied callback",
		source: "consume(() => { return save(); });",
		count: 1,
	},
	{
		label: "function expression callback",
		source: "consume(function () { return save(); });",
		count: 1,
	},
	{
		label: "named callback",
		source: "function callback() { return save(); }\nconsume(callback);",
		count: 1,
	},
	{ label: "forEach callback", source: "[1].forEach(() => save());", count: 1 },
	{
		label: "async callback in void consumer",
		source: "consume(async () => save());",
		count: 1,
	},
	{
		label: "awaited-void consumer",
		source: "consumeAsync(async () => save());",
		count: 1,
	},
	{
		label: "bare reason does not suppress",
		source: "// kore-ignore-result: test\nsave();",
		count: 1,
	},
	{
		label: "empty reason",
		source: "// kore-ignore-result:   \nvoid save();",
		count: 1,
	},
	{
		label: "misspelled suppression",
		source: "// kore-ignore-results: test\nvoid save();",
		count: 1,
	},
	{
		label: "misplaced reason",
		source: "// kore-ignore-result: test\nconst n = 1;\nvoid save();",
		count: 1,
	},
	{
		label: "blank-line reason",
		source: "// kore-ignore-result: test\n\nvoid save();",
		count: 1,
	},
	{
		label: "local-only suppression",
		source: "// kore-ignore-result: test\nvoid save();\nsave();",
		count: 1,
	},
	{
		label: "success-only structural tuple",
		source: "([1, null] as const);",
		count: 1,
	},
	{
		label: "failure-only structural tuple",
		source: "([null, Err.from('x')] as const);",
		count: 1,
	},
	{ label: "ordinary value", source: "Number('1');", count: 0 },
	{ label: "ordinary tuple", source: "([1, 2] as const);", count: 0 },
	{
		label: "unrelated failure-shaped tuple",
		source: "([1, Err.from('x')] as const);",
		count: 0,
	},
	{ label: "never", source: "stop();", count: 0 },
	{
		label: "raw any is an analysis limit",
		source: "JSON.parse('{}');",
		count: 0,
	},
	{ label: "unknown is an analysis limit", source: "mystery();", count: 0 },
	{
		label: "unknown callee is an analysis limit",
		source: "const opaque = JSON.parse('{}'); opaque(() => save());",
		count: 0,
	},
	{
		label: "assignment",
		source: "let value: ResultTuple<void>; value = save();",
		count: 0,
	},
	{ label: "initialization", source: "const value = save();", count: 0 },
	{
		label: "destructuring",
		source: "const [value, error] = save();",
		count: 0,
	},
	{ label: "return", source: "function caller() { return save(); }", count: 0 },
	{ label: "passed result", source: "handle(save());", count: 0 },
	{
		label: "tuple-consuming callback",
		source: "const tuple = keep(() => save());",
		count: 0,
	},
	{
		label: "fallible operator callback",
		source: "const tuple = flatMap(ok(1), () => save());",
		count: 0,
	},
	{
		label: "total map carries tuple as data",
		source: "const tuple = map(ok(1), () => save());",
		count: 0,
	},
	{ label: "ordinary void callback", source: "consume(() => {});", count: 0 },
	{
		label: "handled callback result",
		source: "consume(() => { const [value, error] = save(); });",
		count: 0,
	},
	{
		label: "documented discard",
		source: "// kore-ignore-result: negative-test probe\nvoid save();",
		count: 0,
	},
	{
		label: "parenthesized discard",
		source: "// kore-ignore-result: negative-test probe\n(void save());",
		count: 0,
	},
	{
		label: "callback local discard",
		source:
			"consume(() => {\n// kore-ignore-result: negative-test probe\nvoid save();\n});",
		count: 0,
	},
	{
		label: "void callback in a union parameter",
		source:
			"declare function unionConsumer(callback: (() => void) | string): void; unionConsumer(() => save());",
		count: 1,
	},
];

const directIndex = cases.findIndex((row) => row.label === "direct tuple");

describe("tuple must-use checker", () => {
	let work: string;
	let program: ts.Program;

	beforeAll(async () => {
		work = mkdtempSync(join(tmpdir(), "kore-result-usage-"));
		mkdirSync(join(work, "src"));
		const root = resolve(import.meta.dir, "..");
		symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");
		const prelude = `import { Err, flatMap, map, ok, type ResultTuple } from ${JSON.stringify(join(root, "index.ts"))};
declare function save(): ResultTuple<void>;
declare function saveAsync(): Promise<ResultTuple<void>>;
declare function saveLike(): PromiseLike<ResultTuple<number>>;
declare function mixed(): ResultTuple<number> | undefined | "skip";
type Alias = ResultTuple<number>;
declare function aliased(): Alias;
declare function stop(): never;
declare function mystery(): unknown;
declare const choice: boolean;
declare function consume(callback: () => void): void;
declare function consumeAsync(callback: () => Promise<void>): void;
declare function keep<T>(callback: () => T): T;
declare function handle(tuple: ResultTuple<void>): void;
`;
		for (const [index, row] of cases.entries()) {
			await Bun.write(
				join(work, "src", `case-${index}.ts`),
				`${prelude}${row.source}\n`,
			);
		}
		await Bun.write(
			join(work, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					strict: true,
					noEmit: true,
					target: "ES2022",
					module: "Preserve",
					moduleResolution: "bundler",
					allowImportingTsExtensions: true,
					skipLibCheck: true,
				},
				include: ["src/*.ts"],
			}),
		);
		program = resultUsageProgram(join(work, "tsconfig.json"));
	});
	afterAll(() => {
		if (work) rmSync(work, { recursive: true, force: true });
	});

	test.each(cases.map((row, index) => ({ ...row, index })))("$label", ({
		index,
		count,
	}) => {
		const violations = resultUsageViolations(program, work, [
			`src/case-${index}.ts`,
		]);
		expect(violations.length).toEqual(count);
		for (const violation of violations)
			expect(violation).toMatch(new RegExp(`^src/case-${index}\\.ts:\\d+:`));
	});

	test("reports the actual discarded expression line", () => {
		expect(
			resultUsageViolations(program, work, [`src/case-${directIndex}.ts`]),
		).toEqual([
			expect.stringMatching(
				new RegExp(`^src/case-${directIndex}\\.ts:15: result tuple discarded`),
			),
		]);
	});

	test("CLI exits nonzero with located violations", async () => {
		const child = Bun.spawn(
			[
				"bun",
				resolve(import.meta.dir, "check-result-usage.sh.ts"),
				join(work, "tsconfig.json"),
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const [status, error] = await Promise.all([
			child.exited,
			new Response(child.stderr).text(),
		]);
		expect(status).toEqual(1);
		expect(error).toContain(`FAIL: src/case-${directIndex}.ts:15:`);
	});

	test("CLI succeeds when results are consumed", async () => {
		const index = cases.findIndex((row) => row.label === "initialization");
		await Bun.write(
			join(work, "clean.json"),
			JSON.stringify({
				extends: "./tsconfig.json",
				include: [`src/case-${index}.ts`],
			}),
		);
		const child = Bun.spawn(
			[
				"bun",
				resolve(import.meta.dir, "check-result-usage.sh.ts"),
				join(work, "clean.json"),
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const [status, out, error] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);
		expect({ status, out, error }).toEqual({
			status: 0,
			out: "Result usage check passed.\n",
			error: "",
		});
	});
});
