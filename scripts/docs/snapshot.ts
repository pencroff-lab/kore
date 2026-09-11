import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import {
	loadVersionsCatalog,
	packageVersion,
	paths,
	type VersionsCatalog,
} from "./config";
import { copyTree } from "./generate";
import {
	computeReleaseManifest,
	hashFile,
	listContentFiles,
	readManifest,
	verifyAgainstManifest,
	writeManifest,
} from "./manifest";

/** Lowest version that gets a full documentation snapshot. */
export const MINIMUM_SNAPSHOT_VERSION = "0.7.0";

const SEMVER =
	/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

export interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
	prerelease: string | null;
}

export function parseVersion(version: string): ParsedVersion {
	const match = SEMVER.exec(version);
	if (!match) throw new Error(`Not a valid semantic version: "${version}"`);
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] ?? null,
	};
}

export function isPrerelease(version: string): boolean {
	return parseVersion(version).prerelease !== null;
}

/** Ordering over release versions; a prerelease sorts before its release. */
export function compareVersions(a: string, b: string): number {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	if (left.patch !== right.patch) return left.patch - right.patch;
	if (left.prerelease === right.prerelease) return 0;
	if (left.prerelease === null) return 1;
	if (right.prerelease === null) return -1;
	return left.prerelease.localeCompare(right.prerelease);
}

/** Ordering that ignores prerelease identifiers. */
export function compareReleaseCore(a: string, b: string): number {
	const left = parseVersion(a);
	const right = parseVersion(b);
	return (
		left.major - right.major ||
		left.minor - right.minor ||
		left.patch - right.patch
	);
}

export interface SnapshotOptions {
	version: string;
	/** Skip the package.json equality check; used by fixture tests only. */
	expectedVersion?: string;
	repoRoot?: string;
	siteDir?: string;
	docsDir?: string;
	llmsTxt?: string;
	readme?: string;
	changelog?: string;
	navigation?: string;
	verbose?: boolean;
}

export interface SnapshotResult {
	version: string;
	path: string;
	digest: string;
	created: boolean;
}

interface ResolvedPaths {
	siteDir: string;
	versionsDir: string;
	catalogFile: string;
	docsDir: string;
	llmsTxt: string;
	readme: string;
	changelog: string;
	navigation: string;
	repoRoot: string;
}

function resolvePaths(options: SnapshotOptions): ResolvedPaths {
	const siteDir = options.siteDir ?? paths.siteDir;
	return {
		siteDir,
		versionsDir: join(siteDir, "versions"),
		catalogFile: join(siteDir, "versions.yaml"),
		docsDir: options.docsDir ?? paths.docsDir,
		llmsTxt: options.llmsTxt ?? paths.llmsTxt,
		readme: options.readme ?? paths.readme,
		changelog: options.changelog ?? paths.changelog,
		navigation: options.navigation ?? join(siteDir, "navigation.yaml"),
		repoRoot: options.repoRoot ?? paths.repoRoot,
	};
}

// Serializes the catalog with the header comment preserved.
function renderCatalog(catalog: VersionsCatalog): string {
	const lines = [
		"# Snapshot catalog. Records the snapshots that exist under site/versions/.",
		"#",
		"# A catalog entry is NOT a claim that the version is published to npm; the",
		"# publication receipt in site/published.json is the only publication evidence.",
		"# Add entries with `bun run docs:snapshot <version>`; never by hand.",
		"schemaVersion: 1",
		"",
		"releases:",
	];
	if (catalog.releases.length === 0) {
		lines[lines.length - 1] = "releases: []";
	}
	for (const release of catalog.releases) {
		lines.push(`  - version: ${JSON.stringify(release.version)}`);
		lines.push(`    path: ${JSON.stringify(release.path)}`);
		lines.push(`    sourceRef: ${JSON.stringify(release.sourceRef)}`);
	}
	lines.push("");
	return lines.join("\n");
}

/**
 * Saves one immutable documentation snapshot under `site/versions/<version>/`.
 *
 * The snapshot is assembled in a temporary sibling directory and validated
 * before it is installed, so a failed run leaves neither a partial snapshot nor
 * a catalog entry. Re-running with identical content is a no-op; a conflicting
 * snapshot is refused rather than replaced.
 */
