import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { Glob } from "bun";
import {
	commonTypesViolations,
	flowViolations,
	importSpecifiers,
} from "./check-boundaries.sh";

describe("importSpecifiers", () => {
	test.each([
		{ label: "a static import", source: 'import { a } from "./a";' },
		{ label: "a type-only import", source: 'import type { A } from "./a";' },
		{ label: "a side-effect import", source: 'import "./a";' },
		{ label: "a re-export", source: 'export { a } from "./a";' },
		{ label: "a star re-export", source: 'export * from "./a";' },
		{ label: "a type star re-export", source: 'export type * from "./a";' },
		{ label: "a dynamic import", source: 'void import("./a");' },
		{
			label: "a dynamic import behind a comment",
			source: 'void import /* c */ ("./a");',
		},
		{
			label: "a template-literal dynamic import",
			source: "void import(`./a`);",
		},
		{
			label: "an import-equals declaration",
			source: 'import x = require("./a");',
		},
		{ label: "a require call", source: 'const x = require("./a");' },
		{
			label: "an indexed inline import type",
			source: 'type T = import("./a").A;',
		},
		{
			label: "a typeof inline import type",
			source: 'type M = typeof import("./a");',
		},
		{
			label: "an inline import type inside a generic",
			source: 'type L = Array<import("./a").A>;',
		},
		{
			label: "an inline import type in a signature",
			source: 'declare function f(x: import("./a").A): void;',
		},
	])("finds $label", ({ source }) => {
		expect(importSpecifiers(source).map((r) => r.specifier)).toEqual(["./a"]);
	});

	test("reports a non-literal specifier rather than skipping it", () => {
		const refs = importSpecifiers("const p = './a';\nvoid import(p);");

		expect(refs).toHaveLength(1);
		expect(refs[0]?.specifier).toBeNull();
	});

	test("ignores a string that is not a module specifier", () => {
		expect(importSpecifiers('const s = "./outcome";')).toEqual([]);
	});

	test("reports the line of each reference", () => {
		const refs = importSpecifiers('\n\nimport { a } from "./a";');

		expect(refs[0]?.line).toBe(3);
	});
});

describe("flowViolations", () => {
	test.each([
		{
			label: "a static import",
			source: 'import { Outcome } from "../types/outcome";',
		},
		{ label: "a re-export", source: 'export * from "../types/outcome.types";' },
		{ label: "a dynamic import", source: 'void import("../types/outcome");' },
		{
			label: "a dynamic import behind a comment",
			source: 'void import /* c */ ("../types/outcome");',
		},
		{
			label: "a template-literal dynamic import",
			source: "void import(`../types/outcome`);",
		},
		{
			label: "an import-equals declaration",
			source: 'import o = require("../types/outcome");',
		},
		{
			label: "an indexed inline import type",
			source: 'type O = import("../types/outcome").Outcome;',
		},
		{
			label: "a typeof inline import type",
			source: 'type M = typeof import("../types/outcome");',
		},
		{
			label: "an inline import type of the class-tier types module",
			source:
				'type P = import("../types/outcome.types").PipeFn<number, string>;',
		},
	])("rejects $label of the class tier", ({ source }) => {
		expect(flowViolations("src/flow/probe.ts", source)).toHaveLength(1);
	});

	test("rejects a specifier it cannot analyze", () => {
		const found = flowViolations(
			"src/flow/probe.ts",
			"const p = '../types/outcome';\nvoid import(p);",
		);

		expect(found).toHaveLength(1);
		expect(found[0]).toContain("not statically analyzable");
	});

	test("accepts the allowed dependencies", () => {
		const source = [
			'import type { ResultTuple } from "../types/common.types";',
			'import { Err } from "../types/err";',
			'export * from "./flow.types";',
			'type E = import("../types/err").Err;',
		].join("\n");

		expect(flowViolations("src/flow/probe.ts", source)).toEqual([]);
	});
});

describe("commonTypesViolations", () => {
	test("accepts the Err type import alone", () => {
		expect(commonTypesViolations('import type { Err } from "./err";')).toEqual(
			[],
		);
	});

	test.each([
		{
			label: "the class tier",
			source: 'import type { Outcome } from "./outcome";',
		},
		{
			label: "the flow tier",
			source: 'import type { Op } from "../flow/flow.types";',
		},
		{ label: "a dynamic import", source: 'void import("./outcome");' },
		{
			label: "an inline import type",
			source: 'type O = import("./outcome").Outcome;',
		},
	])("rejects an import of $label", ({ source }) => {
		expect(commonTypesViolations(source)).toHaveLength(1);
	});

	test("rejects a non-literal specifier", () => {
		expect(commonTypesViolations("void import(p);")[0]).toContain(
			"a non-literal specifier",
		);
	});
});

describe("the committed sources", () => {
	const root = resolve(import.meta.dir, "..");

	test("no file under src/flow depends on the class tier", async () => {
		const glob = new Glob("src/flow/**/*.ts");
		const found: string[] = [];

		for await (const file of glob.scan({ cwd: root, absolute: true })) {
			const rel = file.replace(`${root}/`, "");
			found.push(...flowViolations(rel, await Bun.file(file).text()));
		}

		expect(found).toEqual([]);
	});

	test("common.types.ts imports only ./err", async () => {
		const source = await Bun.file(
			resolve(root, "src/types/common.types.ts"),
		).text();

		expect(commonTypesViolations(source)).toEqual([]);
		expect(importSpecifiers(source).map((r) => r.specifier)).toEqual(["./err"]);
	});
});
