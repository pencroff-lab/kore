#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildSite } from "./docs/build";
import { runChecks } from "./docs/check";
import { repoRoot as repoRootDir } from "./docs/config";
import { DEFAULT_PORTS, serveLocal } from "./docs/dev";
import { generateDocs, releaseTag } from "./docs/generate";
import { recordPublication } from "./docs/publication";
import { readReleaseState, renderGithubOutput } from "./docs/release_state";
import { createSnapshot } from "./docs/snapshot";

// Single CLI dispatcher for every `docs:*` package script.

interface ParsedArgs {
	command: string;
	positional: string[];
	options: Map<string, string | true>;
}

export class UsageError extends Error {}
export class NotImplementedError extends Error {}

const COMMANDS = [
	["generate", "Regenerate docs/api and docs/examples from source"],
	["prepare", "Stage canonical Markdown as Hugo input for one edition"],
	["build", "Build and assemble the complete production site"],
	["dev", "Serve the combined site locally with reload (port 1313)"],
	["preview", "Serve a production-settings build locally (port 4173)"],
	["snapshot", "Save site/versions/<version>/ for a finalized release"],
	["check", "Validate source docs, links, freshness and snapshots"],
	["release-state", "Classify this commit as release, docs-only or unprepared"],
	["record-publication", "Record a verified npm release in published.json"],
	["help", "Show this message"],
] as const;

const KNOWN_OPTIONS = new Set([
	"port",
	"origin",
	"output",
	"edition",
	"candidate",
	"verbose",
	"tag",
	"site",
	"dist-tag",
	"source-commit",
	"registry-integrity",
	"dry-run",
	"fix",
	"help",
]);

export function parseArgs(argv: string[]): ParsedArgs {
	const [command = "help", ...rest] = argv;
	const positional: string[] = [];
	const options = new Map<string, string | true>();

	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i] as string;
		if (!arg.startsWith("--")) {
			positional.push(arg);
			continue;
		}
		const body = arg.slice(2);
		const eq = body.indexOf("=");
		const name = eq === -1 ? body : body.slice(0, eq);
		if (!KNOWN_OPTIONS.has(name)) {
			throw new UsageError(`Unknown option --${name}`);
		}
		if (eq !== -1) {
			options.set(name, body.slice(eq + 1));
			continue;
		}
		const next = rest[i + 1];
		if (next !== undefined && !next.startsWith("--")) {
			options.set(name, next);
			i++;
		} else {
			options.set(name, true);
		}
	}

	return { command, positional, options };
}

async function safeRead(file: string): Promise<string> {
	const handle = Bun.file(file);
	return (await handle.exists()) ? handle.text() : "";
}

function usage(): string {
	const width = Math.max(...COMMANDS.map(([name]) => name.length));
	const lines = COMMANDS.map(
		([name, help]) => `  ${name.padEnd(width)}  ${help}`,
	);
	return [
		"Usage: bun scripts/docs.sh.ts <command> [options]",
		"",
		"Commands:",
		...lines,
		"",
		"Common options:",
		"  --origin <url>   Site origin (default https://kore.lab.pencroff.com)",
		"  --output <dir>   Output root override",
		"  --port <number>  Local server port",
		"  --verbose        Print each step",
	].join("\n");
}

function optionString(
	args: ParsedArgs,
	name: string,
	fallback?: string,
): string | undefined {
	const value = args.options.get(name);
	if (value === undefined) return fallback;
	if (value === true) throw new UsageError(`--${name} requires a value`);
	return value;
}

