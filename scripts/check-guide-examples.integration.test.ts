import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";

const root = resolve(import.meta.dir, "..");

// Extract the actual first code block under a named heading, never a copy.
function snippet(source: string, heading: string): string {
	let found = false;
	for (const node of fromMarkdown(source).children) {
		if (node.type === "heading") {
			const text = node.children
				.map((child) => ("value" in child ? child.value : ""))
				.join("");
			if (found) break;
			found = text === heading;
		} else if (found && node.type === "code") {
			return node.value;
		}
	}
	throw new Error(`Missing guide snippet: ${heading}`);
}

// Only application-specific types/dependencies live here; guide functions are
// extracted verbatim into separate modules, with their published imports intact.
const support = `
import sinon from "sinon";
import { Err, ok, type Logger, type ResultTuple } from "@pencroff-lab/kore";
import type { ExecutionContext } from "./context";

export interface Args { plan: string; dryRun?: boolean; }
export type ArgumentsCamelCase<T> = T;
export type Handler = (argv: Args) => Promise<void>;
export interface Database { name: string; }
export interface Config { paths: { workspace_dir: string }; }
export interface LlmConfig { model: string; }
export interface Section { title: string; index: number; }
export interface GeneratedNote { path: string; content: string; }
export interface User { name: string; }
export interface Profile extends User { displayName: string; }
export interface HttpResponse { status: number; body: Profile | { error: string }; }
interface ShellResult { exitCode: number; stdout: { toString(): string }; }

export const sandbox = sinon.createSandbox();
export const log = sandbox.stub() as unknown as Logger;
Object.assign(log, {
  TRACE: "trace", DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error", FATAL: "fatal",
  child: sandbox.stub().returns(log),
});
export const mockDb: Database = { name: "test" };
export const testConfig: Config = { paths: { workspace_dir: "/unused" } };
export const note: GeneratedNote = { path: "note.md", content: "note" };
export const section: Section = { title: "Section", index: 1 };
export const sections = [section];
export const deps = { db: mockDb, config: testConfig, log };
export const ctx: ExecutionContext = { runId: "run", dryRun: false, log, dryRunLog: null };
export const state = {
  async shell(): Promise<ShellResult> { return { exitCode: 0, stdout: { toString: () => "output" } }; },
  parse(_output: string): ResultTuple<GeneratedNote> { return ok(note); },
  async loadConfig(): Promise<ResultTuple<Config>> { return ok(testConfig); },
  database(_path: string): ResultTuple<Database> { return ok(mockDb); },
  factory(_deps: typeof deps): ResultTuple<Handler> { return ok(async () => {}); },
  query(_sql: string, _params: string[]): ResultTuple<User> { return ok({ name: "Ada" }); },
};
export const $ = (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
  nothrow: () => ({ quiet: () => state.shell() }),
});
export const buildPrompt = (value: Section): string => value.title;
export const parseNoteOutput = (output: string): ResultTuple<GeneratedNote> => state.parse(output);
export const resolvePath = (value: GeneratedNote): string => value.path;
export const createContext = (_args: Args, _deps: typeof deps): ExecutionContext => ctx;
export const loadConfig = (): Promise<ResultTuple<Config>> => state.loadConfig();
export const createDatabase = (path: string): ResultTuple<Database> => state.database(path);
export const createHandler = (value: typeof deps): ResultTuple<Handler> => state.factory(value);
export const db = { query: (sql: string, params: string[]): ResultTuple<User> => state.query(sql, params) };
export const command = {
  command(_options: { command: string; handler: Handler }) { return command; },
  async parse(): Promise<void> {},
};
export const yargs = (_args: string[]) => command;
export const hideBin = (argv: string[]): string[] => argv.slice(2);
`;

