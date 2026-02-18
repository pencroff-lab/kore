import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cjsDir = resolve(import.meta.dir, "..", "dist", "cjs");

if (!existsSync(cjsDir)) {
	console.error("dist/cjs/ does not exist. Run build:cjs first.");
	process.exit(1);
}

const pkgPath = resolve(cjsDir, "package.json");
writeFileSync(pkgPath, `${JSON.stringify({ type: "commonjs" }, null, "\t")}\n`);
console.log("Wrote dist/cjs/package.json with type: commonjs");
