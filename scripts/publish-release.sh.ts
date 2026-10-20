import { paths } from "./docs/config";
import { queryRegistry, type RegistryFacts } from "./docs/publication";

const intervalMs = 20_000;
const timeoutMs = 30 * 60_000;

// Bound individual registry commands as well as the overall polling period.
async function registry(version: string): Promise<RegistryFacts | null> {
	return queryRegistry(version, async (cmd) => {
		const child = Bun.spawn(cmd, {
			cwd: paths.repoRoot,
			env: { ...process.env, NPM_TOKEN: "---" },
			stdout: "pipe",
			stderr: "pipe",
			timeout: 30_000,
		});
		const [out, err, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		return { out, err, code };
	});
}

async function publish(): Promise<void> {
	const child = Bun.spawn(["bun", "run", "publish_pkg"], {
		cwd: paths.repoRoot,
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await child.exited;
	if (code !== 0) throw new Error(`publish_pkg failed with exit ${code}.`);
}

interface PublishAdapters {
	registry: (version: string) => Promise<RegistryFacts | null>;
	publish: () => Promise<void>;
	notice: (message: string) => void;
}

/** Skips an existing immutable version so failed release jobs can be rerun. */
export async function publishIfMissing(
	version: string,
	adapters: PublishAdapters = { registry, publish, notice: console.log },
): Promise<void> {
	const existing = await adapters.registry(version);
	if (existing) {
		if (existing.version !== version)
			throw new Error(
				`Expected ${version}; registry returned ${existing.version}.`,
			);
		adapters.notice(
			`::notice::@pencroff-lab/kore@${version} already exists; trusting the existing registry artifact and skipping publish. No local artifact comparison is made; registry readiness and tag/receipt checks still run.`,
		);
		return;
	}
	await adapters.publish();
}

interface WaitAdapters {
	registry: (version: string) => Promise<RegistryFacts | null>;
	now: () => number;
	sleep: (ms: number) => Promise<void>;
	log: (message: string) => void;
}

/** Waits up to thirty minutes for the exact version, integrity and latest tag. */
export async function waitForPublication(
	version: string,
	adapters: WaitAdapters = {
		registry,
		now: Date.now,
		sleep: (ms) => Bun.sleep(ms),
		log: console.log,
	},
): Promise<void> {
	const deadline = adapters.now() + timeoutMs;
	let last = "version not available";
	while (true) {
		try {
			const facts = await adapters.registry(version);
			if (
				facts?.version === version &&
				facts.integrity &&
				facts.distTags.includes("latest")
			) {
				adapters.log(
					`Verified @pencroff-lab/kore@${version} is available with integrity and dist-tag latest.`,
				);
				return;
			}
			last = facts
				? `version=${facts.version}, integrity=${facts.integrity ? "present" : "missing"}, dist-tags=${facts.distTags.join(",") || "none"}`
				: "version not available";
		} catch (error) {
			last = `registry probe failed: ${error instanceof Error ? error.message : String(error)}`;
		}
		const remaining = deadline - adapters.now();
		if (remaining <= 0)
			throw new Error(
				`Timed out after 30 minutes waiting for @pencroff-lab/kore@${version} and dist-tag latest=${version}. Last observation: ${last}.`,
			);
		adapters.log(
			`Waiting for npm post-publish validation: ${last}; retrying in ${Math.min(intervalMs, remaining) / 1000}s.`,
		);
		await adapters.sleep(Math.min(intervalMs, remaining));
	}
}

if (import.meta.main) {
	const [mode, version] = Bun.argv.slice(2);
	if (!version || (mode !== "publish" && mode !== "wait"))
		throw new Error(
			"Usage: bun scripts/publish-release.sh.ts <publish|wait> <version>",
		);
	if (mode === "publish") await publishIfMissing(version);
	else await waitForPublication(version);
}
