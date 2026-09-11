import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SitePaths } from "./build";
import { buildSite, publishedVersions } from "./build";
import { paths } from "./config";
import { makeTempRepo, removeTempRepo } from "./fixtures";
import { readManifest } from "./manifest";
import type { SnapshotOptions } from "./snapshot";
import { createSnapshot } from "./snapshot";

// A whole site build runs Hugo three to five times; give it room.
const BUILD_TIMEOUT = 120_000;

const HUGO_BASE = `title: "kore fixture"
languageCode: en-us
disableKinds: ["taxonomy", "term", "rss"]
module:
  imports:
    - path: github.com/imfing/hextra
markup:
  goldmark:
    renderer:
      unsafe: true
params:
  search:
    enable: true
    type: flexsearch
`;

const CATALOG = `schemaVersion: 1
development:
  label: "0.9.0 (unreleased)"
  sourceRef: "main"
releases: []
`;

function fixtureTree(marker: string): Record<string, string> {
	return {
		"docs/README.md": `# Kore ${marker}\n\nSee [flow](api/flow.md) and [guide](guides/a.md).\n`,
		"docs/api/README.md": "# API\n\nIndex.\n",
		"docs/api/flow.md": `# flow\n\nMarker: ${marker}. Back to [API](README.md).\n`,
		"docs/guides/a.md": "# Guide A\n\nSee [flow](../api/flow.md#flow).\n",
		"llms.txt": `# kore\n\n> Fixture ${marker}.\n\n- [flow](docs/api/flow.md)\n`,
		"README.md": "# kore\n\nPackage readme.\n",
		"CHANGELOG.md": "# Changelog\n\n## 0.8.0\n",
		"site/hugo.yaml": HUGO_BASE,
		"site/navigation.yaml":
			"schemaVersion: 1\nsections:\n  - path: guides\n    title: Guides\npages: []\n",
		"site/versions.yaml": CATALOG,
		"site/published.json":
			'{"schemaVersion":1,"latestStable":null,"releases":[]}',
		"site/archived/README.md":
			"# Archived releases\n\n## v0.6.0 — 2026-09-01\n\nOld release.\n",
		"site/assets/css/custom.css": ":root { --fixture-accent: #126c8a; }\n",
	};
}

