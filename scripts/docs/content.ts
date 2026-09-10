import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, posix, relative, resolve } from "node:path";
import type { NavigationConfig } from "./config";
import { findFirstH1 } from "./markdown";

export interface EditionSpec {
	/** Stable edition id, also the generated build directory name. */
	id: string;
	/** Origin-relative prefix, always starting and ending with "/". */
	prefix: string;
	/** Label shown in the navbar version menu. */
	label: string;
	version: string;
	released: boolean;
	/** Git ref the content came from: a release tag or a branch. */
	sourceRef: string;
	/** Versioned prefix a duplicated stable edition should point at. */
	canonicalPrefix?: string;
}

export interface RootDoc {
	absPath: string;
	slug: string;
	title: string;
	weight: number;
}

export interface DocsInput {
	docsDir: string;
	llmsTxt: string | null;
	rootDocs: RootDoc[];
	navigation: NavigationConfig;
}

export type PageOrigin = "docs" | "root" | "generated";

export interface PageEntry {
	/** Canonical source file; empty for a synthesized section index. */
	absPath: string;
	/** Path under the staged `content/` directory. */
	stagedPath: string;
	/** Absolute site route, always ending with "/". */
	route: string;
	/** Absolute site path of the raw Markdown copy, when one exists. */
	rawRoute: string | null;
	title: string;
	weight: number;
	origin: PageOrigin;
	/** Body for a synthesized index; the file is read otherwise. */
	body?: string;
}

export interface AssetEntry {
	absPath: string;
	/** Path under the staged `static/` directory. */
	staticPath: string;
	route: string;
}

export interface ContentManifest {
	edition: EditionSpec;
	docsDir: string;
	pages: PageEntry[];
	assets: AssetEntry[];
	byAbsPath: Map<string, PageEntry>;
	byAssetAbsPath: Map<string, AssetEntry>;
	/** Directory absolute path -> the page acting as its index. */
	indexByDir: Map<string, PageEntry>;
}

// Hugo lowercases path segments derived from file names.
function urlize(segment: string): string {
	return segment.toLowerCase().replace(/\s+/g, "-");
}

function listFiles(dir: string): string[] {
	const out: string[] = [];
	const walk = (current: string): void => {
		for (const name of readdirSync(current).sort()) {
			if (name.startsWith(".")) continue;
			const full = join(current, name);
			if (statSync(full).isDirectory()) walk(full);
			else out.push(full);
		}
	};
	walk(dir);
	return out;
}

// First ATX H1, used as the default page title.
export function extractTitle(source: string): string | null {
	const match = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(stripFrontMatter(source));
	return match?.[1]?.trim() ?? null;
}

/**
 * Removes the document's first H1.
 *
 * The theme renders the front-matter title, so keeping the H1 would show the
 * title twice. It also matters for anchors: Goldmark allocates a heading id for
 * every heading, including the H1 whose id the theme never emits, so a TypeDoc
 * page carrying both `# err` and `### Err` would render the class heading as
 * `#err-1` and break every `err.md#err` cross-reference.
 */
export function stripFirstH1(source: string): string {
	const span = findFirstH1(source);
	if (!span) return source;
	return source.slice(0, span.start) + source.slice(span.end);
}

export function stripFrontMatter(source: string): string {
	return source.startsWith("---")
		? source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
		: source;
}

function routeFor(prefix: string, stagedPath: string): string {
	if (stagedPath === "_index.md") return prefix;
	const withoutExt = stagedPath.replace(/\.md$/, "");
	const parts = withoutExt.split("/").map(urlize);
	if (parts[parts.length - 1] === "_index") parts.pop();
	return `${posix.join(prefix, ...parts)}/`;
}

function stagedPathFor(relPath: string): string {
	const dir = dirname(relPath);
	const base = basename(relPath);
	if (base.toLowerCase() === "readme.md") {
		return dir === "." ? "_index.md" : `${dir}/_index.md`;
	}
	return relPath;
}

interface NavLookup {
	title?: string;
	weight?: number;
	order: number;
}

function navLookup(navigation: NavigationConfig): Map<string, NavLookup> {
	const map = new Map<string, NavLookup>();
	navigation.pages.forEach((page, index) => {
		map.set(page.path, {
			title: page.title,
			weight: page.weight,
			order: index,
		});
	});
	return map;
}

/**
 * Builds the page/asset manifest for one edition: every canonical Markdown
 * file gets a staged path, a public route and a raw-download route, and every
 * directory that holds pages gets an index page.
 */
