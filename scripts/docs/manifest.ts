import { createHash } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export interface ReleaseManifest {
	schemaVersion: 1;
	version: string;
	sourceRef: string;
	/** Relative POSIX path -> SHA-256 of the file, sorted by path. */
	files: Record<string, string>;
	/** SHA-256 over the sorted path/hash pairs. */
	digest: string;
}

export const MANIFEST_FILENAME = "release.json";

function toPosix(path: string): string {
	return path.split(sep).join("/");
}

/** Rejects paths that escape the input root or traverse a symlink. */
export function assertSafePath(root: string, absPath: string): void {
	const rel = relative(root, absPath);
	if (rel === "" || rel.startsWith("..") || resolve(root, rel) !== absPath) {
		throw new Error(`Refusing path outside the snapshot root: ${absPath}`);
	}
	let current = root;
	for (const segment of toPosix(rel).split("/")) {
		current = join(current, segment);
		if (lstatSync(current).isSymbolicLink()) {
			throw new Error(`Refusing symlink inside the snapshot: ${current}`);
		}
	}
}

export function listContentFiles(root: string): string[] {
	const out: string[] = [];
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir).sort()) {
			const full = join(dir, name);
			const stat = lstatSync(full);
			if (stat.isSymbolicLink()) {
				throw new Error(`Refusing symlink inside the snapshot: ${full}`);
			}
			if (stat.isDirectory()) {
				walk(full);
				continue;
			}
			if (toPosix(relative(root, full)) === MANIFEST_FILENAME) continue;
			out.push(full);
		}
	};
	walk(root);
	return out.sort();
}

export async function hashFile(absPath: string): Promise<string> {
	const bytes = await Bun.file(absPath).arrayBuffer();
	return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function contentDigest(files: Record<string, string>): string {
	const hash = createHash("sha256");
	for (const path of Object.keys(files).sort()) {
		hash.update(`${path} ${files[path]}\n`);
	}
	return hash.digest("hex");
}

/**
 * Hashes every file under `root`, excluding the manifest itself, and derives
 * one content digest from the sorted path/hash entries.
 */
export async function computeReleaseManifest(
	root: string,
	meta: { version: string; sourceRef: string },
): Promise<ReleaseManifest> {
	const files: Record<string, string> = {};
	for (const absPath of listContentFiles(root)) {
		assertSafePath(root, absPath);
		files[toPosix(relative(root, absPath))] = await hashFile(absPath);
	}
	const sorted: Record<string, string> = {};
	for (const path of Object.keys(files).sort()) {
		sorted[path] = files[path] as string;
	}
	return {
		schemaVersion: 1,
		version: meta.version,
		sourceRef: meta.sourceRef,
		files: sorted,
		digest: contentDigest(sorted),
	};
}

export interface ManifestComparison {
	ok: boolean;
	missing: string[];
	added: string[];
	changed: string[];
}

/** Validates a directory against a stored manifest. */
export async function verifyAgainstManifest(
	root: string,
	manifest: ReleaseManifest,
): Promise<ManifestComparison> {
	const actual = await computeReleaseManifest(root, {
		version: manifest.version,
		sourceRef: manifest.sourceRef,
	});
	const missing: string[] = [];
	const changed: string[] = [];
	for (const [path, hash] of Object.entries(manifest.files)) {
		const found = actual.files[path];
		if (found === undefined) missing.push(path);
		else if (found !== hash) changed.push(path);
	}
	const added = Object.keys(actual.files).filter(
		(path) => manifest.files[path] === undefined,
	);
	return {
		ok:
			missing.length === 0 &&
			added.length === 0 &&
			changed.length === 0 &&
			actual.digest === manifest.digest,
		missing,
		added,
		changed,
	};
}

export async function readManifest(root: string): Promise<ReleaseManifest> {
	const file = join(root, MANIFEST_FILENAME);
	const parsed = JSON.parse(await Bun.file(file).text()) as ReleaseManifest;
	if (parsed.schemaVersion !== 1) {
		throw new Error(
			`${file}: unsupported schemaVersion ${parsed.schemaVersion}`,
		);
	}
	return parsed;
}

export async function writeManifest(
	root: string,
	manifest: ReleaseManifest,
): Promise<void> {
	await Bun.write(
		join(root, MANIFEST_FILENAME),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);
}