const runner = `
import { expect } from "bun:test";
import sinon from "sinon";
import { Err, fail, fromJSON, ok } from "@pencroff-lab/kore";
import { expectOk, expectErr } from "@pencroff-lab/kore/test";
import { callClaude } from "./origin";
import { generateNote } from "./intermediate";
import { handler } from "./boundary";
import { saveNote } from "./saving";
import { initializeCli } from "./initialization";
import { createClaudeService } from "./service";
import { getProfile, handleRequest } from "./propagation";
import { createHandler } from "./factory";
import { parseConfig as liftedConfig } from "./migration-lifted";
import { parseConfig as explicitConfig } from "./migration-explicit";
import { sandbox, state, log, ctx, note, section, deps, testConfig, mockDb, command } from "./support";

try {
  const shell = sandbox.stub(state, "shell").resolves({ exitCode: 0, stdout: { toString: () => "output" } });
  const parse = sandbox.stub(state, "parse").returns(ok(note));
  const logger = log as unknown as sinon.SinonStub;
  expect(expectOk(await callClaude("prompt", ctx))).toEqual("output");
  expect(expectOk(await generateNote(section, ctx))).toEqual(note);
  await handler({ plan: "test" });
  sinon.assert.neverCalledWith(logger, log.ERROR);

  logger.resetHistory();
  parse.resetHistory();
  shell.resolves({ exitCode: 1, stdout: { toString: () => "" } });
  const cliError = expectErr(await generateNote(section, ctx));
  expect(cliError.message).toEqual('Failed to generate note for "Section"');
  expect(cliError.root.code).toEqual("CLI_ERROR");
  expect(cliError.root.getMetadata<number>("exitCode")).toEqual(1);
  sinon.assert.notCalled(parse);
  logger.resetHistory();
  await handler({ plan: "test" });
  sinon.assert.calledOnceWithExactly(logger.withArgs(log.DEBUG), log.DEBUG, "Claude CLI failed", sinon.match.instanceOf(Err));
  sinon.assert.calledOnce(logger.withArgs(log.ERROR));
  expect(logger.withArgs(log.ERROR).firstCall.args[2].root.code).toEqual("CLI_ERROR");

  shell.resolves({ exitCode: 0, stdout: { toString: () => "output" } });
  parse.returns(fail("bad format", "PARSE"));
  logger.resetHistory();
  await handler({ plan: "test" });
  sinon.assert.calledOnce(logger.withArgs(log.DEBUG));
  sinon.assert.calledOnce(logger.withArgs(log.ERROR));
  expect(logger.withArgs(log.ERROR).firstCall.args[2].root.code).toEqual("PARSE");

  shell.rejects(new Error("shell rejected"));
  expect(expectErr(await callClaude("prompt", ctx)).message).toEqual("shell rejected");
  shell.throws(new Error("shell threw"));
  expect(expectErr(await callClaude("prompt", ctx)).message).toEqual("shell threw");

  const write = sandbox.stub(Bun, "write").resolves(4);
  expect(expectOk(await saveNote(note, { ...ctx, dryRun: true, dryRunLog: log }))).toEqual(note.path);
  sinon.assert.notCalled(write);
  sinon.assert.calledWith(logger, log.INFO, "Would write note", sinon.match({ path: note.path }));
  let finishWrite: (bytes: number) => void = () => {};
  write.returns(new Promise<number>((resolve) => { finishWrite = resolve; }));
  logger.resetHistory();
  const saved = saveNote(note, ctx);
  sinon.assert.notCalled(logger.withArgs(log.INFO, "Wrote note"));
  finishWrite(4);
  expect(expectOk(await saved)).toEqual(note.path);
  sinon.assert.calledOnce(write);
  expect<unknown[]>(write.firstCall.args).toEqual([note.path, note.content]);
  write.rejects(new Error("disk full"));
  expect(expectErr(await saveNote(note, ctx)).message).toEqual("disk full");

  const load = sandbox.stub(state, "loadConfig");
  const database = sandbox.stub(state, "database").returns(ok(mockDb));
  const factory = sandbox.stub(state, "factory").returns(ok(async () => {}));
  const run = sandbox.stub(command, "parse").resolves();
  let finishLoad: (value: ReturnType<typeof ok<typeof testConfig>>) => void = () => {};
  load.returns(new Promise((resolve) => { finishLoad = resolve; }));
  const initialized = initializeCli();
  sinon.assert.notCalled(database);
  finishLoad(ok(testConfig));
  const initialization = await initialized;
  expect(initialization[1]).toEqual(null);
  expect(initialization[0]).toEqual(undefined);
  sinon.assert.callOrder(load, database, factory, run);
  for (const stage of ["config", "database", "handler"] as const) {
    load.resolves(ok(testConfig)); database.returns(ok(mockDb)); factory.returns(ok(async () => {}));
    run.resetHistory();
    if (stage === "config") load.resolves(fail(stage));
    if (stage === "database") database.returns(fail(stage));
    if (stage === "handler") factory.returns(fail(stage));
    expect(expectErr(await initializeCli()).message).toEqual(stage);
    sinon.assert.notCalled(run);
  }

  const serviceShell = { run: sandbox.stub().resolves("answer") };
  const service = createClaudeService({ shell: serviceShell, log, config: { model: "test" } });
  expect(expectOk(await service.generate("question"))).toEqual("answer");
  sinon.assert.calledWithExactly(serviceShell.run, "question", "test");
  serviceShell.run.rejects(new Error("service failed"));
  expect(expectErr(await service.generate("question")).message).toEqual("service failed");

  const query = sandbox.stub(state, "query").returns(ok({ name: "Ada" }));
  expect(expectOk(getProfile("1"))).toEqual({ name: "Ada", displayName: "Ada" });
  expect(handleRequest("1")).toEqual({ status: 200, body: { name: "Ada", displayName: "Ada" } });
  for (const row of [{ code: "NOT_FOUND", status: 404 }, { code: "DATABASE", status: 500 }]) {
    query.returns(fail("missing", row.code));
    const error = expectErr(getProfile("1"));
    expect(error.code).toEqual("PROFILE_ERROR");
    expect(error.root.code).toEqual(row.code);
    expect(handleRequest("1")).toEqual({ status: row.status, body: { error: "getProfile failed" } });
  }
  query.throws(new Error("database threw"));
  expect(expectErr(getProfile("1")).message).toEqual("database threw");
  expect(expectErr(fromJSON("bad envelope")).code).toEqual("INVALID_JSON");

  for (const parseConfig of [liftedConfig, explicitConfig]) {
    expect(expectOk(parseConfig('{"port":8080}'))).toEqual({ port: 8080, host: "localhost" });
    for (const raw of ["{}", "null", "[7,null]", "broken", '{"port":"bad"}', '{"port":1,"host":false}']) {
      expect(expectErr(parseConfig(raw)) instanceof Err).toEqual(true);
    }
  }
  expect(expectErr(explicitConfig("broken")).code).toEqual("PARSE_ERROR");

  const actualHandler = expectOk(createHandler(deps));
  await actualHandler({ plan: "test" });
  sinon.assert.calledWith(logger, log.INFO, "Starting handler");
  const rejectedExtraction = sandbox.spy(() => expectOk(fail("no handler")));
  try { rejectedExtraction(); } catch {}
  sinon.assert.threw(rejectedExtraction);
  await import("./testing");
} finally {
  sandbox.restore();
}
`;

