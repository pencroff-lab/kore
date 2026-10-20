import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { YAML } from "bun";
import sinon from "sinon";

interface Step {
	name: string;
	id?: string;
	uses?: string;
	"continue-on-error"?: boolean;
	env?: Record<string, string>;
	with?: { script?: string; "github-token"?: string };
	run?: string;
}

interface ContentRequest {
	owner: string;
	repo: string;
	path: string;
	ref: string;
}

interface FileContent {
	type: "file";
	encoding: "base64";
	content: string;
	sha: string;
}

interface UpdateRequest extends Omit<ContentRequest, "ref"> {
	branch: string;
	sha: string;
	content: string;
	message: string;
}

const workflow = YAML.parse(
	await Bun.file(
		resolve(import.meta.dir, "../.github/workflows/ci.yml"),
	).text(),
) as { jobs: { publish: { steps: Step[] } } };
const steps = workflow.jobs.publish.steps;
const commit = steps.find((step) => step.id === "receipt_commit");
const summary = steps.find(
	(step) => step.name === "Explain the finalization step",
);
const receipt = '{"schemaVersion":1,"latestStable":"0.7.1","releases":[]}\n';
const context = {
	repo: { owner: "fixture", repo: "kore" },
	sha: "release-commit",
};
const file = { ...context.repo, path: "site/published.json" };

describe("publication receipt workflow", () => {
	let sandbox: sinon.SinonSandbox;
	let work: string;
	beforeEach(() => {
		sandbox = sinon.createSandbox();
		work = mkdtempSync(join(tmpdir(), "kore-receipt-workflow-"));
		mkdirSync(join(work, "site"));
		writeFileSync(join(work, "site/published.json"), receipt);
	});
	afterEach(() => {
		sandbox.restore();
		rmSync(work, { recursive: true, force: true });
	});

	test.each([
		{ label: "commits the verified receipt", outcome: "commit", status: 0 },
		{ label: "an identical rerun is a no-op", outcome: "noop", status: 0 },
		{
			label: "a newer receipt rejects the stale update",
			outcome: "error",
			status: 409,
		},
		{
			label: "non-conflict API errors propagate",
			outcome: "error",
			status: 403,
		},
	])("$label", async ({ outcome, status }) => {
		const getContent = sandbox.stub<
			[ContentRequest],
			Promise<{ data: FileContent }>
		>();
		const update = sandbox
			.stub<[UpdateRequest], Promise<unknown>>()
			.resolves({});
		const info = sandbox.stub<[string], void>();
		const current =
			outcome === "noop"
				? receipt
				: status === 409
					? '{"latestStable":"0.8.0"}\n'
					: '{"latestStable":"0.7.0"}\n';
		getContent.onFirstCall().resolves({
			data: {
				type: "file",
				encoding: "base64",
				content: Buffer.from(current).toString("base64"),
				sha: status === 409 ? "newer-main-blob" : "release-blob",
			},
		});
		getContent.onSecondCall().resolves({
			data: {
				type: "file",
				encoding: "base64",
				content: "",
				sha: "release-blob",
			},
		});
		const error = Object.assign(new Error(`GitHub API ${status}`), { status });
		if (outcome === "error") update.rejects(error);
		if (!commit?.with?.script) throw new Error("Missing receipt script");
		const result: Promise<unknown> = runInNewContext(
			`(async () => {\n${commit.with.script}\n})()`,
			{
				github: {
					rest: { repos: { getContent, createOrUpdateFileContents: update } },
				},
				context,
				core: { info },
				require: createRequire(import.meta.url),
				process: { env: { GITHUB_WORKSPACE: work, VERSION: "0.7.1" } },
				Buffer,
			},
		);
		if (outcome === "error") await expect(result).rejects.toBe(error);
		else await result;

		sinon.assert.calledWithExactly(getContent.firstCall, {
			...file,
			ref: "main",
		});
		if (outcome === "noop") {
			sinon.assert.calledOnce(getContent);
			sinon.assert.notCalled(update);
			sinon.assert.calledOnceWithExactly(
				info,
				"Receipt for 0.7.1 is already current on main.",
			);
		} else {
			sinon.assert.calledTwice(getContent);
			sinon.assert.calledWithExactly(getContent.secondCall, {
				...file,
				ref: context.sha,
			});
			sinon.assert.calledOnceWithExactly(update, {
				...file,
				branch: "main",
				sha: "release-blob",
				content: Buffer.from(receipt).toString("base64"),
				message: "docs: record 0.7.1 publication",
			});
			if (outcome === "error") sinon.assert.notCalled(info);
			else
				sinon.assert.calledOnceWithExactly(
					info,
					"Committed the verified 0.7.1 receipt to main.",
				);
		}
	});

	test("keeps verification and artifact upload before the nonblocking token-backed commit", () => {
		expect(commit?.uses).toBe("actions/github-script@v7");
		expect(commit?.["continue-on-error"]).toBe(true);
		expect(commit?.with?.["github-token"]).toBe(
			`\${{ secrets.REPO_TAG_TOKEN }}`,
		);
		expect(commit?.env?.VERSION).toBe(
			`\${{ needs.release_state.outputs.version }}`,
		);
		const verification = steps.findIndex(
			(step) =>
				step.name === "Verify publication and produce the receipt patch",
		);
		const artifact = steps.findIndex(
			(step) => step.uses === "actions/upload-artifact@v4",
		);
		const receiptCommit = steps.findIndex(
			(step) => step.id === "receipt_commit",
		);
		expect(verification).toBeGreaterThanOrEqual(0);
		expect(artifact).toBeGreaterThan(verification);
		expect(receiptCommit).toBeGreaterThan(artifact);
		expect(summary?.env?.RECEIPT_COMMIT_OUTCOME).toBe(
			`\${{ steps.receipt_commit.outcome }}`,
		);
	});

	test.each([
		{
			outcome: "success",
			expected: "CI committed the verified receipt",
			absent: "automatic receipt commit failed",
		},
		{
			outcome: "failure",
			expected: "automatic receipt commit failed",
			absent: "CI committed the verified receipt",
		},
	])("summary reports $outcome accurately", async ({
		outcome,
		expected,
		absent,
	}) => {
		if (!summary?.run) throw new Error("Missing receipt summary");
		const output = join(work, "summary.md");
		const result = Bun.spawnSync(["sh", "-c", summary.run], {
			env: {
				...process.env,
				VERSION: "0.7.1",
				RECEIPT_COMMIT_OUTCOME: outcome,
				GITHUB_STEP_SUMMARY: output,
			},
		});
		expect(result.exitCode).toBe(0);
		const text = await Bun.file(output).text();
		expect(text).toContain(expected);
		expect(text).not.toContain(absent);
		if (outcome === "failure")
			expect(text).toContain("publication-receipt-0.7.1");
	});
});
