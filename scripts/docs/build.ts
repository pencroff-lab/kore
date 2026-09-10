import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { PublishedReceipt, VersionsCatalog } from "./config";
import {
	loadNavigation,
	loadPublishedReceipt,
	loadVersionsCatalog,
	PRODUCTION_ORIGIN,
	packageVersion,
	paths,
	RESERVED_ROUTES,
	sourceLinkBase,
} from "./config";
import type { ContentManifest, DocsInput, EditionSpec } from "./content";
import { buildManifest, stripFirstH1, stripFrontMatter } from "./content";
import { copyTree } from "./generate";
import type { LinkDiagnostic } from "./links";
import { formatDiagnostics, rewriteMarkdown } from "./links";
import { writeOverview } from "./overview";
import { compareVersions } from "./snapshot";

/** Every filesystem location the site build reads or writes. */
export interface SitePaths {
	repoRoot: string;
	siteDir: string;
	docsDir: string;
	llmsTxt: string;
	readme: string;
	changelog: string;
	archivedDir: string;
	navigation: string;
	versionsCatalog: string;
	publishedReceipt: string;
	hugoConfig: string;
	/** Scratch root for generated overview content and edition projects. */
	workRoot: string;
	output: string;
}

export interface BuildOptions {
	/** Site origin without a trailing slash. */
	origin?: string;
	/** Final assembled output root. */
	output?: string;
	/** Overrides for testing against fixture repositories. */
	sitePaths?: Partial<SitePaths>;
	/** Development version label; defaults to package.json. */
	version?: string;
	/** Include a not-yet-published snapshot, clearly labelled. */
	candidate?: string;
	/** Hugo environment; "production" enables minification and indexing. */
	environment?: "production" | "development";
	verbose?: boolean;
}

export interface BuildResult {
	output: string;
	editions: { id: string; prefix: string; pages: number }[];
	published: string[];
	latestStable: string | null;
}

interface EditionSource {
	spec: EditionSpec;
	input: DocsInput;
	/** Root that this edition's canonical files live under. */
	contentRoot: string;
	sourceLinkBase: string | null;
	banner?: string;
	noindex: boolean;
}

interface MenuEntry {
	name: string;
	href: string;
	weight: number;
	parent?: string;
	identifier?: string;
	params?: Record<string, unknown>;
}

export function resolveSitePaths(
	overrides: Partial<SitePaths> = {},
): SitePaths {
	const siteDir = overrides.siteDir ?? paths.siteDir;
	const repoRoot = overrides.repoRoot ?? paths.repoRoot;
	return {
		repoRoot,
		siteDir,
		docsDir: overrides.docsDir ?? paths.docsDir,
		llmsTxt: overrides.llmsTxt ?? paths.llmsTxt,
		readme: overrides.readme ?? paths.readme,
		changelog: overrides.changelog ?? paths.changelog,
		archivedDir: overrides.archivedDir ?? join(siteDir, "archived"),
		navigation: overrides.navigation ?? join(siteDir, "navigation.yaml"),
		versionsCatalog:
			overrides.versionsCatalog ?? join(siteDir, "versions.yaml"),
		publishedReceipt:
			overrides.publishedReceipt ?? join(siteDir, "published.json"),
		hugoConfig: overrides.hugoConfig ?? join(siteDir, "hugo.yaml"),
		workRoot: overrides.workRoot ?? paths.siteBuildDir,
		output: overrides.output ?? paths.publicDir,
	};
}

function frontMatter(fields: Record<string, unknown>): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) continue;
		lines.push(`${key}: ${JSON.stringify(value)}`);
	}
	lines.push("---", "");
	return lines.join("\n");
}

/**
 * Stages one edition as a self-contained Hugo project: rewritten Markdown with
 * front matter under `content/`, the untouched Markdown and assets under
 * `static/`, and a generated `hugo.json` carrying this edition's base URL.
 */
