import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo, removeTempRepo } from "./fixtures";
import { readManifest, verifyAgainstManifest } from "./manifest";
import type { SnapshotOptions } from "./snapshot";
import {
	compareVersions,
	createSnapshot,
	isPrerelease,
	parseVersion,
	verifySnapshots,
} from "./snapshot";

const CATALOG = `schemaVersion: 1
development:
  label: "0.7.0 (unreleased)"
  sourceRef: "main"
releases: []
`;

function tree(marker: string): Record<string, string> {
	return {
		"docs/README.md": `# Docs ${marker}\n`,
		"docs/api/README.md": "# API\n",
		"docs/api/flow.md": `# flow\n\n${marker}\n`,
		"docs/guides/a.md": "# Guide A\n",
		"llms.txt": `# kore ${marker}\n`,
		"README.md": "# kore\n",
		"CHANGELOG.md": "# Changelog\n",
		"site/navigation.yaml": "schemaVersion: 1\nsections: []\npages: []\n",
		"site/versions.yaml": CATALOG,
	};
}

describe("createSnapshot", () => {
	let root: string;

	const options = (version: string): SnapshotOptions => ({
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

	beforeEach(() => {
		root = makeTempRepo(tree("first"));
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("creates the snapshot and adds one catalog entry", async () => {
		const result = await createSnapshot(options("0.7.0"));

		expect(result.created).toBe(true);
		expect(existsSync(join(root, "site/versions/0.7.0/docs/api/flow.md"))).toBe(
			true,
		);
		expect(existsSync(join(root, "site/versions/0.7.0/llms.txt"))).toBe(true);
		expect(existsSync(join(root, "site/versions/0.7.0/navigation.yaml"))).toBe(
			true,
		);

		const catalog = await Bun.file(join(root, "site/versions.yaml")).text();
		expect(catalog).toContain('version: "0.7.0"');
		expect(catalog).toContain('path: "site/versions/0.7.0"');
		expect(catalog).toContain('sourceRef: "v0.7.0"');
	});

	test("writes a manifest that validates against the stored files", async () => {
		await createSnapshot(options("0.7.0"));

		const root070 = join(root, "site/versions/0.7.0");
		const manifest = await readManifest(root070);
		const check = await verifyAgainstManifest(root070, manifest);

		expect(check.ok).toBe(true);
		expect(manifest.sourceRef).toBe("v0.7.0");
		expect(manifest.files["release.json"]).toBeUndefined();
		expect(manifest.files["docs/api/flow.md"]).toBeDefined();
	});

	test("an identical rerun is a harmless no-op", async () => {
		const first = await createSnapshot(options("0.7.0"));
		const second = await createSnapshot(options("0.7.0"));

		expect(second.created).toBe(false);
		expect(second.digest).toBe(first.digest);

		const catalog = await Bun.file(join(root, "site/versions.yaml")).text();
		expect(catalog.match(/version: "0\.7\.0"/g)).toHaveLength(1);
	});

	test("refuses to replace an existing snapshot with different content", async () => {
		await createSnapshot(options("0.7.0"));
		writeFileSync(join(root, "docs/api/flow.md"), "# flow\n\nchanged\n");

		await expect(createSnapshot(options("0.7.0"))).rejects.toThrow(
			/already exists with different content/,
		);
	});

	test("a later release leaves the earlier snapshot untouched", async () => {
		await createSnapshot(options("0.7.0"));
		const before = await readManifest(join(root, "site/versions/0.7.0"));

		writeFileSync(join(root, "docs/api/flow.md"), "# flow\n\nsecond\n");
		const second = await createSnapshot(options("0.7.1"));

		const after = await readManifest(join(root, "site/versions/0.7.0"));
		expect(after.digest).toBe(before.digest);
		expect(second.digest).not.toBe(before.digest);

		const catalog = await Bun.file(join(root, "site/versions.yaml")).text();
		expect(catalog).toContain('version: "0.7.0"');
		expect(catalog).toContain('version: "0.7.1"');
	});

	test("rejects a version below the snapshot floor", async () => {
		await expect(createSnapshot(options("0.6.0"))).rejects.toThrow(
			/full snapshots start at v0\.7\.0/,
		);
		expect(existsSync(join(root, "site/versions/0.6.0"))).toBe(false);
	});

	test("rejects a version that disagrees with package metadata", async () => {
		await expect(
			createSnapshot({ ...options("0.7.1"), expectedVersion: "0.7.0" }),
		).rejects.toThrow(/package\.json declares 0\.7\.0/);
	});

	test.each([
		{ version: "1.0.0" },
		{ version: "0.8.3" },
		{ version: "12.4.9" },
		{ version: "0.7.0-rc.1" },
		{ version: "2.0.0-beta.1" },
	])("accepts arbitrary future version $version", async ({ version }) => {
		const result = await createSnapshot(options(version));

		expect(result.created).toBe(true);
		expect(existsSync(join(root, `site/versions/${version}`))).toBe(true);
	});

	test("a failed creation leaves no catalog entry and no partial directory", async () => {
		const broken = { ...options("0.7.0"), llmsTxt: join(root, "absent.txt") };

		await expect(createSnapshot(broken)).rejects.toThrow();

		expect(existsSync(join(root, "site/versions/0.7.0"))).toBe(false);
		const staging = existsSync(join(root, "site/versions"))
			? readdirSync(join(root, "site/versions"))
			: [];
		expect(staging).toEqual([]);
		const catalog = await Bun.file(join(root, "site/versions.yaml")).text();
		expect(catalog).toContain("releases: []");
	});

	test("stores documentation byte-identical to the package inputs", async () => {
		await createSnapshot(options("0.7.0"));

		for (const file of ["docs/README.md", "docs/api/flow.md", "llms.txt"]) {
			const stored = await Bun.file(
				join(root, "site/versions/0.7.0", file),
			).text();
			const packaged = await Bun.file(join(root, file)).text();
			expect(stored).toBe(packaged);
		}
	});

	test("rejects a snapshot whose documentation differs from the package", async () => {
		await createSnapshot(options("0.7.0"));
		writeFileSync(
			join(root, "site/versions/0.7.0/docs/api/flow.md"),
			"# flow\n\ndrifted\n",
		);

		const [result] = await verifySnapshots(join(root, "site"));

		expect(result?.ok).toBe(false);
	});
});

describe("verifySnapshots", () => {
	let root: string;

	const options = (version: string): SnapshotOptions => ({
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

	beforeEach(() => {
		root = makeTempRepo(tree("first"));
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("reports a stored snapshot as valid", async () => {
		await createSnapshot(options("0.7.0"));

		const results = await verifySnapshots(join(root, "site"));

		expect(results).toEqual([
			{ version: "0.7.0", ok: true, detail: "manifest matches" },
		]);
	});

	test("detects an edited file inside a stored snapshot", async () => {
		await createSnapshot(options("0.7.0"));
		writeFileSync(
			join(root, "site/versions/0.7.0/docs/api/flow.md"),
			"# flow\n\ntampered\n",
		);

		const [result] = await verifySnapshots(join(root, "site"));

		expect(result?.ok).toBe(false);
		expect(result?.detail).toContain("changed: docs/api/flow.md");
	});

	test("detects a file added to a stored snapshot", async () => {
		await createSnapshot(options("0.7.0"));
		writeFileSync(join(root, "site/versions/0.7.0/docs/extra.md"), "# extra\n");

		const [result] = await verifySnapshots(join(root, "site"));

		expect(result?.ok).toBe(false);
		expect(result?.detail).toContain("unlisted: docs/extra.md");
	});
});

describe("version helpers", () => {
	test.each([
		{ a: "0.7.0", b: "0.7.1", sign: -1 },
		{ a: "0.7.10", b: "0.7.9", sign: 1 },
		{ a: "1.0.0", b: "0.99.99", sign: 1 },
		{ a: "0.7.0", b: "0.7.0", sign: 0 },
		{ a: "0.7.0-rc.1", b: "0.7.0", sign: -1 },
	])("compares $a to $b", ({ a, b, sign }) => {
		expect(Math.sign(compareVersions(a, b))).toBe(sign);
	});

	test.each([
		{ version: "0.7.0", pre: false },
		{ version: "0.7.0-rc.1", pre: true },
		{ version: "1.0.0-beta.2", pre: true },
	])("detects prerelease for $version", ({ version, pre }) => {
		expect(isPrerelease(version)).toBe(pre);
	});

	test.each([
		{ version: "0.7" },
		{ version: "v0.7.0" },
		{ version: "x" },
	])("rejects malformed version $version", ({ version }) => {
		expect(() => parseVersion(version)).toThrow(/valid semantic version/);
	});
});
