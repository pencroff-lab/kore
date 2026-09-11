import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Level-two changelog headings. The bracketed and plain forms are separate
// complete alternatives — half a bracket pair is a malformed heading, not a
// match — and the version must end at whitespace or end of line, so
// "## [0.7.0", "## 0.7.0]" and "## [0.7.0]junk" name no version.
//   "## [0.7.0] - 2026-09-09"  ->  "0.7.0"
//   "## 0.7.0"                 ->  "0.7.0"
const HEADING = /^##[ \t]+(?:\[([^[\]\s]+)\]|([^[\]\s]+))(?=[ \t]|$)/;

/**
 * Whether the changelog declares an entry for exactly this version.
 *
 * @param changelog - Full CHANGELOG.md text
 * @param version - Version from package.json
 * @returns `true` when a level-two heading names that exact version
 */
export function hasChangelogEntry(changelog: string, version: string): boolean {
	return changelog.split("\n").some((line) => {
		const match = HEADING.exec(line.trimEnd());
		return (match?.[1] ?? match?.[2]) === version;
	});
}

if (import.meta.main) {
	const root = resolve(import.meta.dir, "..");

	const { version } = JSON.parse(
		readFileSync(resolve(root, "package.json"), "utf-8"),
	) as { version: string };

	const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf-8");

	if (!hasChangelogEntry(changelog, version)) {
		console.error(
			`Release state mismatch: package.json is at ${version}, but CHANGELOG.md has no "## [${version}]" entry.`,
		);
		process.exit(1);
	}

	console.log(`Release state ok: ${version} is documented in CHANGELOG.md.`);
}
