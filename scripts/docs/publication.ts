import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PublishedReceipt, PublishedRelease } from "./config";
import { loadPublishedReceipt, loadVersionsCatalog, paths } from "./config";
import { readManifest } from "./manifest";
import { compareVersions, isPrerelease } from "./snapshot";

/** What the registry reports for one exact package version. */
export interface RegistryFacts {
	version: string;
	/** Integrity string, e.g. "sha512-…". */
	integrity: string;
	/** Dist-tags currently pointing at this version. */
	distTags: string[];
}

/** What Git reports for the release tag. */
export interface TagFacts {
	exists: boolean;
	/** Commit the tag points at, when it exists. */
	commit: string | null;
}

/** Injected adapters, so recording can be exercised without any network. */
export interface PublicationAdapters {
	registry: (version: string) => Promise<RegistryFacts | null>;
	tag: (tagName: string) => Promise<TagFacts>;
	/** Commit the release was built from. */
	releaseCommit: () => Promise<string>;
}

export interface RecordOptions {
	version: string;
	/** Dist-tag this release is intended to occupy. */
	distTag?: string;
	siteDir?: string;
	adapters: PublicationAdapters;
}

export interface RecordOutcome {
	receipt: PublishedReceipt;
	release: PublishedRelease;
	/** True when this run promoted the default edition. */
	promoted: boolean;
	changed: boolean;
}

export class PublicationError extends Error {}

/**
 * Adds one verified release to the receipt.
 *
 * Pure: it neither publishes nor reads the network. Earlier entries are always
 * retained, and `latestStable` moves only for a stable release that is both
 * newer than the current default and intended to be npm's `latest`.
 */
export function applyRelease(
	receipt: PublishedReceipt,
	release: PublishedRelease,
): RecordOutcome {
	const existing = receipt.releases.find((r) => r.version === release.version);
	if (existing) {
		if (
			existing.sourceCommit !== release.sourceCommit ||
			existing.snapshotDigest !== release.snapshotDigest
		) {
			throw new PublicationError(
				`${release.version} is already recorded with a different commit or snapshot digest. Investigate before overwriting the receipt.`,
			);
		}
	}

	const releases = receipt.releases
		.filter((r) => r.version !== release.version)
		.concat(release)
		.sort((a, b) => compareVersions(a.version, b.version));

	const promotable =
		release.distTag === "latest" && !isPrerelease(release.version);
	const newerThanCurrent =
		receipt.latestStable === null ||
		compareVersions(release.version, receipt.latestStable) > 0;
	const promoted = promotable && newerThanCurrent;

	const next: PublishedReceipt = {
		schemaVersion: 1,
		latestStable: promoted ? release.version : receipt.latestStable,
		releases,
	};

	return {
		receipt: next,
		release,
		promoted,
		changed: JSON.stringify(next) !== JSON.stringify(receipt),
	};
}

export function renderReceipt(receipt: PublishedReceipt): string {
	return `${JSON.stringify(receipt, null, "\t")}\n`;
}

/**
 * Verifies a release against the registry, the Git tag and the stored
 * snapshot, then returns the updated receipt. Nothing is written and nothing is
 * published; a failed verification produces no receipt at all.
 */
export async function verifyAndRecord(
	options: RecordOptions,
): Promise<RecordOutcome> {
	const siteDir = options.siteDir ?? paths.siteDir;
	const version = options.version;
	const distTag = options.distTag ?? "latest";

	const catalog = await loadVersionsCatalog(join(siteDir, "versions.yaml"));
	const entry = catalog.releases.find((r) => r.version === version);
	if (!entry) {
		throw new PublicationError(
			`No snapshot catalogued for ${version}. Run \`bun run docs:snapshot ${version}\` on the release commit first.`,
		);
	}

	const snapshotRoot = join(siteDir, "versions", version);
	if (!existsSync(snapshotRoot)) {
		throw new PublicationError(
			`Catalog lists ${entry.path} but the snapshot directory is missing.`,
		);
	}
	const manifest = await readManifest(snapshotRoot);
	if (manifest.version !== version) {
		throw new PublicationError(
			`Snapshot at ${entry.path} declares version ${manifest.version}, not ${version}.`,
		);
	}

	const registry = await options.adapters.registry(version);
	if (!registry) {
		throw new PublicationError(
			`npm does not report @pencroff-lab/kore@${version}. A changelog heading or package.json version is not evidence of publication.`,
		);
	}
	if (registry.version !== version) {
		throw new PublicationError(
			`Registry returned version ${registry.version} when asked for ${version}.`,
		);
	}
	if (!registry.distTags.includes(distTag)) {
		throw new PublicationError(
			`${version} is published but does not carry the intended dist-tag "${distTag}" (has: ${
				registry.distTags.join(", ") || "none"
			}).`,
		);
	}

	const tagName = `v${version}`;
	const releaseCommit = await options.adapters.releaseCommit();
	const tag = await options.adapters.tag(tagName);
	if (!tag.exists) {
		throw new PublicationError(
			`Tag ${tagName} does not exist. Create it at the release commit before recording publication.`,
		);
	}
	if (tag.commit !== releaseCommit) {
		throw new PublicationError(
			`Tag ${tagName} points at ${tag.commit}, not the release commit ${releaseCommit}. A pre-existing tag at a different commit is an error, not a skip.`,
		);
	}

	const receipt = await loadPublishedReceipt(join(siteDir, "published.json"));
	return applyRelease(receipt, {
		version,
		sourceCommit: releaseCommit,
		snapshotDigest: manifest.digest,
		registryIntegrity: registry.integrity,
		distTag,
	});
}

