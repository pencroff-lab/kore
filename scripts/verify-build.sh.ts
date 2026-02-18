import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

const required: string[] = [
	"dist/esm/index.js",
	"dist/esm/index.d.ts",
	"dist/cjs/index.js",
	"dist/cjs/package.json",
];

const optional: Array<{ path: string; label: string }> = [
	{ path: "LICENSE", label: "LICENSE" },
	{ path: "README.md", label: "README.md" },
];

let hasErrors = false;

for (const file of required) {
	const fullPath = resolve(root, file);
	if (!existsSync(fullPath)) {
		console.error(`MISSING (required): ${file}`);
		hasErrors = true;
	}
}

for (const { path, label } of optional) {
	const fullPath = resolve(root, path);
	if (!existsSync(fullPath)) {
		console.warn(`WARNING: ${label} is missing — recommended for npm packages`);
	}
}

if (hasErrors) {
	console.error("Build verification failed.");
	process.exit(1);
}

console.log("Build verification passed.");