test("rewritten guide snippets compile strictly and run success, failure and async ordering paths from source", async () => {
	const work = mkdtempSync(join(tmpdir(), "kore-guide-examples-"));
	try {
		const logging = await Bun.file(
			join(root, "docs/guides/logging_guide.md"),
		).text();
		const errors = await Bun.file(
			join(root, "docs/guides/error-handling-patterns.md"),
		).text();
		const migration = await Bun.file(
			join(root, "docs/guides/migration-from-throwing.md"),
		).text();
		for (const row of [
			{ file: "migration-lifted", heading: "Step 2: Wrap with attemptValue()" },
			{
				file: "migration-explicit",
				heading: "Step 3: Replace throws with explicit failures",
			},
		]) {
			await Bun.write(
				join(work, `${row.file}.ts`),
				`${snippet(migration, row.heading)}\ninterface Config { port: number; host: string; }\nexport { parseConfig };\n`,
			);
		}
		const modules = [
			{
				file: "context",
				heading: "Execution Context",
				prelude: "",
				exports: "export type { ExecutionContext };",
			},
			{
				file: "factory",
				heading: "Logger DI Pattern",
				prelude:
					'import type { Args, ArgumentsCamelCase, Config, Database, Handler } from "./support";\nimport type { ExecutionContext } from "./context";',
				exports: "export { createHandler };",
			},
			{
				file: "origin",
				heading: "Service Layer (Origin) - DEBUG Only",
				prelude:
					'import { $ } from "./support";\nimport type { ExecutionContext } from "./context";',
				exports: "export { callClaude };",
			},
			{
				file: "intermediate",
				heading: "Intermediate Layer - Wrap Error, No Logging",
				prelude:
					'import { buildPrompt, parseNoteOutput, type GeneratedNote, type Section } from "./support";\nimport { callClaude } from "./origin";\nimport type { ExecutionContext } from "./context";',
				exports: "export { generateNote };",
			},
			{
				file: "boundary",
				heading: "Handler Boundary - ERROR Once",
				prelude:
					'import { createContext, deps, sections, type Args } from "./support";\nimport { generateNote } from "./intermediate";',
				exports: "export { handler };",
			},
			{
				file: "saving",
				heading: "Dry-Run Logging Pattern",
				prelude:
					'import { resolvePath, type GeneratedNote } from "./support";\nimport type { ExecutionContext } from "./context";',
				exports: "export { saveNote };",
			},
			{
				file: "service",
				heading: "Service Logger Injection",
				prelude: 'import type { LlmConfig } from "./support";',
				exports: "export { createClaudeService };",
			},
			{
				file: "initialization",
				heading: "CLI Initialization with Logger",
				prelude:
					'import { createDatabase, createHandler, hideBin, loadConfig, yargs } from "./support";',
				exports: "export { initializeCli };",
			},
			{
				file: "testing",
				heading: "Testing with Logger",
				prelude:
					'import { mockDb, testConfig } from "./support";\nimport { createHandler } from "./factory";',
				exports: "",
			},
		];
		for (const module of modules) {
			await Bun.write(
				join(work, `${module.file}.ts`),
				`${module.prelude}\n${snippet(logging, module.heading)}\n${module.exports}\n`,
			);
		}
		await Bun.write(
			join(work, "propagation.ts"),
			`import { db, type User, type Profile, type HttpResponse } from "./support";\n${snippet(errors, "Propagation through call stacks")}\nexport { getProfile, handleRequest };\n`,
		);
		await Bun.write(join(work, "support.ts"), support);
		await Bun.write(join(work, "runner.ts"), runner);
		symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");
		await Bun.write(
			join(work, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					strict: true,
					noUncheckedIndexedAccess: true,
					noEmit: true,
					target: "ES2022",
					lib: ["ES2022"],
					module: "Preserve",
					moduleResolution: "bundler",
					allowImportingTsExtensions: true,
					skipLibCheck: true,
					types: ["bun"],
					baseUrl: root,
					paths: {
						"@pencroff-lab/kore": ["./index.ts"],
						"@pencroff-lab/kore/test": ["./test.ts"],
					},
				},
				include: ["*.ts"],
			}),
		);
		for (const cmd of [
			[
				"bun",
				join(root, "node_modules/typescript/bin/tsc"),
				"--project",
				join(work, "tsconfig.json"),
			],
			[
				"bun",
				"--tsconfig-override",
				join(work, "tsconfig.json"),
				join(work, "runner.ts"),
			],
		]) {
			const process = Bun.spawn(cmd, {
				cwd: work,
				stdout: "pipe",
				stderr: "pipe",
				env: { ...Bun.env, NODE_ENV: "test" },
			});
			const [out, err, status] = await Promise.all([
				new Response(process.stdout).text(),
				new Response(process.stderr).text(),
				process.exited,
			]);
			expect({ status, output: `${out}${err}` }).toMatchObject({ status: 0 });
		}
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}, 30_000);
