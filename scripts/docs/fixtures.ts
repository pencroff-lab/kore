import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { NavigationConfig } from "./config";
import type { DocsInput, EditionSpec } from "./content";

// Test-only helpers for building throwaway documentation trees.

export function makeTempRepo(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "kore-docs-"));
	for (const [path, content] of Object.entries(files)) {
		const full = resolve(root, path);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, content);
	}
	return root;
}

export function removeTempRepo(root: string): void {
	rmSync(root, { recursive: true, force: true });
}

export function navigation(
	overrides: Partial<NavigationConfig> = {},
): NavigationConfig {
	return {
		schemaVersion: 1,
		sections: overrides.sections ?? [],
		pages: overrides.pages ?? [],
	};
}

export function edition(overrides: Partial<EditionSpec> = {}): EditionSpec {
	return {
		id: "next",
		prefix: "/next/",
		label: "0.7.0 (unreleased)",
		version: "0.7.0",
		released: false,
		sourceRef: "main",
		...overrides,
	};
}

export function docsInput(
	root: string,
	overrides: Partial<DocsInput> = {},
): DocsInput {
	return {
		docsDir: resolve(root, "docs"),
		llmsTxt: null,
		rootDocs: [],
		navigation: navigation(),
		...overrides,
	};
}
