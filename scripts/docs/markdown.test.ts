import { describe, expect, test } from "bun:test";
import type { Destination } from "./markdown";
import { findDestinations, rewriteDestinations } from "./markdown";

describe("findDestinations", () => {
	test.each([
		{ name: "inline link", src: "[a](./x.md)", url: "./x.md" },
		{ name: "image", src: "![a](../img/y.svg)", url: "../img/y.svg" },
		{ name: "fragment", src: "[a](./x.md#top)", url: "./x.md#top" },
		{ name: "query", src: "[a](./x.md?v=1#t)", url: "./x.md?v=1#t" },
		{ name: "title", src: '[a](./x.md "T")', url: "./x.md" },
		{ name: "angled", src: "[a](<./a b.md>)", url: "./a b.md" },
		{ name: "encoded", src: "[a](./a%20b.md)", url: "./a%20b.md" },
		{ name: "definition", src: "[r]: ./x.md", url: "./x.md" },
		{ name: "nested label", src: "[a [b] c](./x.md)", url: "./x.md" },
		{ name: "parens in path", src: "[a](./x(1).md)", url: "./x(1).md" },
	])("reads the $name destination", ({ src, url }) => {
		const found = findDestinations(src);

		expect(found).toHaveLength(1);
		const first = found[0] as Destination;
		expect(first.value).toBe(url);
		expect(src.slice(first.start, first.end)).toBe(first.raw);
	});

	test("ignores destinations inside fenced code", () => {
		const src = '```ts\nconst s = "[a](./x.md)";\n```\n\n[b](./y.md)\n';

		const found = findDestinations(src);

		expect(found.map((d) => d.value)).toEqual(["./y.md"]);
	});

	test("ignores destinations inside code spans", () => {
		const found = findDestinations("Use `[a](./x.md)` here. [b](./y.md)");

		expect(found.map((d) => d.value)).toEqual(["./y.md"]);
	});

	test("ignores indented code blocks", () => {
		const found = findDestinations("    [a](./x.md)\n\n[b](./y.md)\n");

		expect(found.map((d) => d.value)).toEqual(["./y.md"]);
	});

	test("ignores autolinks and reference usages", () => {
		const src = "<https://example.com> and [text][ref].\n\n[ref]: ./z.md\n";

		const found = findDestinations(src);

		expect(found.map((d) => d.kind)).toEqual(["definition"]);
		expect(found[0]?.value).toBe("./z.md");
	});

	test("reports kinds and line numbers", () => {
		const src = "line one\n\n[a](./x.md)\n\n![b](./y.png)\n";

		const found = findDestinations(src);

		expect(found.map((d) => [d.kind, d.line])).toEqual([
			["link", 3],
			["image", 5],
		]);
	});

	test("unescapes destinations for lookup but keeps raw text", () => {
		const found = findDestinations("[a](./a\\_b.md)");

		expect(found[0]?.raw).toBe("./a\\_b.md");
		expect(found[0]?.value).toBe("./a_b.md");
	});
});

describe("rewriteDestinations", () => {
	test("replaces only the destination span", () => {
		const src = '# T\n\nSee [flow](../api/flow.md#ok "API").\n';

		const out = rewriteDestinations(src, () => "/next/api/flow/#ok");

		expect(out).toBe('# T\n\nSee [flow](/next/api/flow/#ok "API").\n');
	});

	test("leaves the source unchanged when the callback returns null", () => {
		const src = "[a](./x.md) and [b](./y.md)\n";

		const out = rewriteDestinations(src, (d) =>
			d.value === "./x.md" ? "/x/" : null,
		);

		expect(out).toBe("[a](/x/) and [b](./y.md)\n");
	});

	test("rewrites several destinations on one line", () => {
		const out = rewriteDestinations("[a](./a.md) [b](./b.md)", (d) =>
			d.value.replace("./", "/").replace(".md", "/"),
		);

		expect(out).toBe("[a](/a/) [b](/b/)");
	});

	test("rewrites inside angle brackets without the brackets", () => {
		const out = rewriteDestinations("[a](<./a b.md>)", () => "/a-b/");

		expect(out).toBe("[a](</a-b/>)");
	});

	test("rewrites reference definitions", () => {
		const out = rewriteDestinations("[x][r]\n\n[r]: ./p.md\n", () => "/p/");

		expect(out).toBe("[x][r]\n\n[r]: /p/\n");
	});

	test("never touches fenced code containing markdown links", () => {
		const src = "```md\n[a](./x.md)\n```\n[b](./x.md)\n";

		const out = rewriteDestinations(src, () => "/x/");

		expect(out).toBe("```md\n[a](./x.md)\n```\n[b](/x/)\n");
	});
});
