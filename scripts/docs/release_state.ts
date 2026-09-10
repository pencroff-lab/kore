import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PublishedReceipt, VersionsCatalog } from "./config";
import {
	loadPublishedReceipt,
	loadVersionsCatalog,
	packageVersion,
	paths,
} from "./config";

/**
 * What a push to `main` is asking for.
 *
 * - `release`     — a snapshot is prepared for this version and no publication
 *                   is recorded: publish, tag, then record.
 * - `docs-only`   — this version is already recorded as published: validate and
 *                   deploy, but never republish or retag.
 * - `unprepared`  — neither: the version is unpublished and has no snapshot, so
 *                   publishing it would be an accident.
 */
export type ReleaseMode = "release" | "docs-only" | "unprepared";

export interface ReleaseState {
	version: string;
	mode: ReleaseMode;
	snapshotPresent: boolean;
	publicationRecorded: boolean;
	latestStable: string | null;
	reason: string;
}

export function classifyReleaseState(
	version: string,
	catalog: VersionsCatalog,
	receipt: PublishedReceipt,
	snapshotDirExists: boolean,
): ReleaseState {
	const catalogued = catalog.releases.some((r) => r.version === version);
	const snapshotPresent = catalogued && snapshotDirExists;
	const publicationRecorded = receipt.releases.some(
		(r) => r.version === version,
	);

	if (publicationRecorded) {
		return {
			version,
			mode: "docs-only",
			snapshotPresent,
			publicationRecorded,
			latestStable: receipt.latestStable,
			reason: `${version} is already recorded as published; this commit only changes documentation state.`,
		};
	}

	if (snapshotPresent) {
		return {
			version,
			mode: "release",
			snapshotPresent,
			publicationRecorded,
			latestStable: receipt.latestStable,
			reason: `${version} has a prepared snapshot and no publication receipt; this is a release candidate.`,
		};
	}

	return {
		version,
		mode: "unprepared",
		snapshotPresent,
		publicationRecorded,
		latestStable: receipt.latestStable,
		reason:
			catalogued && !snapshotDirExists
				? `site/versions.yaml lists ${version} but site/versions/${version}/ is missing.`
				: `package.json declares ${version}, which is neither published nor prepared as a snapshot. Run \`bun run docs:snapshot ${version}\` on the release commit, or leave the version alone until it is ready to release.`,
	};
}

export async function readReleaseState(
	siteDir: string = paths.siteDir,
): Promise<ReleaseState> {
	const [version, catalog, receipt] = await Promise.all([
		packageVersion(),
		loadVersionsCatalog(join(siteDir, "versions.yaml")),
		loadPublishedReceipt(join(siteDir, "published.json")),
	]);
	return classifyReleaseState(
		version,
		catalog,
		receipt,
		existsSync(join(siteDir, "versions", version)),
	);
}

/** Renders the state as `key=value` lines for `$GITHUB_OUTPUT`. */
export function renderGithubOutput(state: ReleaseState): string {
	return [
		`version=${state.version}`,
		`mode=${state.mode}`,
		`snapshot_present=${state.snapshotPresent}`,
		`publication_recorded=${state.publicationRecorded}`,
		`latest_stable=${state.latestStable ?? ""}`,
	].join("\n");
}
