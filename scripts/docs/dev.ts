import type { FSWatcher } from "node:fs";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
	watch,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { buildSite } from "./build";
import { paths } from "./config";
import { generateDocs, releaseTag } from "./generate";

export type LocalMode = "dev" | "preview";

export interface LocalServerOptions {
	mode: LocalMode;
	port?: number;
	candidate?: string;
	verbose?: boolean;
	/** Resolve after the first successful build instead of serving. */
	buildOnly?: boolean;
}

export const DEFAULT_PORTS: Record<LocalMode, number> = {
	dev: 1313,
	preview: 4173,
};

// Hugo's own LiveReload client. Static files are served verbatim, so the
// snippet Hugo injects into pages it renders never reaches the assembled
// HTML; the dev build adds it explicitly. Verified against Hugo 0.166.0.
export function liveReloadSnippet(port: number): string {
	return `<script src="/livereload.js?mindelay=10&amp;v=2&amp;port=${port}&amp;path=livereload" data-no-instant="data-no-instant"></script>`;
}

export function injectLiveReload(html: string, port: number): string {
	if (html.includes("/livereload.js?")) return html;
	const snippet = liveReloadSnippet(port);
	const close = html.lastIndexOf("</body>");
	if (close === -1) return html + snippet;
	return html.slice(0, close) + snippet + html.slice(close);
}

async function injectLiveReloadTree(root: string, port: number): Promise<void> {
	for (const file of listFiles(root)) {
		if (!file.endsWith(".html")) continue;
		const html = await Bun.file(file).text();
		await Bun.write(file, injectLiveReload(html, port));
	}
}

function listFiles(root: string): string[] {
	const out: string[] = [];
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir).sort()) {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) walk(full);
			else out.push(full);
		}
	};
	if (existsSync(root)) walk(root);
	return out;
}

/**
 * Mirrors `from` into `to` in place. The destination directory keeps its
 * identity, so Hugo's watch registrations on the served tree survive a rebuild.
 */
export function syncTree(from: string, to: string): void {
	mkdirSync(to, { recursive: true });
	const wanted = new Set(listFiles(from).map((file) => relative(from, file)));

	for (const rel of wanted) {
		const source = join(from, rel);
		const target = join(to, rel);
		mkdirSync(dirname(target), { recursive: true });
		if (existsSync(target) && sameFile(source, target)) continue;
		copyFileSync(source, target);
	}

	for (const file of listFiles(to)) {
		const rel = relative(to, file);
		if (!wanted.has(rel)) rmSync(file, { force: true });
	}
	pruneEmptyDirs(to);
}

function sameFile(a: string, b: string): boolean {
	const sa = statSync(a);
	const sb = statSync(b);
	return sa.size === sb.size && sa.mtimeMs <= sb.mtimeMs;
}

function pruneEmptyDirs(root: string): void {
	for (const name of readdirSync(root)) {
		const full = join(root, name);
		if (!statSync(full).isDirectory()) continue;
		pruneEmptyDirs(full);
		if (readdirSync(full).length === 0) rmSync(full, { recursive: true });
	}
}

/**
 * Writes the minimal Hugo project that serves the assembled site locally. The
 * assembled tree is the project's own `static/` directory rather than an
 * external mount, so Hugo's normal static watching applies to it.
 */
export async function writeHostProject(
	hostDir: string,
	origin: string,
): Promise<void> {
	rmSync(join(hostDir, "layouts"), { recursive: true, force: true });
	rmSync(join(hostDir, "hugo.json"), { force: true });
	mkdirSync(join(hostDir, "layouts"), { recursive: true });

	// The home page cannot be disabled — Hugo panics assembling a site with no
	// home output format — so it is routed to a throwaway file name instead,
	// leaving the assembled index.html untouched.
	const config = {
		baseURL: `${origin}/`,
		title: "kore documentation (local)",
		disableKinds: [
			"page",
			"section",
			"taxonomy",
			"term",
			"rss",
			"sitemap",
			"robotsTXT",
			"404",
		],
		outputFormats: {
			hostidx: {
				mediaType: "text/html",
				baseName: "_hugo-host",
				isHTML: true,
				ugly: true,
			},
		},
		outputs: { home: ["hostidx"] },
	};
	await Bun.write(
		join(hostDir, "hugo.json"),
		`${JSON.stringify(config, null, "\t")}\n`,
	);
	await Bun.write(
		join(hostDir, "layouts", "home.hostidx.html"),
		"<!doctype html><title>kore documentation (local)</title>\n",
	);
}

interface Paths {
	localRoot: string;
	staging: string;
	assembled: string;
	hostDir: string;
	hostPublic: string;
}

function localPaths(mode: LocalMode): Paths {
	const localRoot = join(paths.siteLocalDir, mode);
	const hostDir = join(localRoot, "host");
	return {
		localRoot,
		staging: join(localRoot, "staging"),
		assembled: join(hostDir, "static"),
		hostDir,
		hostPublic: join(localRoot, "host-public"),
	};
}

