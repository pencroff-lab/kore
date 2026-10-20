import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { Glob } from "bun";
import { guideOutcomeViolations } from "./check-guide-outcome";

describe("guide Outcome policy", () => {
	test.each([
		{ label: "call", code: 'Outcome.ok("x")' },
		{ label: "type", code: "const x: Outcome<string> = f();" },
		{ label: "import", code: 'import { Outcome } from "kore";' },
	])("rejects a fenced $label", ({ code }) => {
		expect(
			guideOutcomeViolations(
				"docs/guides/new.md",
				`# Guide\n\n\`\`\`ts\n${code}\n\`\`\``,
			),
		).toEqual([
			"docs/guides/new.md:4: deprecated Outcome in code block; use flow",
		]);
	});

	test.each([
		{ label: "tilde", source: "~~~\nOutcome.ok(1)\n~~~", line: 2 },
		{ label: "blockquote", source: "> ```ts\n> Outcome.ok(1)\n> ```", line: 2 },
		{
			label: "list",
			source: "- Example\n\n  ```ts\n  Outcome.ok(1)\n  ```",
			line: 4,
		},
		{ label: "indented", source: "    Outcome.ok(1)", line: 1 },
	])("recognizes $label code", ({ source, line }) => {
		expect(
			guideOutcomeViolations("docs/guides/tsdoc_guide.md", source),
		).toEqual([
			`docs/guides/tsdoc_guide.md:${line}: deprecated Outcome in code block; use flow`,
		]);
	});

	test.each([
		{
			path: "error-handling-patterns.md",
			source:
				"> `Outcome` is deprecated and frozen since v0.7.0. Its generated API reference",
		},
		{
			path: "error-handling-patterns.md",
			source:
				"That keeps every catch boundary — `attempt`, `pipe` stages, `Outcome.from` — total.",
		},
		{
			path: "error-handling-patterns.md",
			source:
				"- [Outcome examples](../examples/outcome.md) — deprecated, frozen class reference",
		},
		{
			path: "flow-operation-flows.md",
			source:
				"- [Migrating from `Outcome`](../../README.md#migrating-from-outcome) — the class-tier operation map",
		},
		{
			path: "migration-from-throwing.md",
			source:
				"- [Migrating from `Outcome`](../../README.md#migrating-from-outcome) — the class-tier operation map",
		},
		...[
			["err", "static factory"],
			["defaultTo", "instance method"],
			["pipe", "instance method"],
			["pipeAsync", "instance method"],
		].map(([method, kind]) => ({
			path: "tsdoc_guide.md",
			source: `| \`Outcome.${method}()\` | ${kind} |`,
		})),
	])("allows the documented prose exception: $source", ({ path, source }) => {
		expect(guideOutcomeViolations(`docs/guides/${path}`, source)).toEqual([]);
	});

	test.each([
		{
			label: "new advice",
			path: "error-handling-patterns.md",
			source: "Use `Outcome.ok()` for new code.",
		},
		{
			label: "unlabelled link",
			path: "error-handling-patterns.md",
			source: "[Outcome examples](../examples/outcome.md)",
		},
		{
			label: "wrong path",
			path: "new.md",
			source: "> `Outcome` is deprecated and frozen since v0.7.0.",
		},
		{
			label: "unlisted table row",
			path: "tsdoc_guide.md",
			source: "| `Outcome.ok()` | static factory |",
		},
	])("rejects $label", ({ path, source }) => {
		expect(guideOutcomeViolations(`docs/guides/${path}`, source)).toEqual([
			expect.stringMatching(/unapproved Outcome prose reference/),
		]);
	});

	test("an allowed phrase never exempts code or adjacent advice", () => {
		const allowed = "> `Outcome` is deprecated and frozen since v0.7.0.";
		const source = `${allowed} Use Outcome.ok().\n\n\`\`\`text\n${allowed}\n\`\`\``;
		expect(
			guideOutcomeViolations("docs/guides/error-handling-patterns.md", source),
		).toEqual([
			"docs/guides/error-handling-patterns.md:1: unapproved Outcome prose reference; add an exact excerpt to proseExceptions in scripts/check-guide-outcome.ts only for deprecation or reference prose",
			"docs/guides/error-handling-patterns.md:4: deprecated Outcome in code block; use flow",
		]);
	});

	test("accepts flow code and distinct identifiers", () => {
		expect(
			guideOutcomeViolations(
				"docs/guides/new.md",
				"```ts\nconst myOutcome = ok(1);\nconst OutcomeValue = myOutcome;\n```",
			),
		).toEqual([]);
	});

	test("the actual guide tree follows the policy", async () => {
		const root = resolve(import.meta.dir, "..");
		const violations: string[] = [];
		for await (const path of new Glob("docs/guides/**/*.md").scan({
			cwd: root,
		})) {
			violations.push(
				...guideOutcomeViolations(
					path,
					await Bun.file(resolve(root, path)).text(),
				),
			);
		}
		expect(violations).toEqual([]);
	});
});
