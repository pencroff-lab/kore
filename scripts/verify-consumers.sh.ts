import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const failures: string[] = [];

function check(label: string, condition: boolean): void {
	if (!condition) failures.push(label);
}

if (!existsSync(resolve(root, "dist/esm/index.js"))) {
	console.error("dist/ is missing. Run bun run build first.");
	process.exit(1);
}

// ─── Throwaway consumer workspace ────────────────────────────────────────────

const work = mkdtempSync(join(tmpdir(), "kore-consumers-"));
const scope = join(work, "node_modules", "@pencroff-lab");
mkdirSync(scope, { recursive: true });
symlinkSync(root, join(scope, "kore"), "dir");

const consumerBody = `
const t = ok(41);
const [value] = map(t, (n) => n + 1);
assert(value === 42, "map over ok");
assert(fail("nope", "NOPE")[1].code === "NOPE", "fail carries the code");
assert(pipe(ok(2), onOk((n) => ok(n * 2)))[0] === 4, "pipe stage");
assert(JSON.stringify(all([ok(1), ok(2)])[0]) === "[1,2]", "all collects values");
assert(fromJSON([1, null])[0] === 1, "fromJSON success");
assert(fromJSON("nope")[1].code === "INVALID_JSON", "fromJSON rejection");
assert(expectOk(ok(7)) === 7, "expectOk");
assert(expectErr(fail("boom")).message === "boom", "expectErr");
assert(Err.from("x", "CODE").code === "CODE", "Err still exported");
`;

const esmConsumer = `import { all, Err, fail, fromJSON, map, ok, onOk, pipe } from "@pencroff-lab/kore";
import { expectErr, expectOk } from "@pencroff-lab/kore/test";
import assert from "node:assert";
${consumerBody}
console.log("ESM consumer ok");
`;

const cjsConsumer = `const { all, Err, fail, fromJSON, map, ok, onOk, pipe } = require("@pencroff-lab/kore");
const { expectErr, expectOk } = require("@pencroff-lab/kore/test");
const assert = require("node:assert");
${consumerBody}
console.log("CJS consumer ok");
`;

// A declaration-only consumer: it type-checks against dist/esm/*.d.ts, so the
// emitted types carry readonly tuples, heterogeneous `all`, ten-stage pipeline
// inference, `ensure` refinement, and the tuple callback signatures.
const typesConsumer = `import {
	all,
	ensure,
	Err,
	fail,
	ok,
	onErr,
	onErrAsync,
	onOk,
	pipe,
	pipeAsync,
	type ResultTuple,
} from "@pencroff-lab/kore";
import { expectOk } from "@pencroff-lab/kore/test";

const tuple: ResultTuple<number> = ok(1);
// @ts-expect-error result tuples are readonly in the emitted declarations
tuple[0] = 2;

const heterogeneous: ResultTuple<[number, string]> = all([ok(1), ok("a")] as const);

const step = onOk((n: number) => ok(n + 1));
const tenStages: ResultTuple<string> = pipe(
	ok(0),
	step, step, step, step, step, step, step, step, step,
	onOk((n: number) => ok(String(n))),
);

// Stored recovery stages must keep the pipeline's success type: the factory has
// no inference site in an error callback, so only a stage generic in its own
// input survives being assigned to a variable.
const recover = onErr(() => ok("recovered"));
const recoverAsync = onErrAsync(async () => ok("recovered"));
const storedSync: ResultTuple<number | string> = pipe(ok(1), recover);
const storedMixed: Promise<ResultTuple<number | string>> = pipeAsync(
	ok(1),
	recover,
);
const storedAsync: Promise<ResultTuple<number | string>> = pipeAsync(
	ok(1),
	recoverAsync,
);

const refined: ResultTuple<string> = ensure(
	ok("x") as ResultTuple<string | number>,
	(v): v is string => typeof v === "string",
	() => Err.from("not a string"),
);

// @ts-expect-error a fallible callback must return a ResultTuple
const rejected = pipe(ok(1), onOk((n: number) => n + 1));

const failure: ResultTuple<never> = fail("nope");
export const checked = [
	heterogeneous,
	tenStages,
	refined,
	rejected,
	failure,
	storedSync,
	storedMixed,
	storedAsync,
	expectOk(tuple),
];
`;

const tsconfig = JSON.stringify({
	compilerOptions: {
		strict: true,
		noEmit: true,
		target: "ES2022",
		module: "ESNext",
		moduleResolution: "bundler",
		skipLibCheck: true,
	},
	include: ["types-consumer.ts"],
});

await Bun.write(join(work, "package.json"), '{"name":"kore-consumer-check"}\n');
await Bun.write(join(work, "consumer.mjs"), esmConsumer);
await Bun.write(join(work, "consumer.cjs"), cjsConsumer);
await Bun.write(join(work, "types-consumer.ts"), typesConsumer);
await Bun.write(join(work, "tsconfig.json"), tsconfig);

async function run(label: string, cmd: string[]): Promise<void> {
	const proc = Bun.spawn(cmd, { cwd: work, stdout: "pipe", stderr: "pipe" });
	const [out, err] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;
	if (code !== 0) {
		failures.push(`${label} (exit ${code})\n${out}${err}`.trimEnd());
		return;
	}
	console.log(out.trim() || `${label} ok`);
}

await run("ESM consumer", ["bun", "consumer.mjs"]);
await run("CJS consumer", ["bun", "consumer.cjs"]);
await run("declaration consumer", [
	"bunx",
	"tsc",
	"--project",
	join(work, "tsconfig.json"),
]);

// ─── Foreign-copy Err reconstruction ─────────────────────────────────────────

// dist/esm and dist/cjs load as separate module instances, so their Err classes
// are genuinely foreign to each other — the cross-copy case a published
// consumer hits when two versions meet.
const esm = (await import(resolve(root, "dist/esm/index.js"))) as {
	Err: typeof import("../src/types/err").Err;
};
const require_ = createRequire(import.meta.url);
const cjs = require_(resolve(root, "dist/cjs/index.js")) as {
	Err: typeof import("../src/types/err").Err;
};

check("the two builds load distinct Err classes", esm.Err !== cjs.Err);

const foreign = cjs.Err.from("root cause", "ROOT")
	.wrap("outer", { code: "OUTER", metadata: { path: "/tmp/x" } })
	.add(cjs.Err.from("child", "CHILD"));

const local = esm.Err.from(foreign);

check(
	"foreign copy is not recognized as a local instance",
	!esm.Err.isErr(foreign),
);
check("reconstruction yields a local instance", esm.Err.isErr(local));
check("message survives", local.message === "outer");
check("code survives", local.code === "OUTER");
check("metadata survives", local.getMetadata("path") === "/tmp/x");
check("cause chain survives", local.unwrap()?.message === "root cause");
check("cause code survives", local.hasCode("ROOT"));
check("children survive", local.errors.length === 1 && local.hasCode("CHILD"));

rmSync(work, { recursive: true, force: true });

if (failures.length > 0) {
	for (const f of failures) console.error(`FAIL: ${f}`);
	console.error(
		`\nConsumer verification failed: ${failures.length} failure(s)`,
	);
	process.exit(1);
}

console.log("Consumer verification passed.");
