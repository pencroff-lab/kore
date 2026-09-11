import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Repository root, resolved from this file's location.
export const repoRoot = resolve(import.meta.dir, "..", "..");

export const paths = {
	repoRoot,
	docsDir: resolve(repoRoot, "docs"),
	llmsTxt: resolve(repoRoot, "llms.txt"),
	readme: resolve(repoRoot, "README.md"),
	changelog: resolve(repoRoot, "CHANGELOG.md"),
	siteDir: resolve(repoRoot, "site"),
	archivedDir: resolve(repoRoot, "site", "archived"),
	versionsDir: resolve(repoRoot, "site", "versions"),
	hugoConfig: resolve(repoRoot, "site", "hugo.yaml"),
	navigation: resolve(repoRoot, "site", "navigation.yaml"),
	versionsCatalog: resolve(repoRoot, "site", "versions.yaml"),
	publishedReceipt: resolve(repoRoot, "site", "published.json"),
	toolchain: resolve(repoRoot, "site", "toolchain.json"),
	buildDir: resolve(repoRoot, "build"),
	siteBuildDir: resolve(repoRoot, "build", "docs-site"),
	siteLocalDir: resolve(repoRoot, "build", "docs-site-local"),
	publicDir: resolve(repoRoot, "build", "docs-site", "public"),
} as const;

export const PRODUCTION_ORIGIN = "https://kore.lab.pencroff.com";
export const REPO_SLUG = "pencroff-lab/kore";

// Route prefixes the assembler owns; an edition may not claim them.
export const RESERVED_ROUTES = ["v", "next", "archived", "raw"] as const;

export interface NavigationSection {
	path: string;
	title: string;
	weight?: number;
	description?: string;
}

export interface NavigationPage {
	path: string;
	title?: string;
	weight?: number;
}

export interface NavigationConfig {
	schemaVersion: number;
	sections: NavigationSection[];
	pages: NavigationPage[];
}

export interface ReleaseCatalogEntry {
	version: string;
	path: string;
	sourceRef: string;
}

export interface VersionsCatalog {
	schemaVersion: number;
	development: { label: string; sourceRef: string };
	releases: ReleaseCatalogEntry[];
}

export interface PublishedRelease {
	version: string;
	sourceCommit: string;
	snapshotDigest: string;
	registryIntegrity: string;
	distTag: string;
}

export interface PublishedReceipt {
	schemaVersion: number;
	latestStable: string | null;
	releases: PublishedRelease[];
}

export interface Toolchain {
	bun: string;
	go: string;
	hugo: string;
	hugoEdition: string;
	hextra: string;
}

async function readJson<T>(file: string): Promise<T> {
	return JSON.parse(await Bun.file(file).text()) as T;
}

async function readYaml<T>(file: string): Promise<T> {
	return Bun.YAML.parse(await Bun.file(file).text()) as T;
}

export async function loadNavigation(
	file: string = paths.navigation,
): Promise<NavigationConfig> {
	const raw = await readYaml<Partial<NavigationConfig>>(file);
	return {
		schemaVersion: raw.schemaVersion ?? 1,
		sections: raw.sections ?? [],
		pages: raw.pages ?? [],
	};
}

export async function loadVersionsCatalog(
	file: string = paths.versionsCatalog,
): Promise<VersionsCatalog> {
	const raw = await readYaml<Partial<VersionsCatalog>>(file);
	if (raw.schemaVersion !== 1) {
		throw new Error(`${file}: unsupported schemaVersion ${raw.schemaVersion}`);
	}
	return {
		schemaVersion: 1,
		development: raw.development ?? { label: "development", sourceRef: "main" },
		releases: raw.releases ?? [],
	};
}

export async function loadPublishedReceipt(
	file: string = paths.publishedReceipt,
): Promise<PublishedReceipt> {
	const raw = await readJson<Partial<PublishedReceipt>>(file);
	if (raw.schemaVersion !== 1) {
		throw new Error(`${file}: unsupported schemaVersion ${raw.schemaVersion}`);
	}
	return {
		schemaVersion: 1,
		latestStable: raw.latestStable ?? null,
		releases: raw.releases ?? [],
	};
}

export async function loadToolchain(
	file: string = paths.toolchain,
): Promise<Toolchain> {
	return readJson<Toolchain>(file);
}

export async function packageVersion(): Promise<string> {
	const pkg = await readJson<{ version: string }>(
		resolve(repoRoot, "package.json"),
	);
	return pkg.version;
}

// GitHub blob base for release-tag-pinned source citations.
export function sourceLinkBase(tag: string): string {
	return `https://github.com/${REPO_SLUG}/blob/${tag}/`;
}

export function treeLinkBase(tag: string): string {
	return `https://github.com/${REPO_SLUG}/tree/${tag}/`;
}

export function hasSite(): boolean {
	return existsSync(paths.hugoConfig);
}
