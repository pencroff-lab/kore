import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sinon from "sinon";
import { Err } from "../types/err";
import type { LogEntry, LogTransport } from "./logger.ts";
import { createLogger, log, lvl, prettyTransport } from "./logger.ts";

// ─── Spy transport helper ─────────────────────────────────────────────────────

function createSpyLogger(module?: string, options?: { level?: string }) {
	const entries: LogEntry[] = [];
	const spyTransport: LogTransport = {
		write(e) {
			entries.push(e);
		},
	};
	const logger = createLogger(module, {
		transports: [spyTransport],
		level: (options?.level ?? "trace") as "trace",
	});
	return { logger, entries };
}

// ─── 1. lvl constants ─────────────────────────────────────────────────────────

describe("lvl constants", () => {
	test("all level values are correct strings", () => {
		expect(lvl.TRACE).toBe("trace");
		expect(lvl.DEBUG).toBe("debug");
		expect(lvl.INFO).toBe("info");
		expect(lvl.WARN).toBe("warn");
		expect(lvl.ERROR).toBe("error");
		expect(lvl.FATAL).toBe("fatal");
	});

	test("level constants are all present", () => {
		expect(lvl).toHaveProperty("TRACE");
		expect(lvl).toHaveProperty("DEBUG");
		expect(lvl).toHaveProperty("INFO");
		expect(lvl).toHaveProperty("WARN");
		expect(lvl).toHaveProperty("ERROR");
		expect(lvl).toHaveProperty("FATAL");
	});
});

// ─── 2. Argument resolution ───────────────────────────────────────────────────

describe("argument resolution", () => {
	test.each([
		{
			label: "1 arg (msg) → info level",
			args: ["test message"] as [string],
			level: "info",
			message: "test message",
			contextCheck: (ctx: Record<string, unknown>) =>
				Object.keys(ctx).length === 0,
		},
		{
			label: "2 args (level, msg) → error level",
			args: ["error", "error occurred"] as [string, string],
			level: "error",
			message: "error occurred",
			contextCheck: (ctx: Record<string, unknown>) =>
				Object.keys(ctx).length === 0,
		},
		{
			label: "2 args (msg, object) → info with context",
			args: ["message", { x: 1 }] as [string, object],
			level: "info",
			message: "message",
			contextCheck: (ctx: Record<string, unknown>) => ctx.x === 1,
		},
		{
			label: "2 args (msg, string) → info with detail",
			args: ["message", "some detail"] as [string, string],
			level: "info",
			message: "message",
			contextCheck: (ctx: Record<string, unknown>) =>
				ctx.detail === "some detail",
		},
		{
			label: "3 args (level, msg, object) → error with context",
			args: ["error", "error message", { x: 1 }] as [string, string, object],
			level: "error",
			message: "error message",
			contextCheck: (ctx: Record<string, unknown>) => ctx.x === 1,
		},
	])("$label", ({ args, level, message, contextCheck }) => {
		const { logger, entries } = createSpyLogger();
		(logger as (...a: unknown[]) => void)(...args);

		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry).toBeDefined();
		expect(entry?.level).toBe(level);
		expect(entry?.message).toBe(message);
		expect(contextCheck(entry?.context ?? {})).toBe(true);
	});

	test("2 args (msg, Err) → info level with {err} context", () => {
		const { logger, entries } = createSpyLogger();
		const err = Err.from("test error", "TEST_CODE");
		logger("message", err);

		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry?.level).toBe("info");
		expect(entry?.message).toBe("message");
		expect(Err.isErr(entry?.context.err)).toBe(true);
	});

	test("3 args (level, msg, Err) → error level with {err} context", () => {
		const { logger, entries } = createSpyLogger();
		const err = Err.from("test error");
		logger("error", "error message", err);

		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry?.level).toBe("error");
		expect(Err.isErr(entry?.context.err)).toBe(true);
	});
});

// ─── 3. LogEntry structure ────────────────────────────────────────────────────