describe("combined site build", () => {
	let root: string;

	const sitePaths = (): Partial<SitePaths> => ({
		repoRoot: root,
		siteDir: join(root, "site"),
		docsDir: join(root, "docs"),
		llmsTxt: join(root, "llms.txt"),
		readme: join(root, "README.md"),
		changelog: join(root, "CHANGELOG.md"),
		workRoot: join(root, "build"),
		output: join(root, "build", "public"),
	});

	const snapshotOptions = (version: string): SnapshotOptions => ({
		version,
		expectedVersion: version,
		repoRoot: root,
		siteDir: join(root, "site"),
		docsDir: join(root, "docs"),
		llmsTxt: join(root, "llms.txt"),
		readme: join(root, "README.md"),
		changelog: join(root, "CHANGELOG.md"),
		navigation: join(root, "site/navigation.yaml"),
	});

	async function markPublished(versions: string[], latest: string | null) {
		await Bun.write(
			join(root, "site/published.json"),
			JSON.stringify({
				schemaVersion: 1,
				latestStable: latest,
				releases: versions.map((version) => ({
					version,
					sourceCommit: "0".repeat(40),
					snapshotDigest: "fixture",
					registryIntegrity: "sha512-fixture",
					distTag: "latest",
				})),
			}),
		);
	}

	beforeEach(() => {
		root = makeTempRepo(fixtureTree("first"));
		// The fixture resolves the theme through the real pinned module files.
		for (const name of ["go.mod", "go.sum"]) {
			writeFileSync(
				join(root, "site", name),
				readFileSync(join(paths.siteDir, name), "utf8"),
			);
		}
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test(
		"renders the overview, archive and development editions with no stable route",
		async () => {
			const result = await buildSite({
				sitePaths: sitePaths(),
				version: "0.9.0",
				origin: "http://localhost:4173",
			});

			const out = result.output;
			expect(existsSync(join(out, "index.html"))).toBe(true);
			expect(existsSync(join(out, "archived/index.html"))).toBe(true);
			expect(existsSync(join(out, "next/index.html"))).toBe(true);
			expect(existsSync(join(out, "v"))).toBe(false);
			expect(result.latestStable).toBeNull();

			const home = await Bun.file(join(out, "index.html")).text();
			expect(home).toContain(
				"No stable documentation edition is published yet",
			);
			const cssDir = join(out, "next/css/compiled");
			const stylesheet = await Bun.file(
				join(cssDir, readdirSync(cssDir)[0] ?? "missing.css"),
			).text();
			expect(stylesheet).toContain("--fixture-accent:#126c8a");
		},
		BUILD_TIMEOUT,
	);

	test(
		"keeps both published snapshots and serves the latest at the root",
		async () => {
			await createSnapshot(snapshotOptions("0.8.0"));
			const first = await readManifest(join(root, "site/versions/0.8.0"));

			writeFileSync(
				join(root, "docs/api/flow.md"),
				"# flow\n\nMarker: second. Back to [API](README.md).\n",
			);
			await createSnapshot(snapshotOptions("0.8.1"));

			// The earlier snapshot is untouched by the later one.
			expect(
				(await readManifest(join(root, "site/versions/0.8.0"))).digest,
			).toBe(first.digest);

			await markPublished(["0.8.0", "0.8.1"], "0.8.1");

			const result = await buildSite({
				sitePaths: sitePaths(),
				version: "0.9.0",
				origin: "http://localhost:4173",
			});

			expect(result.published).toEqual(["0.8.1", "0.8.0"]);
			expect(result.latestStable).toBe("0.8.1");

			for (const version of ["0.8.0", "0.8.1"]) {
				expect(
					existsSync(join(result.output, `v/${version}/api/flow/index.html`)),
				).toBe(true);
			}

			const v080 = await Bun.file(
				join(result.output, "v/0.8.0/api/flow/index.html"),
			).text();
			const v081 = await Bun.file(
				join(result.output, "v/0.8.1/api/flow/index.html"),
			).text();
			const rootFlow = await Bun.file(
				join(result.output, "api/flow/index.html"),
			).text();

			expect(v080).toContain("Marker: first");
			expect(v081).toContain("Marker: second");
			// The root serves the latest stable snapshot, not the development docs.
			expect(rootFlow).toContain("Marker: second");
			expect(existsSync(join(result.output, "next/api/flow/index.html"))).toBe(
				true,
			);
			expect(existsSync(join(result.output, "archived/index.html"))).toBe(true);
		},
		BUILD_TIMEOUT,
	);

	test(
		"keeps each edition's links and search index inside that edition",
		async () => {
			await createSnapshot(snapshotOptions("0.8.0"));
			await markPublished(["0.8.0"], "0.8.0");

			const result = await buildSite({
				sitePaths: sitePaths(),
				version: "0.9.0",
				origin: "http://localhost:4173",
			});

			const versioned = await Bun.file(
				join(result.output, "v/0.8.0/api/flow/index.html"),
			).text();
			expect(versioned).toContain("/v/0.8.0/api/");
			expect(versioned).not.toContain('href="/next/api/');

			const index = await Bun.file(
				join(result.output, "v/0.8.0/en.search-data.json"),
			).json();
			for (const key of Object.keys(index)) {
				expect(key.startsWith("/v/0.8.0/")).toBe(true);
			}

			const nextIndex = await Bun.file(
				join(result.output, "next/en.search-data.json"),
			).json();
			for (const key of Object.keys(nextIndex)) {
				expect(key.startsWith("/next/")).toBe(true);
			}
		},
		BUILD_TIMEOUT,
	);

	test(
		"omits an unpublished snapshot until it is recorded as published",
		async () => {
			await createSnapshot(snapshotOptions("0.8.0"));

			const before = await buildSite({
				sitePaths: sitePaths(),
				version: "0.9.0",
				origin: "http://localhost:4173",
			});

			expect(before.published).toEqual([]);
			expect(existsSync(join(before.output, "v/0.8.0"))).toBe(false);

			await markPublished(["0.8.0"], "0.8.0");
			const after = await buildSite({
				sitePaths: sitePaths(),
				version: "0.9.0",
				origin: "http://localhost:4173",
			});

			expect(after.published).toEqual(["0.8.0"]);
			expect(existsSync(join(after.output, "v/0.8.0/index.html"))).toBe(true);
		},
		BUILD_TIMEOUT,
	);

	test(
		"refreshes all development metadata after publication and the next version bump",
		async () => {
			// Reproduce an old release catalog even after its feature branch is gone.
			writeFileSync(
				join(root, "site/versions.yaml"),
				CATALOG.replace("0.9.0", "0.8.0").replace(
					'sourceRef: "main"',
					'sourceRef: "old-feature"',
				),
			);
			const citation =
				"https://github.com/pencroff-lab/kore/blob/v0.8.0/src/flow/flow.ts#L1";
			writeFileSync(
				join(root, "docs/api/flow.md"),
				`# flow\n\n[Source](${citation})\n`,
			);
			await createSnapshot(snapshotOptions("0.8.0"));
			writeFileSync(
				join(root, "site/versions.yaml"),
				readFileSync(join(root, "site/versions.yaml"), "utf8").replace(
					"releases:",
					'development:\n  label: "0.8.0 (unreleased)"\n  sourceRef: "old-feature"\n\nreleases:',
				),
			);
			const snapshotBefore = readFileSync(
				join(root, "site/versions/0.8.0/release.json"),
				"utf8",
			);
			const catalogBefore = readFileSync(
				join(root, "site/versions.yaml"),
				"utf8",
			);
			// An actual detached checkout models GitHub Actions and requires no
			// environment-variable assumptions about a PR or former feature branch.
			for (const args of [
				["init"],
				[
					"-c",
					"user.name=Fixture",
					"-c",
					"user.email=fixture@example.com",
					"commit",
					"--allow-empty",
					"-m",
					"fixture",
				],
				["checkout", "--detach"],
			]) {
				expect(Bun.spawnSync(["git", ...args], { cwd: root }).exitCode).toBe(0);
			}
			const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root })
				.stdout.toString()
				.trim();
			const options = {
				sitePaths: sitePaths(),
				version: "0.8.0",
				origin: "http://localhost:4173",
			};
			await buildSite(options);
			expect(
				readFileSync(join(root, "build/public/next/index.html"), "utf8"),
			).toContain("0.8.0 (unreleased)");

			await markPublished(["0.8.0"], "0.8.0");
			await buildSite(options);
			for (const path of [
				"index.html",
				"next/index.html",
				"v/0.8.0/index.html",
				"archived/index.html",
			]) {
				const html = readFileSync(join(root, "build/public", path), "utf8");
				expect(html).toContain("Next (unreleased)");
				expect(html).not.toContain("0.8.0 (unreleased)");
			}
			const config = await Bun.file(
				join(root, "build/editions/next/hugo.json"),
			).json();
			expect(config.params.edition).toMatchObject({
				version: "next",
				released: false,
				sourceRef: commit,
			});
			expect(config.params.banner.message).toContain("next release");
			const llms = readFileSync(
				join(root, "build/public/next/llms.txt"),
				"utf8",
			);
			expect(llms).toContain("Next (unreleased)");
			expect(llms).not.toContain("unreleased version 0.8.0");
			expect(
				readFileSync(
					join(root, "build/public/next/api/flow/index.html"),
					"utf8",
				),
			).toContain(`/blob/${commit}/src/flow/flow.ts#L1`);
			expect(
				readFileSync(
					join(root, "build/public/v/0.8.0/api/flow/index.html"),
					"utf8",
				),
			).toContain(citation);
			expect(
				readFileSync(join(root, "build/public/llms.txt"), "utf8"),
			).toContain("released version 0.8.0");
			expect(readFileSync(join(root, "docs/api/flow.md"), "utf8")).toContain(
				citation,
			);
			expect(
				readFileSync(join(root, "site/versions/0.8.0/release.json"), "utf8"),
			).toBe(snapshotBefore);
			expect(readFileSync(join(root, "site/versions.yaml"), "utf8")).toBe(
				catalogBefore,
			);

			await buildSite({ ...options, version: "0.9.0" });
			expect(
				readFileSync(join(root, "build/public/next/index.html"), "utf8"),
			).toContain("0.9.0 (unreleased)");
			expect(
				readFileSync(join(root, "build/public/next/llms.txt"), "utf8"),
			).toContain("unreleased version 0.9.0");
		},
		BUILD_TIMEOUT,
	);

	test(
		"retains the previous site when a build fails",
		async () => {
			const good = await buildSite({
				sitePaths: sitePaths(),
				version: "0.9.0",
				origin: "http://localhost:4173",
			});
			expect(existsSync(join(good.output, "index.html"))).toBe(true);

			writeFileSync(
				join(root, "docs/api/flow.md"),
				"# flow\n\nBroken [link](./does-not-exist.md).\n",
			);

			await expect(
				buildSite({
					sitePaths: sitePaths(),
					version: "0.9.0",
					origin: "http://localhost:4173",
				}),
			).rejects.toThrow(/Unresolved documentation links/);

			expect(existsSync(join(good.output, "index.html"))).toBe(true);
		},
		BUILD_TIMEOUT,
	);
});

