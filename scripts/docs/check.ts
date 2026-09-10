import {
	existsSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { paths } from "./config";
import { copyTree, generateDocs, releaseTag } from "./generate";
import { isExternal, splitDestination } from "./links";
import { findDestinations } from "./markdown";
import { verifySnapshots } from "./snapshot";

export interface CheckResult {
	name: string;
	ok: boolean;
	details: string[];
}

export interface CheckOptions {
	/** Assembled site root; enables the rendered-link check. */
	site?: string;
	/** Skip the pack check when dist/ has not been built. */
	skipPack?: boolean;
	verbose?: boolean;
}

function listFiles(root: string, filter?: (f: string) => boolean): string[] {
	const out: string[] = [];
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir).sort()) {
			if (name.startsWith(".")) continue;
			const full = join(dir, name);
			if (statSync(full).isDirectory()) walk(full);
			else if (!filter || filter(full)) out.push(full);
		}
	};
	if (existsSync(root)) walk(root);
	return out;
}

async function run(
	cmd: string[],
	cwd: string,
): Promise<{ code: number; out: string; err: string }> {
	const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { code, out, err };
}

/** Runs the existing JSDoc budget and convention check over `src/`. */
export async function checkSourceDocs(): Promise<CheckResult> {
	const result = await run(
		["bun", join(paths.repoRoot, "scripts/check-docs.sh.ts")],
		paths.repoRoot,
	);
	return {
		name: "source documentation rules",
		ok: result.code === 0,
		details: result.code === 0 ? [] : [result.out.trim(), result.err.trim()],
	};
}

/**
 * Every local Markdown destination under a root must resolve to a file that
 * actually ships. Links into `src/` are the historical failure this catches.
 */
export async function checkCanonicalLinks(
	root: string = paths.repoRoot,
	entries: string[] = [paths.docsDir, paths.llmsTxt, paths.readme],
): Promise<CheckResult> {
	const details: string[] = [];
	const files: string[] = [];
	for (const entry of entries) {
		if (!existsSync(entry)) continue;
		if (statSync(entry).isDirectory()) {
			files.push(...listFiles(entry, (f) => f.endsWith(".md")));
		} else {
			files.push(entry);
		}
	}

	for (const file of files) {
		const source = await Bun.file(file).text();
		for (const destination of findDestinations(source)) {
			const value = destination.value;
			if (isExternal(value) || value.startsWith("#") || value === "") continue;
			if (value.startsWith("/")) continue;
			const parts = splitDestination(value);
			if (parts.path === "") continue;
			let decoded = parts.path;
			try {
				decoded = decodeURIComponent(parts.path);
			} catch {
				// Keep the raw path; the existence check below still applies.
			}
			const target = resolve(dirname(file), decoded);
			const where = `${relative(root, file)}:${destination.line}:${destination.column}`;
			if (!existsSync(target)) {
				details.push(`${where}: missing target ${JSON.stringify(value)}`);
				continue;
			}
			const rel = relative(root, target);
			if (rel.startsWith("src/") || rel.startsWith("scripts/")) {
				details.push(
					`${where}: ${JSON.stringify(value)} points at ${rel}, which the package does not ship`,
				);
			}
		}
	}

	return {
		name: "canonical Markdown links",
		ok: details.length === 0,
		details,
	};
}

/**
 * Regenerates the generator-owned directories into a scratch tree and compares
 * them with what is committed. This catches both a stale committed file and an
 * untracked leftover that `git diff --exit-code` alone would miss.
 */
export async function checkGenerationFreshness(): Promise<CheckResult> {
	const scratch = mkdtempSync(join(tmpdir(), "kore-docs-fresh-"));
	const details: string[] = [];
	try {
		await copyTree(join(paths.docsDir, "api"), join(scratch, "before/api"));
		await copyTree(
			join(paths.docsDir, "examples"),
			join(scratch, "before/examples"),
		);

		await generateDocs({ tag: await releaseTag() });

		for (const area of ["api", "examples"]) {
			const before = join(scratch, "before", area);
			const after = join(paths.docsDir, area);
			const beforeFiles = new Set(
				listFiles(before).map((f) => relative(before, f)),
			);
			const afterFiles = new Set(
				listFiles(after).map((f) => relative(after, f)),
			);
			for (const file of afterFiles) {
				if (!beforeFiles.has(file)) {
					details.push(`docs/${area}/${file}: generated but not committed`);
					continue;
				}
				const [a, b] = await Promise.all([
					Bun.file(join(before, file)).text(),
					Bun.file(join(after, file)).text(),
				]);
				if (a !== b) details.push(`docs/${area}/${file}: out of date`);
			}
			for (const file of beforeFiles) {
				if (!afterFiles.has(file)) {
					details.push(
						`docs/${area}/${file}: committed but no longer generated`,
					);
				}
			}
		}
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}

	return {
		name: "generated documentation freshness",
		ok: details.length === 0,
		details: details.length
			? [...details, "Run `bun run docs:generate` and commit the result."]
			: [],
	};
}

/** Re-validates every stored snapshot against its own manifest. */
export async function checkSnapshots(): Promise<CheckResult> {
	const results = await verifySnapshots();
	const bad = results.filter((r) => !r.ok);
	return {
		name: "release snapshot integrity",
		ok: bad.length === 0,
		details: bad.map((r) => `site/versions/${r.version}: ${r.detail}`),
	};
}

const REQUIRED_IN_PACKAGE = [
	"package/llms.txt",
	"package/docs/README.md",
	"package/docs/api/README.md",
	"package/docs/api/flow.md",
	"package/docs/examples/README.md",
	"package/docs/guides/flow-operation-flows.md",
	"package/CHANGELOG.md",
];