export async function prepareEdition(
	source: EditionSource,
	projectDir: string,
	options: {
		origin: string;
		baseConfig: Record<string, unknown>;
		menu: MenuEntry[];
		sitePaths: SitePaths;
	},
): Promise<{ manifest: ContentManifest; diagnostics: LinkDiagnostic[] }> {
	const manifest = buildManifest(source.spec, source.input);
	const diagnostics: LinkDiagnostic[] = [];
	const { sitePaths } = options;

	rmSync(projectDir, { recursive: true, force: true });
	mkdirSync(join(projectDir, "content"), { recursive: true });
	mkdirSync(join(projectDir, "static"), { recursive: true });

	const canonicalPrefix = source.spec.canonicalPrefix;

	for (const page of manifest.pages) {
		const raw =
			page.body ?? stripFrontMatter(await Bun.file(page.absPath).text());
		const rewritten =
			page.origin === "generated"
				? { text: raw, diagnostics: [] as LinkDiagnostic[] }
				: rewriteMarkdown(raw, {
						pageAbsPath: page.absPath,
						manifest,
						repoRoot: source.contentRoot,
						sourceLinkBase: source.sourceLinkBase,
					});
		diagnostics.push(...rewritten.diagnostics);

		const body =
			page.origin === "generated"
				? rewritten.text
				: stripFirstH1(rewritten.text);

		const relRoute = page.route.slice(source.spec.prefix.length);
		const matter = frontMatter({
			title: page.title,
			weight: page.weight,
			type: "docs",
			noindex: source.noindex || undefined,
			canonical: canonicalPrefix
				? `${options.origin}${canonicalPrefix}${relRoute}`
				: undefined,
			koreRaw: page.rawRoute ?? undefined,
		});

		await Bun.write(
			join(projectDir, "content", page.stagedPath),
			matter + body,
		);
	}

	// Raw Markdown download tree: byte-identical canonical sources.
	for (const page of manifest.pages) {
		if (!page.rawRoute) continue;
		const target = join(
			projectDir,
			"static",
			page.rawRoute.slice(source.spec.prefix.length),
		);
		mkdirSync(dirname(target), { recursive: true });
		await Bun.write(target, Bun.file(page.absPath));
	}

	for (const asset of manifest.assets) {
		const target = join(projectDir, "static", asset.staticPath);
		mkdirSync(dirname(target), { recursive: true });
		if (asset.staticPath === "llms.txt") {
			const text = await Bun.file(asset.absPath).text();
			const rewritten = rewriteMarkdown(text, {
				pageAbsPath: asset.absPath,
				manifest,
				repoRoot: source.contentRoot,
				sourceLinkBase: source.sourceLinkBase,
				origin: options.origin,
			});
			diagnostics.push(...rewritten.diagnostics);
			await Bun.write(
				target,
				editionLlms(rewritten.text, source, options.origin),
			);
			continue;
		}
		await Bun.write(target, Bun.file(asset.absPath));
	}

	const params = {
		...((options.baseConfig.params as Record<string, unknown>) ?? {}),
		edition: {
			id: source.spec.id,
			version: source.spec.version,
			released: source.spec.released,
			sourceRef: source.spec.sourceRef,
		},
		...(source.banner
			? { banner: { message: source.banner, key: `kore-${source.spec.id}` } }
			: {}),
	};
	const config: Record<string, unknown> = {
		...options.baseConfig,
		baseURL: `${options.origin}${source.spec.prefix}`,
		menu: { main: options.menu.map(toHugoMenuEntry) },
		params,
	};
	await Bun.write(
		join(projectDir, "hugo.json"),
		`${JSON.stringify(config, null, "\t")}\n`,
	);

	await Bun.write(
		join(projectDir, "go.mod"),
		Bun.file(join(sitePaths.siteDir, "go.mod")),
	);
	await Bun.write(
		join(projectDir, "go.sum"),
		Bun.file(join(sitePaths.siteDir, "go.sum")),
	);
	if (existsSync(join(sitePaths.siteDir, "layouts"))) {
		await copyTree(
			join(sitePaths.siteDir, "layouts"),
			join(projectDir, "layouts"),
		);
	}
	if (existsSync(join(sitePaths.siteDir, "static"))) {
		await copyTree(
			join(sitePaths.siteDir, "static"),
			join(projectDir, "static"),
		);
	}

	return { manifest, diagnostics };
}

function toHugoMenuEntry(entry: MenuEntry): Record<string, unknown> {
	return {
		name: entry.name,
		weight: entry.weight,
		...(entry.identifier ? { identifier: entry.identifier } : {}),
		...(entry.parent ? { parent: entry.parent } : {}),
		params: { ...(entry.params ?? {}), href: entry.href },
	};
}

