import { describe, expect, test } from "bun:test";
import { hasChangelogEntry } from "./check-release-state.sh";

describe("hasChangelogEntry", () => {
	test.each([
		{ label: "a dated link heading", heading: "## [0.7.0] - 2026-09-09" },
		{ label: "a bare link heading", heading: "## [0.7.0]" },
		{ label: "a plain heading", heading: "## 0.7.0" },
		{ label: "a tab-separated heading", heading: "##\t[0.7.0] - 2026-09-09" },
		{ label: "a heading with trailing space", heading: "## [0.7.0] " },
		{ label: "a CRLF heading", heading: "## [0.7.0] - 2026-09-09\r" },
	])("accepts $label", ({ heading }) => {
		expect(
			hasChangelogEntry(`# Changelog\n\n${heading}\n\n- entry\n`, "0.7.0"),
		).toBe(true);
	});

	test.each([
		{ label: "a prerelease of the version", heading: "## [0.7.0-beta]" },
		{ label: "a longer numeric version", heading: "## [0.7.00]" },
		{ label: "a different version", heading: "## [0.6.0] - 2026-09-01" },
		{ label: "a level-three heading", heading: "### [0.7.0]" },
		{ label: "a heading without a space", heading: "##[0.7.0]" },
		{ label: "the version only in body text", heading: "Released 0.7.0 today" },
		{ label: "an unclosed bracket", heading: "## [0.7.0" },
		{ label: "an unopened bracket", heading: "## 0.7.0]" },
		{ label: "trailing junk after the bracket", heading: "## [0.7.0]junk" },
		{ label: "a suffix glued to the bracket", heading: "## [0.7.0]-beta" },
		{ label: "a v-prefixed version", heading: "## v0.7.0" },
		{ label: "a doubly bracketed version", heading: "## [[0.7.0]]" },
	])("rejects $label", ({ heading }) => {
		expect(hasChangelogEntry(`# Changelog\n\n${heading}\n`, "0.7.0")).toBe(
			false,
		);
	});

	test("finds the entry among other versions", () => {
		const changelog = [
			"# Changelog",
			"",
			"## [0.8.0] - 2026-10-01",
			"",
			"## [0.7.0] - 2026-09-09",
			"",
			"## [0.6.0] - 2026-09-01",
		].join("\n");

		expect(hasChangelogEntry(changelog, "0.7.0")).toBe(true);
		expect(hasChangelogEntry(changelog, "0.5.0")).toBe(false);
	});
});