export function buildManifest(
	edition: EditionSpec,
	input: DocsInput,
): ContentManifest {
	const { docsDir, navigation } = input;
	const nav = navLookup(navigation);
	const sections = new Map(navigation.sections.map((s) => [s.path, s]));

	const pages: PageEntry[] = [];
	const assets: AssetEntry[] = [];
	const byAbsPath = new Map<string, PageEntry>();
	const byAssetAbsPath = new Map<string, AssetEntry>();
	const indexByDir = new Map<string, PageEntry>();

	for (const absPath of listFiles(docsDir)) {
		const relPath = relative(docsDir, absPath).split("\\").join("/");
		if (!relPath.endsWith(".md")) {
			const staticPath = `assets/docs/${relPath}`;
			const entry: AssetEntry = {
				absPath,
				staticPath,
				route: posix.join(edition.prefix, staticPath),
			};
			assets.push(entry);
			byAssetAbsPath.set(absPath, entry);
			continue;
		}

		const source = readFileSync(absPath, "utf8");
		const stagedPath = stagedPathFor(relPath);
		const hint = nav.get(relPath);
		const entry: PageEntry = {
			absPath,
			stagedPath,
			route: routeFor(edition.prefix, stagedPath),
			rawRoute: posix.join(edition.prefix, "raw/docs", relPath),
			title: hint?.title ?? extractTitle(source) ?? basename(relPath, ".md"),
			weight: hint?.weight ?? (hint ? hint.order * 10 + 10 : 1000),
			origin: "docs",
		};
		pages.push(entry);
		byAbsPath.set(absPath, entry);
		if (stagedPath.endsWith("_index.md"))
			indexByDir.set(dirname(absPath), entry);
	}

	if (input.llmsTxt) {
		const entry: AssetEntry = {
			absPath: input.llmsTxt,
			staticPath: "llms.txt",
			route: posix.join(edition.prefix, "llms.txt"),
		};
		assets.push(entry);
		byAssetAbsPath.set(input.llmsTxt, entry);
	}

	for (const rootDoc of input.rootDocs) {
		const stagedPath = `${rootDoc.slug}.md`;
		const entry: PageEntry = {
			absPath: rootDoc.absPath,
			stagedPath,
			route: routeFor(edition.prefix, stagedPath),
			rawRoute: posix.join(edition.prefix, "raw", basename(rootDoc.absPath)),
			title: rootDoc.title,
			weight: rootDoc.weight,
			origin: "root",
		};
		pages.push(entry);
		byAbsPath.set(rootDoc.absPath, entry);
	}

	// Synthesize an index for every directory that holds pages but has none.
	const dirs = new Set<string>();
	for (const page of pages) {
		if (page.origin !== "docs") continue;
		dirs.add(dirname(page.absPath));
	}
	for (const dir of [...dirs].sort()) {
		if (dir === docsDir || indexByDir.has(dir)) continue;
		const relDir = relative(docsDir, dir).split("\\").join("/");
		const section = sections.get(relDir);
		const stagedPath = `${relDir}/_index.md`;
		const children = pages
			.filter((p) => dirname(p.absPath) === dir)
			.sort((a, b) => a.weight - b.weight || a.title.localeCompare(b.title));
		const body = [
			section?.description ? `${section.description}\n` : "",
			...children.map((c) => `- [${c.title}](${c.route})`),
			"",
		]
			.filter((line) => line !== "")
			.join("\n");
		const entry: PageEntry = {
			absPath: join(dir, "_index.generated.md"),
			stagedPath,
			route: routeFor(edition.prefix, stagedPath),
			rawRoute: null,
			title: section?.title ?? relDir,
			weight: section?.weight ?? 900,
			origin: "generated",
			body: `${body}\n`,
		};
		pages.push(entry);
		indexByDir.set(dir, entry);
	}

	if (!indexByDir.has(docsDir)) {
		throw new Error(
			`${docsDir}: missing README.md; the edition has no home page.`,
		);
	}

	pages.sort((a, b) => a.stagedPath.localeCompare(b.stagedPath));
	assets.sort((a, b) => a.staticPath.localeCompare(b.staticPath));

	return {
		edition,
		docsDir,
		pages,
		assets,
		byAbsPath,
		byAssetAbsPath,
		indexByDir,
	};
}

export function resolveInside(root: string, target: string): boolean {
	const rel = relative(root, target);
	return rel !== "" && !rel.startsWith("..") && !resolve(rel).startsWith("/");
}