// Prepends an edition header so a downloaded llms.txt is self-describing.
function editionLlms(
	text: string,
	source: EditionSource,
	origin: string,
): string {
	const status = source.spec.released
		? `Documentation for released version ${source.spec.version}.`
		: `Documentation for unreleased version ${source.spec.version}. Not published to npm.`;
	const header = [
		`> Edition: ${source.spec.label}`,
		`> ${status}`,
		`> Canonical URL: ${origin}${source.spec.prefix}`,
		"",
	].join("\n");
	const lines = text.split("\n");
	const insertAt = lines.findIndex((line) => line.trim() === "");
	if (insertAt === -1) return `${text}\n\n${header}`;
	lines.splice(insertAt + 1, 0, header);
	return lines.join("\n");
}

export async function runHugo(
	projectDir: string,
	destination: string,
	options: { environment: string; verbose?: boolean; extraArgs?: string[] },
): Promise<void> {
	const args = [
		"hugo",
		"--source",
		projectDir,
		"--destination",
		destination,
		"--environment",
		options.environment,
		"--cleanDestinationDir",
		...(options.extraArgs ?? []),
	];
	if (options.environment === "production") args.push("--minify");
	const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (code !== 0) {
		throw new Error(
			`hugo failed for ${projectDir} (exit ${code}):\n${out}\n${err}`,
		);
	}
	if (options.verbose) console.log(out.trim());
}

/**
 * The versions that are both catalogued and recorded as published. A snapshot
 * present only in the catalog is a candidate and stays out of navigation.
 */
export function publishedVersions(
	catalog: VersionsCatalog,
	receipt: PublishedReceipt,
): string[] {
	const recorded = new Set(receipt.releases.map((r) => r.version));
	return catalog.releases
		.map((r) => r.version)
		.filter((v) => recorded.has(v))
		.sort(compareVersions)
		.reverse();
}

export function assertNoReservedCollision(manifest: ContentManifest): void {
	if (manifest.edition.prefix !== "/") return;
	for (const page of manifest.pages) {
		const first = page.route.split("/").filter(Boolean)[0];
		if (first && (RESERVED_ROUTES as readonly string[]).includes(first)) {
			throw new Error(
				`Route collision: ${page.stagedPath} claims reserved top-level route /${first}/.`,
			);
		}
	}
}

// Copies `from` into `to`, refusing to let one edition overwrite another's
// output. Hugo's own cleanup stays inside each edition's private directory.
function mergeTree(
	from: string,
	to: string,
	owner: string,
	owners: Map<string, string>,
): void {
	mkdirSync(to, { recursive: true });
	for (const name of readdirSync(from).sort()) {
		const source = join(from, name);
		const target = join(to, name);
		if (statSync(source).isDirectory()) {
			mergeTree(source, target, owner, owners);
			continue;
		}
		const previous = owners.get(target);
		if (previous && previous !== owner) {
			throw new Error(
				`Assembly collision at ${target}: written by both "${previous}" and "${owner}".`,
			);
		}
		owners.set(target, owner);
		copyFileSync(source, target);
	}
}

function rootDocsFor(root: string, prefixWeight = 60) {
	const docs: {
		absPath: string;
		slug: string;
		title: string;
		weight: number;
	}[] = [];
	if (existsSync(join(root, "README.md"))) {
		docs.push({
			absPath: join(root, "README.md"),
			slug: "readme",
			title: "Package README",
			weight: prefixWeight,
		});
	}
	if (existsSync(join(root, "CHANGELOG.md"))) {
		docs.push({
			absPath: join(root, "CHANGELOG.md"),
			slug: "changelog",
			title: "Changelog",
			weight: prefixWeight + 1,
		});
	}
	return docs;
}

// Newest version covered by the brief archive page.
function lastArchivedVersion(archivedDir: string): string {
	const text = readFileSync(join(archivedDir, "README.md"), "utf8");
	const match = /^##\s+v(\d+\.\d+\.\d+)/m.exec(text);
	if (!match?.[1]) {
		throw new Error(`${archivedDir}/README.md has no version heading.`);
	}
	return match[1];
}

