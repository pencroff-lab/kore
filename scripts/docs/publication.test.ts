import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import sinon from "sinon";
import type { PublishedReceipt, PublishedRelease } from "./config";
import { makeTempRepo, removeTempRepo } from "./fixtures";
import type { PublicationAdapters, RegistryFacts } from "./publication";
import {
	applyRelease,
	PublicationError,
	queryRegistry,
	recordPublication,
	unifiedDiff,
} from "./publication";
import type { SnapshotOptions } from "./snapshot";
import { createSnapshot } from "./snapshot";

const COMMIT = "a".repeat(40);

function release(overrides: Partial<PublishedRelease> = {}): PublishedRelease {
	return {
		version: "0.7.0",
		sourceCommit: COMMIT,
		snapshotDigest: "d".repeat(64),
		registryIntegrity: "sha512-abc",
		distTag: "latest",
		...overrides,
	};
}

function receipt(overrides: Partial<PublishedReceipt> = {}): PublishedReceipt {
	return {
		schemaVersion: 1,
		latestStable: null,
		releases: [],
		...overrides,
	};
}

describe("applyRelease", () => {
	test("records the first release and promotes it to latest stable", () => {
		const outcome = applyRelease(receipt(), release());

		expect(outcome.receipt.latestStable).toBe("0.7.0");
		expect(outcome.receipt.releases).toHaveLength(1);
		expect(outcome.promoted).toBe(true);
	});

	test("retains earlier entries when a later release is added", () => {
		const first = applyRelease(receipt(), release()).receipt;

		const second = applyRelease(
			first,
			release({ version: "0.7.1", sourceCommit: "b".repeat(40) }),
		).receipt;

		expect(second.releases.map((r) => r.version)).toEqual(["0.7.0", "0.7.1"]);
		expect(second.latestStable).toBe("0.7.1");
	});

	test("an older release cannot revert the default edition", () => {
		const current = receipt({
			latestStable: "0.8.0",
			releases: [release({ version: "0.8.0" })],
		});

		const outcome = applyRelease(
			current,
			release({ version: "0.7.9", sourceCommit: "c".repeat(40) }),
		);

		expect(outcome.receipt.latestStable).toBe("0.8.0");
		expect(outcome.promoted).toBe(false);
		expect(outcome.receipt.releases.map((r) => r.version)).toEqual([
			"0.7.9",
			"0.8.0",
		]);
	});

	test("promotes by version order, not by lexicographic sorting", () => {
		const current = applyRelease(
			receipt(),
			release({ version: "0.7.9" }),
		).receipt;

		const outcome = applyRelease(
			current,
			release({ version: "0.7.10", sourceCommit: "e".repeat(40) }),
		);

		expect(outcome.receipt.latestStable).toBe("0.7.10");
	});

	test("a prerelease is recorded but never promoted", () => {
		const outcome = applyRelease(
			receipt(),
			release({ version: "0.8.0-rc.1", distTag: "next" }),
		);

		expect(outcome.receipt.latestStable).toBeNull();
		expect(outcome.receipt.releases).toHaveLength(1);
		expect(outcome.promoted).toBe(false);
	});

	test("a release on another dist-tag does not take the default edition", () => {
		const outcome = applyRelease(receipt(), release({ distTag: "beta" }));

		expect(outcome.receipt.latestStable).toBeNull();
		expect(outcome.promoted).toBe(false);
	});

	test("re-recording the same release is idempotent", () => {
		const first = applyRelease(receipt(), release()).receipt;

		const again = applyRelease(first, release());

		expect(again.changed).toBe(false);
		expect(again.receipt.releases).toHaveLength(1);
	});

	test("refuses to overwrite a recorded release with a different commit", () => {
		const first = applyRelease(receipt(), release()).receipt;

		expect(() =>
			applyRelease(first, release({ sourceCommit: "f".repeat(40) })),
		).toThrow(/already recorded with a different commit/);
	});
});

describe("queryRegistry", () => {
	test("uses Bun to read the exact version, integrity and dist-tags", async () => {
		const calls: string[][] = [];
		const result = await queryRegistry("0.7.0", async (cmd: string[]) => {
			calls.push(cmd);
			if (cmd.includes("dist-tags")) {
				return {
					code: 0,
					out: JSON.stringify({ latest: "0.7.0", next: "0.8.0-rc.1" }),
					err: "",
				};
			}
			return {
				code: 0,
				out: JSON.stringify({
					version: "0.7.0",
					dist: { integrity: "sha512-real" },
				}),
				err: "",
			};
		});

		expect(calls).toEqual([
			["bun", "info", "@pencroff-lab/kore@0.7.0", "--json"],
			["bun", "info", "@pencroff-lab/kore", "dist-tags", "--json"],
		]);
		expect(result).toEqual({
			version: "0.7.0",
			integrity: "sha512-real",
			distTags: ["latest"],
		});
	});
});