const FORBIDDEN_IN_PACKAGE = [
	/^package\/site\//,
	/^package\/build\//,
	/^package\/\.workspace\//,
	/^package\/scripts\//,
	/\.html$/,
];

/**
 * Reports archive members that must ship but are missing, and members that must
 * never ship but are present.
 */
export function classifyArchiveMembers(members: string[]): string[] {
	const problems: string[] = [];
	for (const required of REQUIRED_IN_PACKAGE) {
		if (!members.includes(required)) {
			problems.push(`archive is missing ${required}`);
		}
	}
	for (const member of members) {
		// One report per offending member, even when several rules match it.
		if (FORBIDDEN_IN_PACKAGE.some((rule) => rule.test(member))) {
			problems.push(`archive contains ${member}, which must not ship`);
		}
	}
	return problems;
}

/**
 * Packs a real archive, extracts it, and validates the documentation a
 * consumer actually receives — including that no site infrastructure leaked in.
 */
export async function checkPackagedDocs(): Promise<CheckResult> {
	const details: string[] = [];
	const scratch = mkdtempSync(join(tmpdir(), "kore-docs-pack-"));
	try {
		const packed = await run(
			[
				"bun",
				"pm",
				"pack",
				"--ignore-scripts",
				"--quiet",
				"--destination",
				scratch,
			],
			paths.repoRoot,
		);
		if (packed.code !== 0) {
			return {
				name: "packaged documentation",
				ok: false,
				details: [packed.out.trim(), packed.err.trim()],
			};
		}

		const tarball = readdirSync(scratch).find((f) => f.endsWith(".tgz"));
		if (!tarball) {
			return {
				name: "packaged documentation",
				ok: false,
				details: ["bun pm pack produced no tarball"],
			};
		}

		const listing = await run(["tar", "-tzf", join(scratch, tarball)], scratch);
		details.push(
			...classifyArchiveMembers(listing.out.split("\n").filter(Boolean)),
		);

		const extracted = join(scratch, "extracted");
		await run(["mkdir", "-p", extracted], scratch);
		const untar = await run(
			["tar", "-xzf", join(scratch, tarball), "-C", extracted],
			scratch,
		);
		if (untar.code !== 0) {
			details.push(`could not extract the archive: ${untar.err.trim()}`);
			return { name: "packaged documentation", ok: false, details };
		}

		// The extracted package has no src/ or repository context, so this
		// validates exactly what a consumer can follow.
		const packageRoot = join(extracted, "package");
		const linkCheck = await checkCanonicalLinks(packageRoot, [
			join(packageRoot, "docs"),
			join(packageRoot, "llms.txt"),
		]);
		details.push(...linkCheck.details.map((d) => `packaged: ${d}`));
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}

	return {
		name: "packaged documentation",
		ok: details.length === 0,
		details,
	};
}

/**
 * Validates internal links and fragments in rendered HTML, which is the only
 * place the Markdown renderer's heading anchors can be confirmed.
 */
export async function checkRenderedSite(
	siteRoot: string,
): Promise<CheckResult> {
	const details: string[] = [];
	const pages = listFiles(siteRoot, (f) => f.endsWith(".html"));
	const ids = new Map<string, Set<string>>();
	const bodies = new Map<string, string>();

	for (const page of pages) {
		const html = await Bun.file(page).text();
		bodies.set(page, html);
		const found = new Set<string>();
		for (const match of html.matchAll(/\sid=(?:"([^"]*)"|([^\s>]+))/g)) {
			found.add(match[1] ?? match[2] ?? "");
		}
		for (const match of html.matchAll(/\sname=(?:"([^"]*)"|([^\s>]+))/g)) {
			found.add(match[1] ?? match[2] ?? "");
		}
		ids.set(page, found);
	}

	const routeToFile = new Map<string, string>();
	for (const page of pages) {
		const rel = relative(siteRoot, page).split("\\").join("/");
		routeToFile.set(`/${rel}`, page);
		if (rel.endsWith("index.html")) {
			routeToFile.set(`/${rel.slice(0, -"index.html".length)}`, page);
		}
	}

	for (const page of pages) {
		const html = bodies.get(page) as string;
		const from = `/${relative(siteRoot, page).split("\\").join("/")}`;
		for (const match of html.matchAll(/href=(?:"([^"]*)"|([^\s>]+))/g)) {
			const href = match[1] ?? match[2] ?? "";
			if (!href.startsWith("/")) continue;
			const parts = splitDestination(href);
			const target = routeToFile.get(parts.path);
			if (!target) {
				if (existsSync(join(siteRoot, parts.path))) continue;
				details.push(`${from}: broken internal link ${href}`);
				continue;
			}
			if (parts.fragment.length > 1) {
				const anchor = decodeURIComponent(parts.fragment.slice(1));
				if (!ids.get(target)?.has(anchor)) {
					details.push(`${from}: missing fragment ${href}`);
				}
			}
		}
	}

	return {
		name: "rendered site links and fragments",
		ok: details.length === 0,
		details: details.slice(0, 40),
	};
}

export async function runChecks(
	options: CheckOptions = {},
): Promise<CheckResult[]> {
	const results: CheckResult[] = [];
	results.push(await checkSourceDocs());
	results.push(await checkCanonicalLinks());
	results.push(await checkGenerationFreshness());
	results.push(await checkSnapshots());
	if (!options.skipPack) results.push(await checkPackagedDocs());
	if (options.site) results.push(await checkRenderedSite(options.site));
	return results;
}
