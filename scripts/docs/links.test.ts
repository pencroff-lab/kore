import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type { ContentManifest } from "./content";
import { buildManifest } from "./content";
import {
	docsInput,
	edition,
	makeTempRepo,
	navigation,
	removeTempRepo,
} from "./fixtures";
import { rewriteMarkdown, splitDestination } from "./links";

const TREE = {
	"README.md": "# Kore\n",
	"CHANGELOG.md": "# Changelog\n",
	"src/flow/flow.ts": "export const ok = 1;\n",
	"docs/README.md": "# Kore documentation\n",
	"docs/api/README.md": "# API reference\n",
	"docs/api/flow.md": "# flow\n",
	"docs/api/err.md": "# Err\n",
	"docs/guides/error-handling-patterns.md": "# Error handling\n",
	"docs/guides/with space.md": "# Spaced\n",
	"docs/assets/diagram.svg": "<svg></svg>",
};

const SOURCE_BASE = "https://github.com/pencroff-lab/kore/blob/v0.7.0/";

describe("rewriteMarkdown", () => {
	let root: string;
	let manifest: ContentManifest;

	const rewrite = (source: string, from = "docs/api/flow.md") =>
		rewriteMarkdown(source, {
			pageAbsPath: resolve(root, from),
			manifest,
			repoRoot: root,
			sourceLinkBase: SOURCE_BASE,
		});

	beforeEach(() => {
		root = makeTempRepo(TREE);
		manifest = buildManifest(
			edition(),
			docsInput(root, {
				navigation: navigation({
					sections: [{ path: "guides", title: "Guides" }],
				}),
				rootDocs: [
					{
						absPath: resolve(root, "README.md"),
						slug: "readme",
						title: "README",
						weight: 2,
					},
					{
						absPath: resolve(root, "CHANGELOG.md"),
						slug: "changelog",
						title: "Changelog",
						weight: 3,
					},
				],
			}),
		);
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test.each([
		{ name: "sibling page", src: "[e](./err.md)", out: "[e](/next/api/err/)" },
		{
			name: "fragment",
			src: "[e](err.md#from)",
			out: "[e](/next/api/err/#from)",
		},
		{
			name: "parent path",
			src: "[g](../guides/error-handling-patterns.md)",
			out: "[g](/next/guides/error-handling-patterns/)",
		},
		{
			name: "directory README",
			src: "[i](README.md)",
			out: "[i](/next/api/)",
		},
		{
			name: "directory link",
			src: "[g](../guides/)",
			out: "[g](/next/guides/)",
		},
		{
			name: "image",
			src: "![d](../assets/diagram.svg)",
			out: "![d](/next/assets/docs/assets/diagram.svg)",
		},
		{
			name: "captured root README",
			src: "[r](../../README.md#migrating)",
			out: "[r](/next/readme/#migrating)",
		},
		{
			name: "captured changelog",
			src: "[c](../../CHANGELOG.md)",
			out: "[c](/next/changelog/)",
		},
		{
			name: "query and fragment",
			src: "[e](./err.md?x=1#from)",
			out: "[e](/next/api/err/?x=1#from)",
		},
		{
			name: "reference definition",
			src: "[x][r]\n\n[r]: ./err.md\n",
			out: "[x][r]\n\n[r]: /next/api/err/\n",
		},
	])("rewrites a $name", ({ src, out }) => {
		const result = rewrite(src);

		expect(result.text).toBe(out);
		expect(result.diagnostics).toEqual([]);
	});

	test("resolves a percent-encoded destination to its urlized route", () => {
		const result = rewrite("[s](../guides/with%20space.md)");

		expect(result.text).toBe("[s](/next/guides/with-space/)");
		expect(result.diagnostics).toEqual([]);
	});

	test("resolves an angle-bracketed destination containing a space", () => {
		const result = rewrite("[s](<../guides/with space.md>)");

		expect(result.text).toBe("[s](</next/guides/with-space/>)");
	});

	test("leaves external destinations untouched", () => {
		const src = "[a](https://example.com/x) [b](mailto:a@b.c) [c](#local)";

		expect(rewrite(src).text).toBe(src);
	});

	test("converts an unshipped repository file to a tagged source link", () => {
		const result = rewrite("[src](../../src/flow/flow.ts#L1)");

		expect(result.text).toBe(`[src](${SOURCE_BASE}src/flow/flow.ts#L1)`);
		expect(result.diagnostics).toEqual([]);
	});

	test.each([
		"LICENSE",
		"site/README.md",
		"site/toolchain.json",
	])("links an uncopied snapshot file to its tagged source: %s", (target) => {
		const result = rewrite(`[source](${target})`, "README.md");

		expect(result.text).toBe(`[source](${SOURCE_BASE}${target})`);
		expect(result.diagnostics).toEqual([]);
	});

	test("reports a missing local target with file and line", () => {
		const result = rewrite("intro\n\n[gone](./missing.md)\n");

		expect(result.text).toContain("./missing.md");
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]).toMatchObject({
			line: 3,
			destination: "./missing.md",
			reason: "target does not exist",
		});
	});

	test("reports an unshipped file when no source link base is configured", () => {
		const result = rewriteMarkdown("[s](../../src/flow/flow.ts)", {
			pageAbsPath: resolve(root, "docs/api/flow.md"),
			manifest,
			repoRoot: root,
			sourceLinkBase: null,
		});

		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.reason).toContain(
			"outside the documented set",
		);
	});

	test("never rewrites .md strings inside code fences", () => {
		const src = '```ts\nconst p = "./err.md";\n```\n\n[e](./err.md)\n';

		expect(rewrite(src).text).toBe(
			'```ts\nconst p = "./err.md";\n```\n\n[e](/next/api/err/)\n',
		);
	});

	test("prefixes an origin when one is supplied", () => {
		const result = rewriteMarkdown("[e](./err.md)", {
			pageAbsPath: resolve(root, "docs/api/flow.md"),
			manifest,
			repoRoot: root,
			sourceLinkBase: SOURCE_BASE,
			origin: "https://kore.lab.pencroff.com",
		});

		expect(result.text).toBe(
			"[e](https://kore.lab.pencroff.com/next/api/err/)",
		);
	});

	test("does not prefix the origin onto an external source citation", () => {
		const result = rewriteMarkdown("[s](../../src/flow/flow.ts)", {
			pageAbsPath: resolve(root, "docs/api/flow.md"),
			manifest,
			repoRoot: root,
			sourceLinkBase: SOURCE_BASE,
			origin: "https://kore.lab.pencroff.com",
		});

		expect(result.text).toBe(`[s](${SOURCE_BASE}src/flow/flow.ts)`);
	});

	test.each([
		{ prefix: "/", out: "[e](/api/err/)" },
		{ prefix: "/v/0.7.0/", out: "[e](/v/0.7.0/api/err/)" },
	])("resolves under prefix $prefix", ({ prefix, out }) => {
		const scoped = buildManifest(edition({ prefix }), docsInput(root));

		const result = rewriteMarkdown("[e](./err.md)", {
			pageAbsPath: resolve(root, "docs/api/flow.md"),
			manifest: scoped,
			repoRoot: root,
			sourceLinkBase: SOURCE_BASE,
		});

		expect(result.text).toBe(out);
	});
});

