import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { buildManifest, extractTitle, stripFirstH1 } from "./content";
import {
	docsInput,
	edition,
	makeTempRepo,
	navigation,
	removeTempRepo,
} from "./fixtures";

const TREE = {
	"docs/README.md": "# Kore documentation\n\nStart here.\n",
	"docs/api/README.md": "# API reference\n\nGenerated.\n",
	"docs/api/flow.md": "# flow\n\nBody.\n",
	"docs/guides/error-handling-patterns.md": "# Error handling\n\nBody.\n",
	"docs/commit_convention.md": "# Commit convention\n\nBody.\n",
	"docs/assets/diagram.svg": "<svg></svg>",
};

describe("buildManifest", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo(TREE);
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test.each([
		{ file: "docs/README.md", staged: "_index.md", route: "/next/" },
		{
			file: "docs/api/README.md",
			staged: "api/_index.md",
			route: "/next/api/",
		},
		{
			file: "docs/api/flow.md",
			staged: "api/flow.md",
			route: "/next/api/flow/",
		},
		{
			file: "docs/commit_convention.md",
			staged: "commit_convention.md",
			route: "/next/commit_convention/",
		},
	])("maps $file to $route", ({ file, staged, route }) => {
		const manifest = buildManifest(edition(), docsInput(root));

		const page = manifest.byAbsPath.get(resolve(root, file));
		expect(page?.stagedPath).toBe(staged);
		expect(page?.route).toBe(route);
	});

	test("uses the first H1 as the default title", () => {
		const manifest = buildManifest(edition(), docsInput(root));

		expect(
			manifest.byAbsPath.get(resolve(root, "docs/api/flow.md"))?.title,
		).toBe("flow");
	});

	test("navigation metadata overrides the extracted title and weight", () => {
		const manifest = buildManifest(
			edition(),
			docsInput(root, {
				navigation: navigation({
					pages: [{ path: "api/flow.md", title: "flow tier", weight: 5 }],
				}),
			}),
		);

		const page = manifest.byAbsPath.get(resolve(root, "docs/api/flow.md"));
		expect(page?.title).toBe("flow tier");
		expect(page?.weight).toBe(5);
	});

	test("synthesizes an index for a directory without a README", () => {
		const manifest = buildManifest(
			edition(),
			docsInput(root, {
				navigation: navigation({
					sections: [{ path: "guides", title: "Guides", weight: 30 }],
				}),
			}),
		);

		const index = manifest.indexByDir.get(resolve(root, "docs/guides"));
		expect(index?.stagedPath).toBe("guides/_index.md");
		expect(index?.route).toBe("/next/guides/");
		expect(index?.title).toBe("Guides");
		expect(index?.origin).toBe("generated");
		expect(index?.body).toContain(
			"[Error handling](/next/guides/error-handling-patterns/)",
		);
	});

	test("does not synthesize an index when a README exists", () => {
		const manifest = buildManifest(edition(), docsInput(root));

		const index = manifest.indexByDir.get(resolve(root, "docs/api"));
		expect(index?.origin).toBe("docs");
	});

	test("collects non-Markdown files as assets with edition routes", () => {
		const manifest = buildManifest(edition(), docsInput(root));

		const asset = manifest.byAssetAbsPath.get(
			resolve(root, "docs/assets/diagram.svg"),
		);
		expect(asset?.staticPath).toBe("assets/docs/assets/diagram.svg");
		expect(asset?.route).toBe("/next/assets/docs/assets/diagram.svg");
	});

	test("records a raw Markdown route for every source page", () => {
		const manifest = buildManifest(edition(), docsInput(root));

		expect(
			manifest.byAbsPath.get(resolve(root, "docs/api/flow.md"))?.rawRoute,
		).toBe("/next/raw/docs/api/flow.md");
	});

	test.each([
		{ prefix: "/", route: "/api/flow/" },
		{ prefix: "/v/0.7.0/", route: "/v/0.7.0/api/flow/" },
		{ prefix: "/next/", route: "/next/api/flow/" },
	])("derives routes under prefix $prefix", ({ prefix, route }) => {
		const manifest = buildManifest(edition({ prefix }), docsInput(root));

		expect(
			manifest.byAbsPath.get(resolve(root, "docs/api/flow.md"))?.route,
		).toBe(route);
	});

	test("captures root documents at their own routes", () => {
		const manifest = buildManifest(
			edition(),
			docsInput(root, {
				rootDocs: [
					{
						absPath: resolve(root, "README.md"),
						slug: "readme",
						title: "Package README",
						weight: 2,
					},
				],
			}),
		);

		const page = manifest.byAbsPath.get(resolve(root, "README.md"));
		expect(page?.route).toBe("/next/readme/");
		expect(page?.origin).toBe("root");
	});

	test("fails when the documentation root has no README", () => {
		const bare = makeTempRepo({ "docs/api/flow.md": "# flow\n" });

		expect(() => buildManifest(edition(), docsInput(bare))).toThrow(
			/no home page/,
		);

		removeTempRepo(bare);
	});
});

describe("title helpers", () => {
	test.each([
		{ src: "# Title\n\nBody", expected: "Title" },
		{ src: "---\ntitle: x\n---\n# Real\n", expected: "Real" },
		{ src: "## Only H2\n", expected: null },
		{ src: "# Trailing #\n", expected: "Trailing" },
	])("extracts $expected", ({ src, expected }) => {
		expect(extractTitle(src)).toBe(expected);
	});

	test("removes only the first H1", () => {
		expect(stripFirstH1("# A\n\nBody\n\n# B\n")).toBe("Body\n\n# B\n");
	});

	test("removes an H1 that follows other content", () => {
		expect(stripFirstH1("Breadcrumb\n\n# A\n\nBody\n")).toBe(
			"Breadcrumb\n\nBody\n",
		);
	});

	test("leaves a document without an H1 untouched", () => {
		expect(stripFirstH1("Body\n\n## B\n")).toBe("Body\n\n## B\n");
	});

	test("ignores an H1 inside a fenced code block", () => {
		const src = "Intro\n\n```md\n# Not a heading\n```\n\n# Real\n\nBody\n";

		expect(stripFirstH1(src)).toBe(
			"Intro\n\n```md\n# Not a heading\n```\n\nBody\n",
		);
	});
});