describe("publishedVersions", () => {
	const catalog = {
		schemaVersion: 1 as const,
		development: { label: "dev", sourceRef: "main" },
		releases: [
			{ version: "0.7.0", path: "site/versions/0.7.0", sourceRef: "v0.7.0" },
			{ version: "0.7.10", path: "site/versions/0.7.10", sourceRef: "v0.7.10" },
			{ version: "0.7.2", path: "site/versions/0.7.2", sourceRef: "v0.7.2" },
		],
	};

	test("lists only versions recorded in the receipt, newest first", () => {
		const receipt = {
			schemaVersion: 1 as const,
			latestStable: "0.7.10",
			releases: [
				{
					version: "0.7.0",
					sourceCommit: "a",
					snapshotDigest: "d",
					registryIntegrity: "i",
					distTag: "latest",
				},
				{
					version: "0.7.10",
					sourceCommit: "b",
					snapshotDigest: "d",
					registryIntegrity: "i",
					distTag: "latest",
				},
			],
		};

		expect(publishedVersions(catalog, receipt)).toEqual(["0.7.10", "0.7.0"]);
	});

	test("returns nothing when no release is recorded", () => {
		expect(
			publishedVersions(catalog, {
				schemaVersion: 1,
				latestStable: null,
				releases: [],
			}),
		).toEqual([]);
	});
});