export async function createSnapshot(
	options: SnapshotOptions,
): Promise<SnapshotResult> {
	const { version } = options;
	parseVersion(version);

	// Compare release cores, so 0.7.0-rc.1 is on the 0.7.0 side of the floor.
	if (compareReleaseCore(version, MINIMUM_SNAPSHOT_VERSION) < 0) {
		throw new Error(
			`Refusing to snapshot ${version}: full snapshots start at v${MINIMUM_SNAPSHOT_VERSION}. Releases before it are covered by site/archived/README.md.`,
		);
	}

	const resolved = resolvePaths(options);
	const expected = options.expectedVersion ?? (await packageVersion());
	if (version !== expected) {
		throw new Error(
			`Refusing to snapshot ${version}: package.json declares ${expected}. Finalize the package version first.`,
		);
	}

	const destination = join(resolved.versionsDir, version);
	const relDestination = relative(resolved.repoRoot, destination);
	if (!relDestination.startsWith(join("site", "versions"))) {
		throw new Error(
			`Refusing snapshot destination outside site/versions/: ${destination}`,
		);
	}

	const staging = join(resolved.versionsDir, `.staging-${version}`);
	rmSync(staging, { recursive: true, force: true });
	mkdirSync(staging, { recursive: true });

	try {
		await copyTree(resolved.docsDir, join(staging, "docs"));
		await Bun.write(join(staging, "llms.txt"), Bun.file(resolved.llmsTxt));
		await Bun.write(join(staging, "README.md"), Bun.file(resolved.readme));
		await Bun.write(
			join(staging, "CHANGELOG.md"),
			Bun.file(resolved.changelog),
		);
		await Bun.write(
			join(staging, "navigation.yaml"),
			Bun.file(resolved.navigation),
		);

		const sourceRef = `v${version}`;
		const manifest = await computeReleaseManifest(staging, {
			version,
			sourceRef,
		});
		await writeManifest(staging, manifest);

		const check = await verifyAgainstManifest(staging, manifest);
		if (!check.ok) {
			throw new Error(
				`Snapshot self-check failed for ${version}: ${JSON.stringify(check)}`,
			);
		}

		await assertMatchesPackageInputs(staging, resolved);

		if (existsSync(destination)) {
			const existing = await readManifest(destination);
			if (existing.digest === manifest.digest) {
				rmSync(staging, { recursive: true, force: true });
				if (options.verbose) {
					console.log(`Snapshot ${version} already matches; nothing to do.`);
				}
				return {
					version,
					path: relDestination,
					digest: manifest.digest,
					created: false,
				};
			}
			throw new Error(
				`Refusing to replace ${relDestination}: it already exists with different content (stored digest ${existing.digest.slice(0, 12)}, new digest ${manifest.digest.slice(0, 12)}). A release snapshot is immutable; correcting one is a separate, reviewed change.`,
			);
		}

		renameSync(staging, destination);

		const catalog = await loadVersionsCatalog(resolved.catalogFile);
		catalog.releases = catalog.releases
			.filter((entry) => entry.version !== version)
			.concat({
				version,
				path: `site/versions/${version}`,
				sourceRef,
			})
			.sort((a, b) => compareVersions(a.version, b.version));
		await Bun.write(resolved.catalogFile, renderCatalog(catalog));

		return {
			version,
			path: relDestination,
			digest: manifest.digest,
			created: true,
		};
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
}

// The snapshot's consumer documentation must be byte-identical to the files
// the package is about to publish.
async function assertMatchesPackageInputs(
	root: string,
	resolved: ResolvedPaths,
): Promise<void> {
	const pairs: [string, string][] = [
		[join(root, "llms.txt"), resolved.llmsTxt],
		[join(root, "README.md"), resolved.readme],
		[join(root, "CHANGELOG.md"), resolved.changelog],
	];
	for (const source of listContentFiles(join(root, "docs"))) {
		const rel = relative(join(root, "docs"), source);
		pairs.push([source, join(resolved.docsDir, rel)]);
	}
	for (const [snapshotFile, packageFile] of pairs) {
		if (!existsSync(packageFile)) {
			throw new Error(
				`Snapshot contains ${relative(root, snapshotFile)} but the package input ${packageFile} is missing.`,
			);
		}
		const [a, b] = await Promise.all([
			hashFile(snapshotFile),
			hashFile(packageFile),
		]);
		if (a !== b) {
			throw new Error(
				`Snapshot file ${relative(root, snapshotFile)} does not match the package input ${packageFile}.`,
			);
		}
	}
	const packageFiles = listContentFiles(resolved.docsDir).map((file) =>
		relative(resolved.docsDir, file),
	);
	const snapshotFiles = listContentFiles(join(root, "docs")).map((file) =>
		relative(join(root, "docs"), file),
	);
	const missing = packageFiles.filter((f) => !snapshotFiles.includes(f));
	if (missing.length > 0) {
		throw new Error(
			`Snapshot is missing package documentation files: ${missing.join(", ")}`,
		);
	}
}

/** Re-validates every stored snapshot against its own manifest. */
export async function verifySnapshots(
	siteDir: string = paths.siteDir,
): Promise<{ version: string; ok: boolean; detail: string }[]> {
	const catalog = await loadVersionsCatalog(join(siteDir, "versions.yaml"));
	const results: { version: string; ok: boolean; detail: string }[] = [];
	for (const entry of catalog.releases) {
		const root = join(siteDir, "versions", entry.version);
		if (!existsSync(root)) {
			results.push({
				version: entry.version,
				ok: false,
				detail: `catalog lists ${entry.path} but the directory does not exist`,
			});
			continue;
		}
		const manifest = await readManifest(root);
		const check = await verifyAgainstManifest(root, manifest);
		const problems = [
			check.missing.length ? `missing: ${check.missing.join(", ")}` : "",
			check.added.length ? `unlisted: ${check.added.join(", ")}` : "",
			check.changed.length ? `changed: ${check.changed.join(", ")}` : "",
		].filter(Boolean);
		results.push({
			version: entry.version,
			ok: check.ok,
			detail: check.ok ? "manifest matches" : problems.join("; "),
		});
	}
	return results;
}
