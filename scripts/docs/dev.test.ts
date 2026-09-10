import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	DEFAULT_PORTS,
	fingerprintInputs,
	injectLiveReload,
	liveReloadSnippet,
	syncTree,
	writeHostProject,
} from "./dev";
import { makeTempRepo, removeTempRepo } from "./fixtures";

describe("injectLiveReload", () => {
	test("inserts Hugo's client immediately before </body>", () => {
		const html = "<html><body><p>hi</p></body></html>";

		const out = injectLiveReload(html, 1313);

		expect(out).toBe(
			`<html><body><p>hi</p>${liveReloadSnippet(1313)}</body></html>`,
		);
	});

	test("uses the requested port", () => {
		expect(injectLiveReload("<body></body>", 1400)).toContain("port=1400");
	});

	test("appends when there is no body element", () => {
		const out = injectLiveReload("<p>fragment</p>", 1313);

		expect(out.startsWith("<p>fragment</p>")).toBe(true);
		expect(out).toContain("livereload.js?");
	});

	test("does not inject the client twice", () => {
		const once = injectLiveReload("<body></body>", 1313);

		const twice = injectLiveReload(once, 1313);

		expect(twice).toBe(once);
	});

	test("references only Hugo's own endpoint", () => {
		expect(liveReloadSnippet(1313)).toContain("/livereload.js?");
		expect(liveReloadSnippet(1313)).toContain("path=livereload");
	});
});

describe("syncTree", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo({
			"from/index.html": "<p>one</p>",
			"from/nested/a.txt": "a",
			"to/stale.html": "<p>old</p>",
		});
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("copies new files into the destination", () => {
		syncTree(join(root, "from"), join(root, "to"));

		expect(existsSync(join(root, "to/index.html"))).toBe(true);
		expect(existsSync(join(root, "to/nested/a.txt"))).toBe(true);
	});

	test("removes files that no longer exist in the source", () => {
		syncTree(join(root, "from"), join(root, "to"));

		expect(existsSync(join(root, "to/stale.html"))).toBe(false);
	});

	test("removes directories left empty after a sync", () => {
		mkdirSync(join(root, "to/gone"), { recursive: true });
		writeFileSync(join(root, "to/gone/x.html"), "x");

		syncTree(join(root, "from"), join(root, "to"));

		expect(existsSync(join(root, "to/gone"))).toBe(false);
	});

	test("keeps the destination directory itself, so watches survive", () => {
		const to = join(root, "to");
		const before = Bun.file(join(to, "stale.html")).name;

		syncTree(join(root, "from"), to);

		expect(before).toBeDefined();
		expect(existsSync(to)).toBe(true);
	});

	test("propagates updated content", async () => {
		syncTree(join(root, "from"), join(root, "to"));
		writeFileSync(join(root, "from/index.html"), "<p>two</p>");

		syncTree(join(root, "from"), join(root, "to"));

		expect(await Bun.file(join(root, "to/index.html")).text()).toBe(
			"<p>two</p>",
		);
	});
});

describe("fingerprintInputs", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo({ "docs/a.md": "# a\n", "docs/b/c.md": "# c\n" });
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("is stable when nothing changes", () => {
		const targets = [{ path: join(root, "docs") }];

		expect(fingerprintInputs(targets)).toBe(fingerprintInputs(targets));
	});

	test("is unchanged by reading the watched files", async () => {
		const targets = [{ path: join(root, "docs") }];
		const before = fingerprintInputs(targets);

		await Bun.file(join(root, "docs/a.md")).text();
		await Bun.file(join(root, "docs/b/c.md")).text();

		expect(fingerprintInputs(targets)).toBe(before);
	});

	test("changes when a watched file is edited", () => {
		const targets = [{ path: join(root, "docs") }];
		const before = fingerprintInputs(targets);

		writeFileSync(join(root, "docs/a.md"), "# a edited, longer\n");

		expect(fingerprintInputs(targets)).not.toBe(before);
	});

	test("changes when a watched file is added or removed", () => {
		const targets = [{ path: join(root, "docs") }];
		const before = fingerprintInputs(targets);

		writeFileSync(join(root, "docs/new.md"), "# new\n");
		const added = fingerprintInputs(targets);
		expect(added).not.toBe(before);

		rmSync(join(root, "docs/new.md"));
		expect(fingerprintInputs(targets)).toBe(before);
	});

	test("ignores a target that does not exist", () => {
		expect(fingerprintInputs([{ path: join(root, "absent") }])).toBe("");
	});
});

describe("writeHostProject", () => {
	let root: string;

	beforeEach(() => {
		root = makeTempRepo({ "host/static/index.html": "<p>assembled</p>" });
	});

	afterEach(() => {
		removeTempRepo(root);
	});

	test("routes the host home away from the assembled index.html", async () => {
		await writeHostProject(join(root, "host"), "http://localhost:1313");

		const config = await Bun.file(join(root, "host/hugo.json")).json();
		expect(config.outputs.home).toEqual(["hostidx"]);
		expect(config.outputFormats.hostidx.baseName).toBe("_hugo-host");
		// Disabling the home kind makes Hugo panic, so it must stay enabled.
		expect(config.disableKinds).not.toContain("home");
	});

	test("keeps the assembled static tree in place", async () => {
		await writeHostProject(join(root, "host"), "http://localhost:1313");

		expect(await Bun.file(join(root, "host/static/index.html")).text()).toBe(
			"<p>assembled</p>",
		);
	});

	test("sets the local origin as the base URL", async () => {
		await writeHostProject(join(root, "host"), "http://localhost:4173");

		const config = await Bun.file(join(root, "host/hugo.json")).json();
		expect(config.baseURL).toBe("http://localhost:4173/");
	});
});

describe("default ports", () => {
	test.each([
		{ mode: "dev" as const, port: 1313 },
		{ mode: "preview" as const, port: 4173 },
	])("$mode serves on $port", ({ mode, port }) => {
		expect(DEFAULT_PORTS[mode]).toBe(port);
	});
});