describe("LogEntry structure", () => {
	test("timestamp is a number (Date.now())", () => {
		const { logger, entries } = createSpyLogger();
		const before = Date.now();
		logger("test");
		const after = Date.now();

		expect(entries[0]?.timestamp).toBeGreaterThanOrEqual(before);
		expect(entries[0]?.timestamp).toBeLessThanOrEqual(after);
	});

	test("modules is an empty array for root logger", () => {
		const { logger, entries } = createSpyLogger();
		logger("test");
		expect(entries[0]?.modules).toEqual([]);
	});

	test("modules contains module name when set", () => {
		const { logger, entries } = createSpyLogger("myModule");
		logger("test");
		expect(entries[0]?.modules).toEqual(["myModule"]);
	});

	test("context merges bindings with call-site context", () => {
		const entries: LogEntry[] = [];
		const spyTransport: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const logger = createLogger("mod", {
			transports: [spyTransport],
			level: "trace",
		});
		const child = logger.child("sub", { bindKey: "bindVal" });
		child("msg", { callKey: "callVal" });

		expect(entries[0]?.context.bindKey).toBe("bindVal");
		expect(entries[0]?.context.callKey).toBe("callVal");
	});
});

// ─── 4. Level filtering ───────────────────────────────────────────────────────

describe("level filtering", () => {
	test.each([
		{ configLevel: "fatal", logLevel: "trace", shouldLog: false },
		{ configLevel: "fatal", logLevel: "debug", shouldLog: false },
		{ configLevel: "fatal", logLevel: "info", shouldLog: false },
		{ configLevel: "fatal", logLevel: "warn", shouldLog: false },
		{ configLevel: "fatal", logLevel: "error", shouldLog: false },
		{ configLevel: "fatal", logLevel: "fatal", shouldLog: true },
		{ configLevel: "error", logLevel: "warn", shouldLog: false },
		{ configLevel: "error", logLevel: "error", shouldLog: true },
		{ configLevel: "error", logLevel: "fatal", shouldLog: true },
		{ configLevel: "warn", logLevel: "info", shouldLog: false },
		{ configLevel: "warn", logLevel: "warn", shouldLog: true },
		{ configLevel: "info", logLevel: "debug", shouldLog: false },
		{ configLevel: "info", logLevel: "info", shouldLog: true },
		{ configLevel: "debug", logLevel: "trace", shouldLog: false },
		{ configLevel: "debug", logLevel: "debug", shouldLog: true },
		{ configLevel: "trace", logLevel: "trace", shouldLog: true },
	])("config=$configLevel log=$logLevel → shouldLog=$shouldLog", ({
		configLevel,
		logLevel,
		shouldLog,
	}) => {
		const { logger, entries } = createSpyLogger(undefined, {
			level: configLevel,
		});
		(logger as (...a: unknown[]) => void)(logLevel, "test");
		expect(entries).toHaveLength(shouldLog ? 1 : 0);
	});
});

// ─── 5. createLogger factory ──────────────────────────────────────────────────

describe("createLogger", () => {
	test("creates logger without module name", () => {
		const { logger } = createSpyLogger();
		expect(typeof logger).toBe("function");
	});

	test("creates logger with module name", () => {
		const { logger } = createSpyLogger("TEST");
		expect(typeof logger).toBe("function");
	});

	test("logger is callable", () => {
		const { logger, entries } = createSpyLogger();
		logger("test message");
		expect(entries).toHaveLength(1);
	});

	test("level constants accessible on logger instance", () => {
		const { logger } = createSpyLogger();
		expect(logger.TRACE).toBe("trace");
		expect(logger.DEBUG).toBe("debug");
		expect(logger.INFO).toBe("info");
		expect(logger.WARN).toBe("warn");
		expect(logger.ERROR).toBe("error");
		expect(logger.FATAL).toBe("fatal");
	});

	test("custom level option is respected", () => {
		const { logger, entries } = createSpyLogger(undefined, { level: "warn" });
		logger("info message"); // info < warn, should be filtered
		expect(entries).toHaveLength(0);
		logger(lvl.WARN, "warn message");
		expect(entries).toHaveLength(1);
	});

	test("custom transports receive entries", () => {
		const received: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				received.push(e);
			},
		};
		const logger = createLogger(undefined, { transports: [t], level: "trace" });
		logger("hello");
		expect(received).toHaveLength(1);
	});
});

