import { describe, expect, test } from "bun:test";
import type { PublishedReceipt, VersionsCatalog } from "./config";
import { classifyReleaseState, renderGithubOutput } from "./release_state";

function catalog(versions: string[]): VersionsCatalog {
	return {
		schemaVersion: 1,
		development: { label: "dev", sourceRef: "main" },
		releases: versions.map((version) => ({
			version,
			path: `site/versions/${version}`,
			sourceRef: `v${version}`,
		})),
	};
}

function receipt(versions: string[], latest: string | null): PublishedReceipt {
	return {
		schemaVersion: 1,
		latestStable: latest,
		releases: versions.map((version) => ({
			version,
			sourceCommit: "a".repeat(40),
			snapshotDigest: "d".repeat(64),
			registryIntegrity: "sha512-x",
			distTag: "latest",
		})),
	};
}

describe("classifyReleaseState", () => {
	test("a prepared, unpublished version is a release candidate", () => {
		const state = classifyReleaseState(
			"0.7.0",
			catalog(["0.7.0"]),
			receipt([], null),
			true,
		);

		expect(state.mode).toBe("release");
		expect(state.snapshotPresent).toBe(true);
		expect(state.publicationRecorded).toBe(false);
	});

	test("an already recorded version is a documentation-only commit", () => {
		const state = classifyReleaseState(
			"0.7.0",
			catalog(["0.7.0"]),
			receipt(["0.7.0"], "0.7.0"),
			true,
		);

		expect(state.mode).toBe("docs-only");
		expect(state.reason).toContain("already recorded as published");
	});

	test("the receipt-finalization commit lands as documentation-only", () => {
		// The publish job records the receipt; committing it produces this push.
		const before = classifyReleaseState(
			"0.7.0",
			catalog(["0.7.0"]),
			receipt([], null),
			true,
		);
		const after = classifyReleaseState(
			"0.7.0",
			catalog(["0.7.0"]),
			receipt(["0.7.0"], "0.7.0"),
			true,
		);

		expect(before.mode).toBe("release");
		expect(after.mode).toBe("docs-only");
		expect(after.latestStable).toBe("0.7.0");
	});

	test("an unprepared version never becomes a release", () => {
		const state = classifyReleaseState(
			"0.8.0",
			catalog(["0.7.0"]),
			receipt(["0.7.0"], "0.7.0"),
			false,
		);

		expect(state.mode).toBe("unprepared");
		expect(state.reason).toContain("docs:snapshot 0.8.0");
	});

	test("a catalogued version with a missing directory is unprepared", () => {
		const state = classifyReleaseState(
			"0.7.0",
			catalog(["0.7.0"]),
			receipt([], null),
			false,
		);

		expect(state.mode).toBe("unprepared");
		expect(state.reason).toContain("is missing");
	});

	test("a later development version does not republish the released one", () => {
		const state = classifyReleaseState(
			"0.8.0",
			catalog(["0.7.0"]),
			receipt(["0.7.0"], "0.7.0"),
			false,
		);

		expect(state.mode).toBe("unprepared");
		expect(state.latestStable).toBe("0.7.0");
	});

	test("a second release is a candidate while the first stays published", () => {
		const state = classifyReleaseState(
			"0.7.1",
			catalog(["0.7.0", "0.7.1"]),
			receipt(["0.7.0"], "0.7.0"),
			true,
		);

		expect(state.mode).toBe("release");
		expect(state.latestStable).toBe("0.7.0");
	});
});

describe("renderGithubOutput", () => {
	test("emits the keys the workflow reads", () => {
		const out = renderGithubOutput(
			classifyReleaseState(
				"0.7.0",
				catalog(["0.7.0"]),
				receipt(["0.7.0"], "0.7.0"),
				true,
			),
		);

		expect(out.split("\n")).toEqual([
			"version=0.7.0",
			"mode=docs-only",
			"snapshot_present=true",
			"publication_recorded=true",
			"latest_stable=0.7.0",
		]);
	});

	test("emits an empty latest_stable when nothing is published", () => {
		const out = renderGithubOutput(
			classifyReleaseState("0.7.0", catalog([]), receipt([], null), false),
		);

		expect(out).toContain("latest_stable=");
		expect(out).toContain("mode=unprepared");
	});
});