// ─── Real adapters ───────────────────────────────────────────────────────────

async function capture(
	cmd: string[],
): Promise<{ code: number; out: string; err: string }> {
	const proc = Bun.spawn(cmd, {
		cwd: paths.repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { code, out, err };
}

type CommandCapture = typeof capture;

/** Reads one exact package version and its dist-tags through Bun's registry CLI. */
export async function queryRegistry(
	version: string,
	run: CommandCapture = capture,
): Promise<RegistryFacts | null> {
	const exact = await run([
		"bun",
		"info",
		`@pencroff-lab/kore@${version}`,
		"--json",
	]);
	if (exact.code !== 0) return null;
	const data = JSON.parse(exact.out) as {
		version?: string;
		dist?: { integrity?: string };
	};
	if (!data.version) return null;

	const tags = await run([
		"bun",
		"info",
		"@pencroff-lab/kore",
		"dist-tags",
		"--json",
	]);
	const distTags: string[] = [];
	if (tags.code === 0) {
		const map = JSON.parse(tags.out) as Record<string, string>;
		for (const [name, value] of Object.entries(map)) {
			if (value === version) distTags.push(name);
		}
	}
	return {
		version: data.version,
		integrity: data.dist?.integrity ?? "",
		distTags,
	};
}

export const liveAdapters: PublicationAdapters = {
	registry: queryRegistry,
	tag: async (tagName) => {
		const result = await capture(["git", "rev-list", "-n", "1", tagName]);
		if (result.code !== 0) return { exists: false, commit: null };
		return { exists: true, commit: result.out.trim() };
	},
	releaseCommit: async () => {
		const result = await capture(["git", "rev-parse", "HEAD"]);
		if (result.code !== 0) {
			throw new PublicationError("Could not resolve HEAD.");
		}
		return result.out.trim();
	},
};

/**
 * Records a verified publication. Writes only `site/published.json`; snapshot
 * contents are never touched. Also emits the exact patch a maintainer (or
 * approved automation) commits as the documentation-only finalization change.
 */
export async function recordPublication(options: {
	version: string;
	distTag?: string;
	siteDir?: string;
	adapters?: PublicationAdapters;
	dryRun?: boolean;
}): Promise<RecordOutcome & { receiptPath: string; patch: string }> {
	const siteDir = options.siteDir ?? paths.siteDir;
	const outcome = await verifyAndRecord({
		version: options.version,
		distTag: options.distTag,
		siteDir,
		adapters: options.adapters ?? liveAdapters,
	});

	const receiptPath = join(siteDir, "published.json");
	const before = await Bun.file(receiptPath).text();
	const after = renderReceipt(outcome.receipt);

	if (!options.dryRun && outcome.changed) {
		await Bun.write(receiptPath, after);
	}

	return {
		...outcome,
		receiptPath,
		patch: unifiedDiff("site/published.json", before, after),
	};
}

/** Minimal unified diff, enough for a one-file receipt patch. */
export function unifiedDiff(
	path: string,
	before: string,
	after: string,
): string {
	if (before === after) return "";
	const a = before.split("\n");
	const b = after.split("\n");
	return [
		`--- a/${path}`,
		`+++ b/${path}`,
		`@@ -1,${a.length} +1,${b.length} @@`,
		...a.map((line) => `-${line}`),
		...b.map((line) => `+${line}`),
	].join("\n");
}
