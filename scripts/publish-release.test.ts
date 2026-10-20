import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { YAML } from "bun";
import sinon from "sinon";
import type { RegistryFacts } from "./docs/publication";
import { publishIfMissing, waitForPublication } from "./publish-release.sh";

const version = "0.7.1";
const available: RegistryFacts = {
	version,
	integrity: "sha512-registry-artifact",
	distTags: ["latest"],
};

describe("release publish recovery", () => {
	let sandbox: sinon.SinonSandbox;
	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});
	afterEach(() => sandbox.restore());

	test.each([
		{ label: "missing version is published", facts: null, skip: false },
		{
			label: "existing version is trusted and skipped",
			facts: available,
			skip: true,
		},
		{
			label: "existing version without latest is still skipped",
			facts: { ...available, distTags: [] },
			skip: true,
		},
	])("$label", async ({ facts, skip }) => {
		const registry = sandbox
			.stub<[string], Promise<RegistryFacts | null>>()
			.resolves(facts && { ...facts, distTags: [...facts.distTags] });
		const publish = sandbox.stub<[], Promise<void>>().resolves();
		const notice = sandbox.stub<[string], void>();
		await publishIfMissing(version, { registry, publish, notice });
		sinon.assert.calledOnceWithExactly(registry, version);
		if (skip) {
			sinon.assert.notCalled(publish);
			sinon.assert.calledOnce(notice);
			expect(notice.firstCall.args[0]).toContain(
				"trusting the existing registry artifact",
			);
			expect(notice.firstCall.args[0]).toContain(
				"No local artifact comparison",
			);
		} else {
			sinon.assert.calledOnce(publish);
			sinon.assert.notCalled(notice);
		}
	});

	test.each([
		{ stage: "registry" },
		{ stage: "publish" },
	])("$stage failure is not reported as a successful publish", async ({
		stage,
	}) => {
		const registry = sandbox
			.stub<[string], Promise<RegistryFacts | null>>()
			.resolves(null);
		const publish = sandbox.stub<[], Promise<void>>().resolves();
		const notice = sandbox.stub<[string], void>();
		const error = new Error(`${stage} failed`);
		if (stage === "registry") registry.rejects(error);
		else publish.rejects(error);
		await expect(
			publishIfMissing(version, { registry, publish, notice }),
		).rejects.toBe(error);
		sinon.assert.notCalled(notice);
		if (stage === "registry") sinon.assert.notCalled(publish);
	});

	test.each([
		{
			label: "ready immediately",
			first: available,
			transientError: false,
			waits: 0,
		},
		{
			label: "version becomes visible",
			first: null,
			transientError: false,
			waits: 1,
		},
		{
			label: "latest catches up after the version",
			first: { ...available, distTags: [] },
			transientError: false,
			waits: 1,
		},
		{
			label: "integrity becomes available",
			first: { ...available, integrity: "" },
			transientError: false,
			waits: 1,
		},
		{
			label: "a mismatched response is not ready",
			first: { ...available, version: "0.7.0" },
			transientError: false,
			waits: 1,
		},
		{
			label: "transient probe errors are retried",
			first: null,
			transientError: true,
			waits: 1,
		},
	])("$label", async ({ first, transientError, waits }) => {
		let elapsed = 0;
		const registry = sandbox
			.stub<[string], Promise<RegistryFacts | null>>()
			.resolves(available);
		if (transientError)
			registry.onFirstCall().rejects(new Error("registry unavailable"));
		else
			registry
				.onFirstCall()
				.resolves(first && { ...first, distTags: [...first.distTags] });
		const now = sandbox.stub<[], number>().callsFake(() => elapsed);
		const sleep = sandbox
			.stub<[number], Promise<void>>()
			.callsFake(async (ms) => {
				elapsed += ms;
			});
		const log = sandbox.stub<[string], void>();
		await waitForPublication(version, { registry, now, sleep, log });
		expect(elapsed).toBe(waits * 20_000);
		sinon.assert.callCount(registry, waits + 1);
		sinon.assert.alwaysCalledWithExactly(registry, version);
		if (waits) sinon.assert.calledOnceWithExactly(sleep, 20_000);
		else sinon.assert.notCalled(sleep);
		expect(log.lastCall.args[0]).toContain(
			"available with integrity and dist-tag latest",
		);
	});

	test.each([
		{
			label: "version stays unavailable",
			facts: null,
			observation: "version not available",
		},
		{
			label: "latest never moves",
			facts: { ...available, distTags: ["next"] },
			observation: "dist-tags=next",
		},
	])("times out clearly when $label", async ({ facts, observation }) => {
		let elapsed = 0;
		const registry = sandbox
			.stub<[string], Promise<RegistryFacts | null>>()
			.resolves(facts && { ...facts, distTags: [...facts.distTags] });
		const now = sandbox.stub<[], number>().callsFake(() => elapsed);
		const sleep = sandbox
			.stub<[number], Promise<void>>()
			.callsFake(async (ms) => {
				elapsed += ms;
			});
		const log = sandbox.stub<[string], void>();
		await expect(
			waitForPublication(version, { registry, now, sleep, log }),
		).rejects.toThrow(
			`Timed out after 30 minutes waiting for @pencroff-lab/kore@0.7.1 and dist-tag latest=0.7.1. Last observation: ${observation === "version not available" ? observation : `version=0.7.1, integrity=present, ${observation}`}.`,
		);
		expect(elapsed).toBe(30 * 60_000);
		sinon.assert.callCount(sleep, 90);
		sinon.assert.alwaysCalledWithExactly(sleep, 20_000);
	});

	test("workflow publishes conditionally and waits before tag and receipt verification", async () => {
		const workflow = YAML.parse(
			await Bun.file(
				resolve(import.meta.dir, "../.github/workflows/ci.yml"),
			).text(),
		) as {
			jobs: {
				publish: {
					steps: { name: string; run?: string; env?: Record<string, string> }[];
				};
			};
		};
		const steps = workflow.jobs.publish.steps;
		const publish = steps.findIndex((step) => step.name === "Publish");
		const verify = steps.findIndex(
			(step) => step.name === "Verify the exact published version",
		);
		const tag = steps.findIndex(
			(step) => step.name === "Create or verify the release tag at this commit",
		);
		const record = steps.findIndex(
			(step) =>
				step.name === "Verify publication and produce the receipt patch",
		);
		expect(steps[publish]?.run).toBe(
			'bun scripts/publish-release.sh.ts publish "$VERSION"',
		);
		expect(steps[verify]?.run).toBe(
			'bun scripts/publish-release.sh.ts wait "$VERSION"',
		);
		expect(steps[publish]?.env?.VERSION).toBe(
			`\${{ needs.release_state.outputs.version }}`,
		);
		expect(steps[verify]?.env?.VERSION).toBe(steps[publish]?.env?.VERSION);
		expect(verify).toBeGreaterThan(publish);
		expect(tag).toBeGreaterThan(verify);
		expect(record).toBeGreaterThan(tag);
		expect(steps[record]?.run).toContain("bun run docs:record-publication");
	});
});