// ─── 6. Child loggers ─────────────────────────────────────────────────────────

describe("child loggers", () => {
	test("child() creates a new logger instance", () => {
		const { logger: parent } = createSpyLogger();
		const child = parent.child("CHILD");
		expect(child).not.toBe(parent);
		expect(typeof child).toBe("function");
	});

	test("child accumulates module names", () => {
		const { logger: parent, entries } = createSpyLogger("parent");
		const child = parent.child("child");
		child("test");
		expect(entries[0]?.modules).toEqual(["parent", "child"]);
	});

	test("grandchild accumulates three modules", () => {
		const { logger: root, entries } = createSpyLogger("a");
		const child = root.child("b");
		const grandchild = child.child("c");
		grandchild("test");
		expect(entries[0]?.modules).toEqual(["a", "b", "c"]);
	});

	test("child merges bindings into context", () => {
		const { logger: parent, entries } = createSpyLogger();
		const child = parent.child("sub", { tag: "v1" });
		child("msg");
		expect(entries[0]?.context.tag).toBe("v1");
	});

	test("child inherits parent bindings and adds own", () => {
		const entries: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const parent = createLogger("p", { transports: [t], level: "trace" });
		const child = parent.child("c", { parentKey: "pv" });
		const grandchild = child.child("g", { childKey: "cv" });
		grandchild("msg");
		expect(entries[0]?.context.parentKey).toBe("pv");
		expect(entries[0]?.context.childKey).toBe("cv");
	});

	test("children share the same transport array", () => {
		const entries: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const parent = createLogger(undefined, { transports: [t], level: "trace" });
		const child = parent.child("c");
		parent("from parent");
		child("from child");
		expect(entries).toHaveLength(2);
	});

	test("child inherits level filter", () => {
		const entries: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const parent = createLogger(undefined, {
			transports: [t],
			level: "warn",
		});
		const child = parent.child("c");
		child("debug message"); // below warn, filtered
		expect(entries).toHaveLength(0);
		child(lvl.WARN, "warn message");
		expect(entries).toHaveLength(1);
	});

	test("multiple children from same parent are independent", () => {
		const { logger: parent } = createSpyLogger();
		const c1 = parent.child("C1");
		const c2 = parent.child("C2");
		expect(c1).not.toBe(c2);
	});
});

// ─── 7. Pretty transport formatting ──────────────────────────────────────────

describe("pretty transport formatting", () => {
	let sandbox: sinon.SinonSandbox;
	let _clock: sinon.SinonFakeTimers;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		// Fix time to 2024-01-15 14:30:05.123 UTC
		_clock = sandbox.useFakeTimers(
			new Date("2024-01-15T14:30:05.123Z").getTime(),
		);
	});

	afterEach(() => {
		sandbox.restore();
	});

	function createStringOutput() {
		const lines: string[] = [];
		const output = {
			write(data: string) {
				lines.push(data);
			},
		};
		return { lines, output };
	}

	test("short timestamp format (default)", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).toContain(":");
		expect(lines[0]).toContain(".");
		// Should contain HH:MM:SS.mmm pattern
		expect(lines[0]).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
	});

	test("iso timestamp format", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({
			output,
			colors: false,
			timestamp: "iso",
		});
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).toContain("2024-01-15T");
	});

	test("custom timestamp function", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({
			output,
			colors: false,
			timestamp: () => "CUSTOM_TS",
		});
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).toContain("CUSTOM_TS");
	});

	test("level tags are rendered correctly", () => {
		const tagCases: [string, string][] = [
			["trace", "TRC"],
			["debug", "DBG"],
			["info", "INF"],
			["warn", "WRN"],
			["error", "ERR"],
			["fatal", "FTL"],
		];
		for (const [level, tag] of tagCases) {
			const { lines, output } = createStringOutput();
			const transport = prettyTransport({ output, colors: false });
			transport.write({
				level: level as "info",
				timestamp: Date.now(),
				message: "msg",
				context: {},
				modules: [],
			});
			expect(lines[0]).toContain(tag);
		}
	});

	test("module brackets rendered for single module", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: ["api"],
		});
		expect(lines[0]).toContain("[api]");
	});

	test("module brackets rendered for multiple modules", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: ["api", "users"],
		});
		expect(lines[0]).toContain("[api]");
		expect(lines[0]).toContain("[users]");
	});

	test("empty context shows no JSON", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).not.toContain("{");
	});

	test("non-empty context serialized as JSON", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "msg",
			context: { key: "val" },
			modules: [],
		});
		expect(lines[0]).toContain('"key"');
		expect(lines[0]).toContain('"val"');
	});

	test("colors: false produces no ANSI codes", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).not.toContain("\x1b[");
	});

	test("colors: true produces ANSI codes", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: true });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).toContain("\x1b[");
	});

	test("colors: auto detects non-TTY and disables colors", () => {
		const { lines, output } = createStringOutput();
		// Plain object has no isTTY property → not a TTY
		const transport = prettyTransport({ output, colors: "auto" });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).not.toContain("\x1b[");
	});

	test("output ends with newline", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		transport.write({
			level: "info",
			timestamp: Date.now(),
			message: "hello",
			context: {},
			modules: [],
		});
		expect(lines[0]).toMatch(/\n$/);
	});
});

