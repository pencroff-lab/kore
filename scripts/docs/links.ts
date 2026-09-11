import { existsSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { ContentManifest } from "./content";
import type { Destination } from "./markdown";
import { rewriteDestinations } from "./markdown";

export interface LinkDiagnostic {
	file: string;
	line: number;
	column: number;
	destination: string;
	reason: string;
}

export interface RewriteOptions {
	/** Canonical file the destinations were written in. */
	pageAbsPath: string;
	manifest: ContentManifest;
	/** Repository root, used to build source citations. */
	repoRoot: string;
	/** GitHub blob base for files outside the documented set. */
	sourceLinkBase: string | null;
	/** Origin to prepend, for absolute web links such as llms.txt. */
	origin?: string | null;
	/** Path reported in diagnostics; defaults to `pageAbsPath`. */
	reportAs?: string;
}

export interface RewriteResult {
	text: string;
	diagnostics: LinkDiagnostic[];
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

interface SplitDestination {
	path: string;
	query: string;
	fragment: string;
}

export function splitDestination(destination: string): SplitDestination {
	const hash = destination.indexOf("#");
	const fragment = hash === -1 ? "" : destination.slice(hash);
	const head = hash === -1 ? destination : destination.slice(0, hash);
	const mark = head.indexOf("?");
	return {
		path: mark === -1 ? head : head.slice(0, mark),
		query: mark === -1 ? "" : head.slice(mark),
		fragment,
	};
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

// Percent-encodes the characters a Markdown destination cannot carry raw.
function encodeRoute(route: string): string {
	return route.replace(/[ "'<>`]/g, (ch) => encodeURIComponent(ch));
}

export function isExternal(destination: string): boolean {
	return SCHEME.test(destination) || destination.startsWith("//");
}

/**
 * Resolves one local Markdown destination to its edition-absolute route.
 * Returns `null` when the destination is not local, and a diagnostic reason
 * when it is local but resolves outside the documented set.
 */
export function resolveDestination(
	destination: string,
	options: RewriteOptions,
): { route: string } | { reason: string } | null {
	if (destination === "" || destination.startsWith("#")) return null;
	if (isExternal(destination)) return null;

	const parts = splitDestination(destination);
	if (parts.path === "") return null;

	// A root-absolute destination is already a final site route: canonical
	// Markdown always links relatively, so this only appears in content the
	// build itself generates.
	if (parts.path.startsWith("/")) return { route: destination };

	const { manifest, pageAbsPath, repoRoot, sourceLinkBase } = options;
	const decoded = safeDecode(parts.path);
	const target = resolve(dirname(pageAbsPath), decoded.replace(/\/+$/, ""));

	const page = manifest.byAbsPath.get(target);
	if (page) return { route: page.route + parts.query + parts.fragment };

	const asset = manifest.byAssetAbsPath.get(target);
	if (asset) return { route: asset.route + parts.query + parts.fragment };

	const dirIndex = manifest.indexByDir.get(target);
	if (dirIndex) return { route: dirIndex.route + parts.query + parts.fragment };

	if (!existsSync(target)) {
		return { reason: "target does not exist" };
	}

	const insideRepo = !relative(repoRoot, target).startsWith("..");
	if (insideRepo && sourceLinkBase) {
		const rel = relative(repoRoot, target).split("\\").join("/");
		const suffix = statSync(target).isDirectory() ? "/" : "";
		return {
			route: `${sourceLinkBase}${rel}${suffix}${parts.query}${parts.fragment}`,
		};
	}

	return {
		reason: insideRepo
			? "resolves outside the documented set and no source link base is configured"
			: "resolves outside the repository",
	};
}

/**
 * Rewrites every local destination in a Markdown document to its route in
 * this edition, collecting a diagnostic for each destination it cannot map.
 */
export function rewriteMarkdown(
	source: string,
	options: RewriteOptions,
): RewriteResult {
	const diagnostics: LinkDiagnostic[] = [];
	const file = options.reportAs ?? options.pageAbsPath;
	const origin = options.origin ?? "";

	const text = rewriteDestinations(source, (destination: Destination) => {
		const resolved = resolveDestination(destination.value, options);
		if (resolved === null) return null;
		if ("reason" in resolved) {
			diagnostics.push({
				file,
				line: destination.line,
				column: destination.column,
				destination: destination.value,
				reason: resolved.reason,
			});
			return null;
		}
		const absolute = isExternal(resolved.route)
			? resolved.route
			: origin + resolved.route;
		return encodeRoute(absolute);
	});

	return { text, diagnostics };
}

export function formatDiagnostics(
	diagnostics: LinkDiagnostic[],
	repoRoot: string,
): string {
	return diagnostics
		.map((d) => {
			const rel = relative(repoRoot, d.file).split("\\").join("/") || d.file;
			return `${rel}:${d.line}:${d.column}: unresolved link ${JSON.stringify(
				d.destination,
			)} — ${d.reason}`;
		})
		.join("\n");
}
