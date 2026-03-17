import { resolve } from "node:path";
import { Glob } from "bun";

const root = resolve(import.meta.dir, "..");
const docsDir = resolve(root, "docs/api");
const mediaDir = resolve(docsDir, "_media");

const glob = new Glob("*.md");

for await (const filePath of glob.scan({ cwd: docsDir, absolute: true })) {
	let content = await Bun.file(filePath).text();
	let changed = false;

	// Replace _media/ links with relative paths to src/
	const mediaLinkRe = /\((_media\/(\w+\.examples\.test\.ts))\)/g;
	const replaced = content.replace(mediaLinkRe, (_match, _media, filename) => {
		changed = true;
		// Find where this file lives in src/
		const typesPath = resolve(root, "src/types", filename);
		const utilsPath = resolve(root, "src/utils", filename);

		if (Bun.file(typesPath).size) {
			return `(../../src/types/${filename})`;
		}
		if (Bun.file(utilsPath).size) {
			return `(../../src/utils/${filename})`;
		}
		// Fallback: keep _media link
		return `(${_media})`;
	});

	if (changed) {
		await Bun.write(filePath, replaced);
	}
}

// Remove _media directory if it exists
const { existsSync, rmSync } = await import("node:fs");
if (existsSync(mediaDir)) {
	rmSync(mediaDir, { recursive: true });
}

console.log("Fixed docs links and removed _media/");