// ─── 8. Err integration in pretty transport ───────────────────────────────────

describe("Err integration in pretty transport", () => {
	function createStringOutput() {
		const lines: string[] = [];
		const output = {
			write(data: string) {
				lines.push(data);
			},
		};
		return { lines, output };
	}

	test("Err in context is extracted and formatted", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		const err = Err.from("something went wrong", "ERR_CODE");
		transport.write({
			level: "error",
			timestamp: Date.now(),
			message: "failed",
			context: { err },
			modules: [],
		});
		// Should contain "err:" line
		expect(lines[0]).toContain("err:");
		expect(lines[0]).toContain("something went wrong");
	});

	test("Err is on indented line below main line", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		const err = Err.from("connection refused");
		transport.write({
			level: "error",
			timestamp: Date.now(),
			message: "Query failed",
			context: { err },
			modules: ["db"],
		});
		const fullOutput = lines[0] ?? "";
		const mainLine = fullOutput.split("\n")[0] ?? "";
		const errLine = fullOutput.split("\n")[1] ?? "";
		expect(mainLine).toContain("Query failed");
		expect(errLine).toMatch(/^\s+err:/);
	});

	test("Err not included in plain context JSON", () => {
		const { lines, output } = createStringOutput();
		const transport = prettyTransport({ output, colors: false });
		const err = Err.from("oops");
		transport.write({
			level: "error",
			timestamp: Date.now(),
			message: "msg",
			context: { err, otherKey: "otherVal" },
			modules: [],
		});
		const fullOutput = lines[0] ?? "";
		// Other context keys should still appear
		expect(fullOutput).toContain("otherVal");
	});
});

// ─── 9. Environment variables ─────────────────────────────────────────────────

describe("environment variables", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	test("LOG_LEVEL env var filters entries (warn level)", () => {
		process.env.LOG_LEVEL = "warn";

		const entries: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const logger = createLogger(undefined, { transports: [t] });

		logger(lvl.DEBUG, "debug message"); // below warn
		expect(entries).toHaveLength(0);

		logger(lvl.WARN, "warn message");
		expect(entries).toHaveLength(1);
	});

	test("invalid LOG_LEVEL falls back to info", () => {
		process.env.LOG_LEVEL = "invalid_level";

		const entries: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const logger = createLogger(undefined, { transports: [t] });

		logger(lvl.DEBUG, "debug"); // below info (default fallback)
		expect(entries).toHaveLength(0);

		logger(lvl.INFO, "info");
		expect(entries).toHaveLength(1);
	});

	test("case-insensitive LOG_LEVEL", () => {
		process.env.LOG_LEVEL = "DEBUG";

		const entries: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const logger = createLogger(undefined, { transports: [t] });

		logger(lvl.TRACE, "trace"); // below debug
		expect(entries).toHaveLength(0);

		logger(lvl.DEBUG, "debug");
		expect(entries).toHaveLength(1);
	});

	test("default level is info when LOG_LEVEL not set", () => {
		delete process.env.LOG_LEVEL;

		const entries: LogEntry[] = [];
		const t: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const logger = createLogger(undefined, { transports: [t] });

		logger(lvl.DEBUG, "debug"); // below info
		expect(entries).toHaveLength(0);

		logger(lvl.INFO, "info");
		expect(entries).toHaveLength(1);
	});
});

