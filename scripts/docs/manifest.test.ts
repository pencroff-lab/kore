import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo, removeTempRepo } from "./fixtures";
import {
	assertSafePath,
	computeReleaseManifest,
	contentDigest,
	listContentFiles,
	verifyAgainstManifest,
} from "./manifest";

const META = { version: "0.7.0", sourceRef: "v0.7.0" };

describe("computeReleaseManifest", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo({
			"docs/README.md": "# Docs\n",
			"docs/api/flow.md": "# flow\n",
			"llms.txt": "# kore\n",
		});
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("hashes every file under the root with sorted POSIX paths", async () => {
		const manifest = await computeReleaseManifest(root, META);

		expect(Object.keys(manifest.files)).toEqual([
			"docs/README.md",
			"docs/api/flow.md",
			"llms.txt",
		]);
		for (const hash of Object.values(manifest.files)) {
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		}
	});

	test("excludes release.json from its own hash map", async () => {
		writeFileSync(join(root, "release.json"), "{}");

		const manifest = await computeReleaseManifest(root, META);

		expect(manifest.files["release.json"]).toBeUndefined();
	});

	test("produces the same digest for identical content", async () => {
		const first = await computeReleaseManifest(root, META);
		const second = await computeReleaseManifest(root, META);

		expect(second.digest).toBe(first.digest);
	});

	test("changes the digest when any file changes", async () => {
		const before = await computeReleaseManifest(root, META);
		writeFileSync(join(root, "docs/api/flow.md"), "# flow\n\nedited\n");

		const after = await computeReleaseManifest(root, META);

		expect(after.digest).not.toBe(before.digest);
	});

	test("changes the digest when a file is added", async () => {
		const before = await computeReleaseManifest(root, META);
		writeFileSync(join(root, "docs/extra.md"), "# extra\n");

		const after = await computeReleaseManifest(root, META);

		expect(after.digest).not.toBe(before.digest);
	});

	test("refuses a symlink inside the snapshot root", () => {
		symlinkSync("/etc/hosts", join(root, "docs/link.md"));

		expect(() => listContentFiles(root)).toThrow(/Refusing symlink/);
	});

	test("refuses a symlinked directory inside the snapshot root", () => {
		mkdirSync(join(root, "outside"));
		symlinkSync(join(root, "outside"), join(root, "docs/linked"));

		expect(() => listContentFiles(root)).toThrow(/Refusing symlink/);
	});
});

describe("assertSafePath", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo({ "docs/a.md": "# a\n" });
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("accepts a path inside the root", () => {
		expect(() => assertSafePath(root, join(root, "docs/a.md"))).not.toThrow();
	});

	test.each([
		{ name: "parent escape", path: "../escape.md" },
		{ name: "root itself", path: "." },
	])("refuses $name", ({ path }) => {
		expect(() => assertSafePath(root, join(root, path))).toThrow(
			/outside the snapshot root/,
		);
	});
});

describe("verifyAgainstManifest", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo({ "docs/a.md": "# a\n", "docs/b.md": "# b\n" });
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("reports a clean tree as ok", async () => {
		const manifest = await computeReleaseManifest(root, META);

		expect(await verifyAgainstManifest(root, manifest)).toEqual({
			ok: true,
			missing: [],
			added: [],
			changed: [],
		});
	});

	test("reports a changed file", async () => {
		const manifest = await computeReleaseManifest(root, META);
		writeFileSync(join(root, "docs/a.md"), "# a edited\n");

		const check = await verifyAgainstManifest(root, manifest);

		expect(check.ok).toBe(false);
		expect(check.changed).toEqual(["docs/a.md"]);
	});

	test("reports an unlisted file", async () => {
		const manifest = await computeReleaseManifest(root, META);
		writeFileSync(join(root, "docs/c.md"), "# c\n");

		const check = await verifyAgainstManifest(root, manifest);

		expect(check.ok).toBe(false);
		expect(check.added).toEqual(["docs/c.md"]);
	});
});

describe("contentDigest", () => {
	test("is independent of key insertion order", () => {
		const a = contentDigest({ "b.md": "22", "a.md": "11" });
		const b = contentDigest({ "a.md": "11", "b.md": "22" });

		expect(a).toBe(b);
	});

	test("distinguishes a renamed file", () => {
		const a = contentDigest({ "a.md": "11" });
		const b = contentDigest({ "b.md": "11" });

		expect(a).not.toBe(b);
	});
});
