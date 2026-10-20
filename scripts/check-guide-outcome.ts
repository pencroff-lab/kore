import { fromMarkdown } from "mdast-util-from-markdown";

interface MarkdownNode {
	type: string;
	children?: MarkdownNode[];
	position?: {
		start: { offset?: number };
		end: { offset?: number };
	};
}

// Exact prose exceptions; none can suppress an occurrence in a code block.
const proseExceptions: Record<string, readonly string[]> = {
	"docs/guides/error-handling-patterns.md": [
		"> `Outcome` is deprecated and frozen since v0.7.0.",
		"That keeps every catch boundary — `attempt`, `pipe` stages, `Outcome.from` — total.",
		"- [Outcome examples](../examples/outcome.md) — deprecated, frozen class reference",
	],
	"docs/guides/flow-operation-flows.md": [
		"- [Migrating from `Outcome`](../../README.md#migrating-from-outcome) — the class-tier operation map",
	],
	"docs/guides/migration-from-throwing.md": [
		"- [Migrating from `Outcome`](../../README.md#migrating-from-outcome) — the class-tier operation map",
	],
	"docs/guides/tsdoc_guide.md": [
		"| `Outcome.err()` | static factory |",
		"| `Outcome.defaultTo()` | instance method |",
		"| `Outcome.pipe()` | instance method |",
		"| `Outcome.pipeAsync()` | instance method |",
	],
};

/** Reports deprecated guide examples and unapproved prose references. */
export function guideOutcomeViolations(path: string, source: string): string[] {
	const codeRanges: Array<[number, number]> = [];
	const visit = (node: MarkdownNode): void => {
		if (node.type === "code") {
			codeRanges.push([
				node.position?.start.offset ?? 0,
				node.position?.end.offset ?? source.length,
			]);
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(fromMarkdown(source));

	const allowedRanges: Array<[number, number]> = [];
	for (const text of proseExceptions[path] ?? []) {
		let start = source.indexOf(text);
		while (start !== -1) {
			allowedRanges.push([start, start + text.length]);
			start = source.indexOf(text, start + text.length);
		}
	}

	const violations: string[] = [];
	for (const match of source.matchAll(
		/(?<![\p{ID_Continue}$])Outcome(?![\p{ID_Continue}$])/gu,
	)) {
		const offset = match.index;
		const inCode = codeRanges.some(
			([start, end]) => offset >= start && offset < end,
		);
		if (
			!inCode &&
			allowedRanges.some(([start, end]) => offset >= start && offset < end)
		) {
			continue;
		}
		const line = source.slice(0, offset).split("\n").length;
		violations.push(
			`${path}:${line}: ${inCode ? "deprecated Outcome in code block; use flow" : "unapproved Outcome prose reference; add an exact excerpt to proseExceptions in scripts/check-guide-outcome.ts only for deprecation or reference prose"}`,
		);
	}
	return violations;
}