/** Canonical inputs whose change requires re-preparing the current edition. */
export function watchTargets(): { path: string; regenerate: boolean }[] {
	return [
		{ path: paths.docsDir, regenerate: false },
		{ path: paths.llmsTxt, regenerate: false },
		{ path: join(paths.siteDir, "archived"), regenerate: false },
		{ path: paths.hugoConfig, regenerate: false },
		{ path: paths.navigation, regenerate: false },
		{ path: paths.versionsCatalog, regenerate: false },
		{ path: paths.publishedReceipt, regenerate: false },
		{ path: join(paths.siteDir, "assets"), regenerate: false },
		{ path: join(paths.siteDir, "layouts"), regenerate: false },
		{ path: paths.readme, regenerate: false },
		{ path: paths.changelog, regenerate: false },
		{ path: join(paths.repoRoot, "src"), regenerate: true },
	];
}

export async function serveLocal(options: LocalServerOptions): Promise<number> {
	const mode = options.mode;
	const port = options.port ?? DEFAULT_PORTS[mode];
	const origin = `http://localhost:${port}`;
	const p = localPaths(mode);

	if (mode === "preview") {
		rmSync(p.localRoot, { recursive: true, force: true });
	}
	mkdirSync(p.localRoot, { recursive: true });

	const runBuild = async (): Promise<void> => {
		await buildSite({
			origin,
			output: p.staging,
			candidate: options.candidate,
			environment: mode === "preview" ? "production" : "development",
			verbose: options.verbose,
		});
		if (mode === "dev") await injectLiveReloadTree(p.staging, port);
		syncTree(p.staging, p.assembled);
	};

	console.log(`Building the combined site for ${origin}/ …`);
	await writeHostProject(p.hostDir, origin);
	await runBuild();
	console.log(
		[
			`  ${origin}/           overview or latest stable`,
			`  ${origin}/next/      development documentation`,
			`  ${origin}/archived/  brief pre-0.7.0 release summaries`,
		].join("\n"),
	);

	if (options.buildOnly) return port;

	const hugoArgs = [
		"hugo",
		"server",
		"--source",
		p.hostDir,
		"--destination",
		p.hostPublic,
		"--bind",
		"127.0.0.1",
		"--port",
		String(port),
	];
	if (mode === "preview") {
		hugoArgs.push("--watch=false", "--disableLiveReload");
	} else {
		// Fast render mode can serve a stale static file after a rebuild.
		hugoArgs.push("--disableFastRender");
	}

	const server = Bun.spawn(hugoArgs, {
		stdout: "inherit",
		stderr: "inherit",
	});

	const watchers: FSWatcher[] = [];
	let stopping = false;
	const stop = (): void => {
		if (stopping) return;
		stopping = true;
		for (const watcher of watchers) watcher.close();
		server.kill();
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);

	if (mode === "dev") {
		startWatchers(watchers, async (regenerate) => {
			try {
				if (regenerate) {
					console.log("Source changed; regenerating API and example docs …");
					await generateDocs({ tag: await releaseTag() });
				}
				console.log("Rebuilding the combined site …");
				await runBuild();
				console.log("Rebuild complete.");
			} catch (error) {
				// Keep the last good output available and stay running.
				console.error(
					`Rebuild failed; the previously served site is unchanged.\n${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		});
	}

	await server.exited;
	stop();
	return port;
}

/**
 * Fingerprints the watched inputs by size and modification time.
 *
 * The watcher cannot be trusted on its own: preparing an edition *reads*
 * `docs/` and `site/layouts/`, and the recursive watcher reports those reads as
 * change events, so every build would retrigger itself. Comparing fingerprints
 * makes a rebuild depend on the content actually changing.
 */
export function fingerprintInputs(
	targets: { path: string }[] = watchTargets(),
): string {
	const parts: string[] = [];
	for (const target of targets) {
		if (!existsSync(target.path)) continue;
		const files = statSync(target.path).isDirectory()
			? listFiles(target.path)
			: [target.path];
		for (const file of files) {
			const stat = statSync(file);
			parts.push(`${file}:${stat.size}:${stat.mtimeMs}`);
		}
	}
	return parts.sort().join("\n");
}

// Debounced, serialized rebuild queue over the canonical inputs.
function startWatchers(
	watchers: FSWatcher[],
	rebuild: (regenerate: boolean) => Promise<void>,
): void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let running = false;
	let queued = false;
	let queuedRegenerate = false;
	let lastFingerprint = fingerprintInputs();

	const flush = async (): Promise<void> => {
		if (running) {
			queued = true;
			return;
		}
		const fingerprint = fingerprintInputs();
		if (fingerprint === lastFingerprint) {
			queuedRegenerate = false;
			return;
		}
		lastFingerprint = fingerprint;
		running = true;
		const regenerate = queuedRegenerate;
		queuedRegenerate = false;
		await rebuild(regenerate);
		// Generation rewrites docs/; re-read so its own writes do not requeue.
		lastFingerprint = fingerprintInputs();
		running = false;
		if (queued) {
			queued = false;
			void flush();
		}
	};

	const schedule = (regenerate: boolean): void => {
		queuedRegenerate = queuedRegenerate || regenerate;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void flush();
		}, 250);
	};

	for (const target of watchTargets()) {
		if (!existsSync(target.path)) continue;
		try {
			watchers.push(
				watch(target.path, { recursive: true }, () =>
					schedule(target.regenerate),
				),
			);
		} catch {
			// A platform without recursive watching still gets the Hugo watcher on
			// the assembled tree; report it rather than failing the command.
			console.warn(`Not watching ${target.path}: recursive watch unavailable.`);
		}
	}
}
