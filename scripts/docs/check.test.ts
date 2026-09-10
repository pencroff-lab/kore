import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	checkCanonicalLinks,
	checkRenderedSite,
	classifyArchiveMembers,
} from "./check";
import { makeTempRepo, removeTempRepo } from "./fixtures";

describe("checkCanonicalLinks", () => {
	let root: string;

	afterEach(() => {
		removeTempRepo(root);
	});

	test("passes when every local link resolves inside the shipped set", async () => {
		root = makeTempRepo({
			"docs/README.md": "# Docs\n\n[api](api/flow.md)\n",
			"docs/api/flow.md": "# flow\n\n[home](../README.md)\n",
			"llms.txt": "# kore\n\n- [flow](docs/api/flow.md)\n",
		});

		const result = await checkCanonicalLinks(root, [
			join(root, "docs"),
			join(root, "llms.txt"),
		]);

		expect(result.ok).toBe(true);
		expect(result.details).toEqual([]);
	});

	test("reports a deliberately missing Markdown target with file and line", async () => {
		root = makeTempRepo({
			"docs/README.md": "# Docs\n\nIntro.\n\n[gone](api/absent.md)\n",
		});

		const result = await checkCanonicalLinks(root, [join(root, "docs")]);

		expect(result.ok).toBe(false);
		expect(result.details).toHaveLength(1);
		expect(result.details[0]).toContain("docs/README.md:5");
		expect(result.details[0]).toContain('missing target "api/absent.md"');
	});

	test("reports a link into unshipped source", async () => {
		root = makeTempRepo({
			"docs/README.md": "# Docs\n\n[impl](../src/flow/flow.ts)\n",
			"src/flow/flow.ts": "export const x = 1;\n",
		});

		const result = await checkCanonicalLinks(root, [join(root, "docs")]);

		expect(result.ok).toBe(false);
		expect(result.details[0]).toContain("does not ship");
	});

	test("accepts external and fragment-only destinations", async () => {
		root = makeTempRepo({
			"docs/README.md":
				"# Docs\n\n[x](https://example.com) [y](#section) [z](mailto:a@b.c)\n",
		});

		const result = await checkCanonicalLinks(root, [join(root, "docs")]);

		expect(result.ok).toBe(true);
	});

	test("ignores links inside fenced code", async () => {
		root = makeTempRepo({
			"docs/README.md": "# Docs\n\n```md\n[gone](./absent.md)\n```\n",
		});

		const result = await checkCanonicalLinks(root, [join(root, "docs")]);

		expect(result.ok).toBe(true);
	});
});

describe("classifyArchiveMembers", () => {
	const complete = [
		"package/package.json",
		"package/llms.txt",
		"package/CHANGELOG.md",
		"package/docs/README.md",
		"package/docs/api/README.md",
		"package/docs/api/flow.md",
		"package/docs/examples/README.md",
		"package/docs/guides/flow-operation-flows.md",
		"package/dist/esm/index.js",
	];

	test("accepts an archive with the documented consumer set", () => {
		expect(classifyArchiveMembers(complete)).toEqual([]);
	});

	test("reports missing consumer documentation", () => {
		const without = complete.filter((m) => m !== "package/llms.txt");

		expect(classifyArchiveMembers(without)).toEqual([
			"archive is missing package/llms.txt",
		]);
	});

	test.each([
		{ leak: "package/site/hugo.yaml", what: "site configuration" },
		{
			leak: "package/site/versions/0.7.0/docs/api/flow.md",
			what: "a snapshot",
		},
		{ leak: "package/site/archived/README.md", what: "the archive" },
		{ leak: "package/build/docs-site/public/index.html", what: "built HTML" },
		{ leak: "package/docs/api/flow.html", what: "generated HTML" },
		{ leak: "package/scripts/docs.sh.ts", what: "site tooling" },
	])("reports a leaked $what", ({ leak }) => {
		const problems = classifyArchiveMembers([...complete, leak]);

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain(leak);
		expect(problems[0]).toContain("must not ship");
	});
});

describe("checkRenderedSite", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo({
			"site/index.html":
				'<html><body><a href="/api/">API</a><a href="/api/#ok">ok</a></body></html>',
			"site/api/index.html":
				'<html><body><h2 id="ok">ok</h2><a href="/">home</a></body></html>',
		});
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("passes when every internal link and fragment resolves", async () => {
		const result = await checkRenderedSite(join(root, "site"));

		expect(result.ok).toBe(true);
		expect(result.details).toEqual([]);
	});

	test("reports a broken internal link", async () => {
		await Bun.write(
			join(root, "site/index.html"),
			'<html><body><a href="/gone/">gone</a></body></html>',
		);

		const result = await checkRenderedSite(join(root, "site"));

		expect(result.ok).toBe(false);
		expect(result.details[0]).toContain("broken internal link /gone/");
	});

	test("reports a fragment the target page does not define", async () => {
		await Bun.write(
			join(root, "site/index.html"),
			'<html><body><a href="/api/#nope">nope</a></body></html>',
		);

		const result = await checkRenderedSite(join(root, "site"));

		expect(result.ok).toBe(false);
		expect(result.details[0]).toContain("missing fragment /api/#nope");
	});

	test("accepts a fragment declared by a name attribute", async () => {
		await Bun.write(
			join(root, "site/api/index.html"),
			'<html><body><a name="legacy"></a></body></html>',
		);
		await Bun.write(
			join(root, "site/index.html"),
			'<html><body><a href="/api/#legacy">legacy</a></body></html>',
		);

		const result = await checkRenderedSite(join(root, "site"));

		expect(result.ok).toBe(true);
	});

	test("ignores external links", async () => {
		await Bun.write(
			join(root, "site/index.html"),
			'<html><body><a href="https://example.com/#x">ext</a></body></html>',
		);

		const result = await checkRenderedSite(join(root, "site"));

		expect(result.ok).toBe(true);
	});

	test("resolves a link to a non-HTML asset that exists", async () => {
		await Bun.write(join(root, "site/llms.txt"), "# kore\n");
		await Bun.write(
			join(root, "site/index.html"),
			'<html><body><a href="/llms.txt">agents</a></body></html>',
		);

		const result = await checkRenderedSite(join(root, "site"));

		expect(result.ok).toBe(true);
	});
});