async function snapshotSource(
	version: string,
	catalog: VersionsCatalog,
	prefix: string,
	candidate: boolean,
	sitePaths: SitePaths,
): Promise<EditionSource> {
	const entry = catalog.releases.find((r) => r.version === version);
	if (!entry) throw new Error(`No catalog entry for version ${version}.`);
	const root = resolve(sitePaths.repoRoot, entry.path);
	const navigation = await loadNavigation(join(root, "navigation.yaml"));
	return {
		spec: {
			id: prefix === "/" ? "root" : `v${version}`,
			prefix,
			label: `v${version}`,
			version,
			released: !candidate,
			sourceRef: entry.sourceRef,
		},
		input: {
			docsDir: join(root, "docs"),
			llmsTxt: existsSync(join(root, "llms.txt"))
				? join(root, "llms.txt")
				: null,
			rootDocs: rootDocsFor(root),
			navigation,
		},
		contentRoot: root,
		sourceLinkBase: sourceLinkBase(entry.sourceRef),
		banner: candidate
			? `Release candidate for v${version}. Not published to npm; do not link to this page.`
			: undefined,
		noindex: candidate,
	};
}

function buildMenu(
	published: string[],
	latestStable: string | null,
	catalog: VersionsCatalog,
	candidate?: string,
): MenuEntry[] {
	const menu: MenuEntry[] = [
		{ name: "Documentation", href: "/", weight: 1 },
		{
			name: latestStable ? `v${latestStable}` : catalog.development.label,
			href: "/",
			weight: 6,
			identifier: "version",
		},
	];
	let weight = 1;
	if (latestStable) {
		menu.push({
			name: `v${latestStable} (latest)`,
			href: "/",
			weight: weight++,
			parent: "version",
		});
	}
	for (const version of published) {
		if (version === latestStable) continue;
		menu.push({
			name: `v${version}`,
			href: `/v/${version}/`,
			weight: weight++,
			parent: "version",
		});
	}
	if (candidate) {
		menu.push({
			name: `v${candidate} (candidate)`,
			href: `/v/${candidate}/`,
			weight: weight++,
			parent: "version",
		});
	}
	menu.push({
		name: catalog.development.label,
		href: "/next/",
		weight: weight++,
		parent: "version",
	});
	menu.push({
		name: "Archived releases",
		href: "/archived/",
		weight: weight++,
		parent: "version",
	});
	menu.push({
		name: "Search",
		href: "",
		weight: 8,
		params: { type: "search" },
	});
	menu.push({
		name: "GitHub",
		href: "https://github.com/pencroff-lab/kore",
		weight: 9,
		params: { icon: "github" },
	});
	return menu;
}

/**
 * Builds every edition into its own Hugo project, then assembles them into one
 * complete artifact. The assembly is staged and promoted atomically, so a
 * failed build leaves the previous site in place.
 */