describe("splitDestination", () => {
	test.each([
		{ src: "a.md", path: "a.md", query: "", fragment: "" },
		{ src: "a.md#f", path: "a.md", query: "", fragment: "#f" },
		{ src: "a.md?q=1", path: "a.md", query: "?q=1", fragment: "" },
		{ src: "a.md?q=1#f", path: "a.md", query: "?q=1", fragment: "#f" },
		{ src: "#f", path: "", query: "", fragment: "#f" },
	])("splits $src", ({ src, path, query, fragment }) => {
		expect(splitDestination(src)).toEqual({ path, query, fragment });
	});
});

describe("root-absolute destinations", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo(TREE);
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("passes an already-final site route through unchanged", () => {
		const manifest = buildManifest(edition(), docsInput(root));

		const result = rewriteMarkdown("[a](/archived/) [b](/next/api/)", {
			pageAbsPath: resolve(root, "docs/README.md"),
			manifest,
			repoRoot: root,
			sourceLinkBase: SOURCE_BASE,
		});

		expect(result.text).toBe("[a](/archived/) [b](/next/api/)");
		expect(result.diagnostics).toEqual([]);
	});

	test("prefixes the origin onto a final site route", () => {
		const manifest = buildManifest(edition(), docsInput(root));

		const result = rewriteMarkdown("[a](/archived/)", {
			pageAbsPath: resolve(root, "docs/README.md"),
			manifest,
			repoRoot: root,
			sourceLinkBase: SOURCE_BASE,
			origin: "https://kore.lab.pencroff.com",
		});

		expect(result.text).toBe("[a](https://kore.lab.pencroff.com/archived/)");
	});
});