async function run(args: ParsedArgs): Promise<void> {
	switch (args.command) {
		case "help":
		case "--help":
			console.log(usage());
			return;

		case "generate": {
			const tag = optionString(args, "tag") ?? (await releaseTag());
			const result = await generateDocs({
				tag,
				verbose: args.options.has("verbose"),
			});
			console.log(
				`docs:generate wrote ${result.apiFiles.length} API page(s) and ${result.exampleFiles.length} example page(s) pinned to ${tag}.`,
			);
			return;
		}

		case "build": {
			const result = await buildSite({
				origin: optionString(args, "origin"),
				output: optionString(args, "output"),
				candidate: optionString(args, "candidate"),
				verbose: args.options.has("verbose"),
			});
			const summary = result.editions
				.map((e) => `${e.prefix} (${e.pages} pages)`)
				.join(", ");
			console.log(`docs:build wrote ${result.output}\n  editions: ${summary}`);
			return;
		}

		case "snapshot": {
			const version = args.positional[0];
			if (!version) {
				throw new UsageError("docs:snapshot requires a version, e.g. 0.7.1");
			}
			const result = await createSnapshot({
				version,
				verbose: args.options.has("verbose"),
			});
			console.log(
				result.created
					? `Created ${result.path} (digest ${result.digest.slice(0, 12)}).`
					: `${result.path} already matches (digest ${result.digest.slice(0, 12)}); nothing to do.`,
			);
			return;
		}

		case "dev":
		case "preview": {
			const raw = optionString(args, "port");
			const port =
				raw === undefined ? DEFAULT_PORTS[args.command] : Number(raw);
			if (!Number.isInteger(port) || port < 1 || port > 65535) {
				throw new UsageError(`--port must be a port number, got "${raw}"`);
			}
			await serveLocal({
				mode: args.command,
				port,
				candidate: optionString(args, "candidate"),
				verbose: args.options.has("verbose"),
			});
			return;
		}

		case "check": {
			const results = await runChecks({
				site: optionString(args, "site"),
				skipPack: !existsSync(join(repoRootDir, "dist")),
				verbose: args.options.has("verbose"),
			});
			let failed = 0;
			for (const result of results) {
				console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}`);
				for (const detail of result.details) {
					if (detail.trim()) console.log(`        ${detail}`);
				}
				if (!result.ok) failed++;
			}
			if (!existsSync(join(repoRootDir, "dist"))) {
				console.log(
					"NOTE  packaged documentation check skipped: run `bun run build` first.",
				);
			}
			if (failed > 0) {
				throw new Error(`${failed} documentation check(s) failed.`);
			}
			console.log(`All ${results.length} documentation checks passed.`);
			return;
		}

		case "release-state": {
			const state = await readReleaseState();
			console.log(renderGithubOutput(state));
			console.error(state.reason);
			const outputFile = Bun.env.GITHUB_OUTPUT;
			if (outputFile) {
				await Bun.write(
					outputFile,
					`${await safeRead(outputFile)}${renderGithubOutput(state)}\n`,
				);
			}
			return;
		}

		case "record-publication": {
			const version = args.positional[0];
			if (!version) {
				throw new UsageError(
					"docs:record-publication requires a version, e.g. 0.7.0",
				);
			}
			const outcome = await recordPublication({
				version,
				distTag: optionString(args, "dist-tag"),
				dryRun: args.options.has("dry-run"),
			});
			console.log(
				`Verified ${version}: npm integrity ${outcome.release.registryIntegrity}, tag v${version} at ${outcome.release.sourceCommit.slice(0, 12)}, snapshot digest ${outcome.release.snapshotDigest.slice(0, 12)}.`,
			);
			console.log(
				outcome.promoted
					? `Promoted ${version} to the default edition.`
					: `Default edition unchanged (latest stable: ${outcome.receipt.latestStable ?? "none"}).`,
			);
			if (!outcome.changed) {
				console.log("Receipt already up to date; nothing written.");
				return;
			}
			console.log(
				args.options.has("dry-run")
					? `Dry run: ${outcome.receiptPath} not written. Patch:\n${outcome.patch}`
					: `Updated ${outcome.receiptPath}. Commit it as the documentation-only finalization change.`,
			);
			return;
		}

		case "prepare":
			throw new NotImplementedError(
				"docs:prepare is not a separate command: `docs:build`, `docs:dev` and `docs:preview` each prepare the editions they render.",
			);

		default:
			throw new UsageError(`Unknown command "${args.command}"`);
	}
}

if (import.meta.main) {
	try {
		await run(parseArgs(Bun.argv.slice(2)));
	} catch (error) {
		if (error instanceof UsageError) {
			console.error(`Error: ${error.message}\n`);
			console.error(usage());
			process.exit(2);
		}
		if (error instanceof NotImplementedError) {
			console.error(`Error: ${error.message}`);
			process.exit(3);
		}
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

export { run, usage };