export async function buildSite(
	options: BuildOptions = {},
): Promise<BuildResult> {
	const sitePaths = resolveSitePaths({
		...options.sitePaths,
		...(options.output ? { output: options.output } : {}),
	});
	const origin = (options.origin ?? PRODUCTION_ORIGIN).replace(/\/$/, "");
	const environment = options.environment ?? "production";
	const workDir = join(sitePaths.workRoot, "editions");

	const [navigation, catalog, receipt, version, baseConfigText] =
		await Promise.all([
			loadNavigation(sitePaths.navigation),
			loadVersionsCatalog(sitePaths.versionsCatalog),
			loadPublishedReceipt(sitePaths.publishedReceipt),
			options.version ? Promise.resolve(options.version) : packageVersion(),
			Bun.file(sitePaths.hugoConfig).text(),
		]);
	const baseConfig = Bun.YAML.parse(baseConfigText) as Record<string, unknown>;

	const published = publishedVersions(catalog, receipt);
	const latestStable =
		receipt.latestStable && published.includes(receipt.latestStable)
			? receipt.latestStable
			: null;

	const sources: EditionSource[] = [];

	sources.push({
		spec: {
			id: "next",
			prefix: "/next/",
			label: catalog.development.label,
			version,
			released: false,
			sourceRef: catalog.development.sourceRef,
		},
		input: {
			docsDir: sitePaths.docsDir,
			llmsTxt: sitePaths.llmsTxt,
			rootDocs: rootDocsFor(sitePaths.repoRoot),
			navigation,
		},
		contentRoot: sitePaths.repoRoot,
		sourceLinkBase: sourceLinkBase(catalog.development.sourceRef),
		banner: `This is unreleased development documentation for ${catalog.development.label}. It is not published to npm.`,
		noindex: true,
	});

	for (const snapshotVersion of published) {
		sources.push(
			await snapshotSource(
				snapshotVersion,
				catalog,
				`/v/${snapshotVersion}/`,
				false,
				sitePaths,
			),
		);
	}

	if (options.candidate) {
		if (published.includes(options.candidate)) {
			throw new Error(
				`${options.candidate} is already published; pass it as a normal release, not a candidate.`,
			);
		}
		sources.push(
			await snapshotSource(
				options.candidate,
				catalog,
				`/v/${options.candidate}/`,
				true,
				sitePaths,
			),
		);
	}

	sources.push({
		spec: {
			id: "archived",
			prefix: "/archived/",
			label: "Archived releases",
			version: "archived",
			released: true,
			sourceRef: "main",
		},
		input: {
			docsDir: sitePaths.archivedDir,
			llmsTxt: null,
			rootDocs: [],
			navigation: { schemaVersion: 1, sections: [], pages: [] },
		},
		contentRoot: sitePaths.archivedDir,
		sourceLinkBase: null,
		noindex: false,
	});

	// Root edition: the latest published stable snapshot, or the overview.
	if (latestStable) {
		const stable = await snapshotSource(
			latestStable,
			catalog,
			"/",
			false,
			sitePaths,
		);
		sources.push({
			...stable,
			spec: {
				...stable.spec,
				id: "root",
				label: `v${latestStable} (latest)`,
				canonicalPrefix: `/v/${latestStable}/`,
			},
		});
	} else {
		const overviewDir = join(sitePaths.workRoot, "overview");
		const overviewLlms = join(sitePaths.workRoot, "overview-llms.txt");
		await writeOverview(overviewDir, overviewLlms, {
			developmentLabel: catalog.development.label,
			lastArchived: lastArchivedVersion(sitePaths.archivedDir),
			origin,
		});
		sources.push({
			spec: {
				id: "root",
				prefix: "/",
				label: "Overview",
				version: "overview",
				released: false,
				sourceRef: catalog.development.sourceRef,
			},
			input: {
				docsDir: overviewDir,
				llmsTxt: overviewLlms,
				rootDocs: [],
				navigation: { schemaVersion: 1, sections: [], pages: [] },
			},
			contentRoot: overviewDir,
			sourceLinkBase: null,
			noindex: false,
		});
	}

	const menu = buildMenu(published, latestStable, catalog, options.candidate);
	const editions: BuildResult["editions"] = [];
	const diagnostics: LinkDiagnostic[] = [];
	rmSync(workDir, { recursive: true, force: true });

	for (const source of sources) {
		const projectDir = join(workDir, source.spec.id);
		const prepared = await prepareEdition(source, projectDir, {
			origin,
			baseConfig,
			menu,
			sitePaths,
		});
		assertNoReservedCollision(prepared.manifest);
		diagnostics.push(...prepared.diagnostics);
		await runHugo(projectDir, join(projectDir, "public"), {
			environment,
			verbose: options.verbose,
		});
		editions.push({
			id: source.spec.id,
			prefix: source.spec.prefix,
			pages: prepared.manifest.pages.length,
		});
	}

	if (diagnostics.length > 0) {
		throw new Error(
			`Unresolved documentation links:\n${formatDiagnostics(
				diagnostics,
				sitePaths.repoRoot,
			)}`,
		);
	}

	const output = sitePaths.output;
	const staged = `${output}.staging`;
	rmSync(staged, { recursive: true, force: true });
	mkdirSync(staged, { recursive: true });
	const owners = new Map<string, string>();
	for (const source of sources) {
		const from = join(workDir, source.spec.id, "public");
		const to =
			source.spec.prefix === "/"
				? staged
				: join(staged, ...source.spec.prefix.split("/").filter(Boolean));
		mergeTree(from, to, source.spec.id, owners);
	}

	const previous = `${output}.previous`;
	rmSync(previous, { recursive: true, force: true });
	if (existsSync(output)) renameSync(output, previous);
	mkdirSync(dirname(output), { recursive: true });
	renameSync(staged, output);
	rmSync(previous, { recursive: true, force: true });

	return { output, editions, published, latestStable };
}