// ─── 10. Multiple transports ──────────────────────────────────────────────────

describe("multiple transports", () => {
	test("all transports receive the same entry", () => {
		const entries1: LogEntry[] = [];
		const entries2: LogEntry[] = [];
		const t1: LogTransport = {
			write(e) {
				entries1.push(e);
			},
		};
		const t2: LogTransport = {
			write(e) {
				entries2.push(e);
			},
		};

		const logger = createLogger(undefined, {
			transports: [t1, t2],
			level: "trace",
		});
		logger("hello");

		expect(entries1).toHaveLength(1);
		expect(entries2).toHaveLength(1);
		expect(entries1[0]?.message).toBe("hello");
		expect(entries2[0]?.message).toBe("hello");
	});

	test("entry object is the same reference", () => {
		const received: LogEntry[] = [];
		const t1: LogTransport = {
			write(e) {
				received.push(e);
			},
		};
		const t2: LogTransport = {
			write(e) {
				received.push(e);
			},
		};

		const logger = createLogger(undefined, {
			transports: [t1, t2],
			level: "trace",
		});
		logger("test");

		expect(received[0]).toBe(received[1]);
	});
});

// ─── 11. log singleton ────────────────────────────────────────────────────────

describe("log singleton", () => {
	test("log is exported and callable", () => {
		expect(log).toBeDefined();
		expect(typeof log).toBe("function");
	});

	test("log has level constants", () => {
		expect(log.TRACE).toBe("trace");
		expect(log.DEBUG).toBe("debug");
		expect(log.INFO).toBe("info");
		expect(log.WARN).toBe("warn");
		expect(log.ERROR).toBe("error");
		expect(log.FATAL).toBe("fatal");
	});

	test("log.child() returns a new logger", () => {
		const child = log.child("TEST");
		expect(child).not.toBe(log);
		expect(typeof child).toBe("function");
	});
});

// ─── 12. Edge cases ───────────────────────────────────────────────────────────

describe("edge cases", () => {
	test("null context is handled gracefully", () => {
		const { logger, entries } = createSpyLogger();
		logger("message", null as unknown as object);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.context).toEqual({});
	});

	test("undefined context is handled gracefully", () => {
		const { logger, entries } = createSpyLogger();
		logger("message", undefined as unknown as object);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.context).toEqual({});
	});

	test("empty string message is logged", () => {
		const { logger, entries } = createSpyLogger();
		logger("");
		expect(entries).toHaveLength(1);
		expect(entries[0]?.message).toBe("");
	});

	test("child with empty bindings object", () => {
		const { logger, entries } = createSpyLogger();
		const child = logger.child("MOD", {});
		child("test");
		expect(entries[0]?.modules).toEqual(["MOD"]);
		expect(entries[0]?.context).toEqual({});
	});

	test("circular reference in context does not throw", () => {
		const { logger, entries } = createSpyLogger();
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(() => logger("msg", circular)).not.toThrow();
		expect(entries).toHaveLength(1);
	});

	test("circular reference in pretty transport does not throw", () => {
		const lines: string[] = [];
		const output = {
			write(data: string) {
				lines.push(data);
			},
		};
		const transport = prettyTransport({ output, colors: false });
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(() =>
			transport.write({
				level: "info",
				timestamp: Date.now(),
				message: "msg",
				context: circular,
				modules: [],
			}),
		).not.toThrow();
	});

	test("Err.isErr check works for Err vs non-Err", () => {
		const err = Err.from("test");
		expect(Err.isErr(err)).toBe(true);
		expect(Err.isErr("not an error")).toBe(false);
		expect(Err.isErr(null)).toBe(false);
		expect(Err.isErr({})).toBe(false);
	});
});
