import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkgPath = resolve(import.meta.dir, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
	name: string;
	version: string;
};
const { name, version } = pkg;

const url = `https://registry.npmjs.org/${name}/${version}`;

try {
	const res = await fetch(url);

	if (res.ok) {
		console.error(`Version ${version} of ${name} already exists on npm.`);
		console.error("Bump the version in package.json before publishing.");
		process.exit(1);
	}

	if (res.status === 404) {
		console.log(`Version ${version} of ${name} is available for publishing.`);
		process.exit(0);
	}

	console.warn(`Unexpected response from npm registry: HTTP ${res.status}`);
} catch (err) {
	const message = err instanceof Error ? err.message : String(err);
	console.warn(`Could not reach npm registry: ${message}`);
}