describe("recordPublication", () => {
	let root: string;
	let sandbox: sinon.SinonSandbox;

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

	function adapters(overrides: Partial<PublicationAdapters> = {}) {
		const registry: RegistryFacts = {
			version: "0.7.0",
			integrity: "sha512-real",
			distTags: ["latest"],
		};
		return {
			registry: sandbox.stub().resolves(registry),
			tag: sandbox.stub().resolves({ exists: true, commit: COMMIT }),
			releaseCommit: sandbox.stub().resolves(COMMIT),
			...overrides,
		} as unknown as PublicationAdapters;
	}

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
		root = makeTempRepo({
			"docs/README.md": "# Docs\n",
			"docs/api/flow.md": "# flow\n",
			"llms.txt": "# kore\n",
			"README.md": "# kore\n",
			"CHANGELOG.md": "# Changelog\n",
			"site/navigation.yaml": "schemaVersion: 1\nsections: []\npages: []\n",
			"site/versions.yaml":
				'schemaVersion: 1\ndevelopment:\n  label: "dev"\n  sourceRef: "main"\nreleases: []\n',
			"site/published.json":
				'{"schemaVersion":1,"latestStable":null,"releases":[]}',
		});
		await createSnapshot(snapshotOptions("0.7.0"));
	});

	afterEach(() => {
		sandbox.restore();
		removeTempRepo(root);
	});

	test("records a verified release and promotes it", async () => {
		const outcome = await recordPublication({
			version: "0.7.0",
			siteDir: join(root, "site"),
			adapters: adapters(),
		});

		expect(outcome.promoted).toBe(true);
		const stored = await Bun.file(join(root, "site/published.json")).json();
		expect(stored.latestStable).toBe("0.7.0");
		expect(stored.releases[0].registryIntegrity).toBe("sha512-real");
		expect(stored.releases[0].sourceCommit).toBe(COMMIT);
	});

	test("uses the snapshot digest from the stored manifest", async () => {
		const manifest = await Bun.file(
			join(root, "site/versions/0.7.0/release.json"),
		).json();

		const outcome = await recordPublication({
			version: "0.7.0",
			siteDir: join(root, "site"),
			adapters: adapters(),
		});

		expect(outcome.release.snapshotDigest).toBe(manifest.digest);
	});

	test("writes nothing when the package is not on the registry", async () => {
		const failing = adapters({
			registry: sandbox.stub().resolves(null),
		} as Partial<PublicationAdapters>);

		await expect(
			recordPublication({
				version: "0.7.0",
				siteDir: join(root, "site"),
				adapters: failing,
			}),
		).rejects.toThrow(/npm does not report/);

		const stored = await Bun.file(join(root, "site/published.json")).json();
		expect(stored.releases).toEqual([]);
		expect(stored.latestStable).toBeNull();
	});

	test("rejects a tag pointing at a different commit", async () => {
		const mismatched = adapters({
			tag: sandbox.stub().resolves({ exists: true, commit: "9".repeat(40) }),
		} as Partial<PublicationAdapters>);

		await expect(
			recordPublication({
				version: "0.7.0",
				siteDir: join(root, "site"),
				adapters: mismatched,
			}),
		).rejects.toThrow(/not the release commit/);
	});

	test("rejects a missing tag rather than skipping it", async () => {
		const missing = adapters({
			tag: sandbox.stub().resolves({ exists: false, commit: null }),
		} as Partial<PublicationAdapters>);

		await expect(
			recordPublication({
				version: "0.7.0",
				siteDir: join(root, "site"),
				adapters: missing,
			}),
		).rejects.toThrow(/does not exist/);
	});

	test("rejects a version whose snapshot is not catalogued", async () => {
		await expect(
			recordPublication({
				version: "0.7.5",
				siteDir: join(root, "site"),
				adapters: adapters(),
			}),
		).rejects.toThrow(PublicationError);
	});

	test("rejects a release that does not carry the intended dist-tag", async () => {
		const wrongTag = adapters({
			registry: sandbox.stub().resolves({
				version: "0.7.0",
				integrity: "sha512-real",
				distTags: ["next"],
			}),
		} as Partial<PublicationAdapters>);

		await expect(
			recordPublication({
				version: "0.7.0",
				siteDir: join(root, "site"),
				adapters: wrongTag,
			}),
		).rejects.toThrow(/does not carry the intended dist-tag/);
	});

	test("a stale retry of an already recorded release changes nothing", async () => {
		await recordPublication({
			version: "0.7.0",
			siteDir: join(root, "site"),
			adapters: adapters(),
		});
		const before = await Bun.file(join(root, "site/published.json")).text();

		const again = await recordPublication({
			version: "0.7.0",
			siteDir: join(root, "site"),
			adapters: adapters(),
		});

		expect(again.changed).toBe(false);
		expect(await Bun.file(join(root, "site/published.json")).text()).toBe(
			before,
		);
	});

	test("dry run verifies and emits a patch without writing", async () => {
		const outcome = await recordPublication({
			version: "0.7.0",
			siteDir: join(root, "site"),
			adapters: adapters(),
			dryRun: true,
		});

		expect(outcome.patch).toContain("--- a/site/published.json");
		expect(outcome.patch).toContain('"latestStable": "0.7.0"');
		const stored = await Bun.file(join(root, "site/published.json")).json();
		expect(stored.releases).toEqual([]);
	});

	test("never publishes: no adapter beyond read-only lookups is used", async () => {
		const spies = adapters() as unknown as Record<string, sinon.SinonStub>;

		await recordPublication({
			version: "0.7.0",
			siteDir: join(root, "site"),
			adapters: spies as unknown as PublicationAdapters,
		});

		sinon.assert.calledOnceWithExactly(
			spies.registry as sinon.SinonStub,
			"0.7.0",
		);
		sinon.assert.calledOnceWithExactly(spies.tag as sinon.SinonStub, "v0.7.0");
		sinon.assert.calledOnce(spies.releaseCommit as sinon.SinonStub);
	});
});

describe("unifiedDiff", () => {
	test("is empty when nothing changed", () => {
		expect(unifiedDiff("f.json", "a\n", "a\n")).toBe("");
	});

	test("names the file and carries both sides", () => {
		const patch = unifiedDiff("site/published.json", "a\n", "b\n");

		expect(patch).toContain("--- a/site/published.json");
		expect(patch).toContain("+++ b/site/published.json");
		expect(patch).toContain("-a");
		expect(patch).toContain("+b");
	});
});
