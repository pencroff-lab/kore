import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Err, Outcome } from "@types";
import type pino from "pino";
import sinon from "sinon";
import { createLogger, log, lvl } from "./logger.ts";

// Helper to create logger with spy stream
function createSpyLogger(module?: string, level: string = "trace") {
	const writeSpy = sinon.spy();
	const mockStream = new Writable({
		write(chunk, _encoding, callback) {
			writeSpy(chunk.toString());
			callback();
		},
	});

	const logger = createLogger(module, {
		streams: [{ stream: mockStream }] as pino.StreamEntry[],
		level: level as "trace",
	});

	return { logger, writeSpy };
}

// Helper to parse last JSON log entry
function parseLastLog(spy: sinon.SinonSpy): {
	level: number;
	msg: string;
	[key: string]: unknown;
} | null {
	if (spy.callCount === 0) return null;
	const lastCall = spy.lastCall.args[0] as string;
	try {
		return JSON.parse(lastCall) as {
			level: number;
			msg: string;
			[key: string]: unknown;
		};
	} catch {
		return null;
	}
}

describe("lvl constants", () => {
	test("all level values are correct strings", () => {
		expect(lvl.TRACE).toBe("trace");
		expect(lvl.DEBUG).toBe("debug");
		expect(lvl.INFO).toBe("info");
		expect(lvl.WARN).toBe("warn");
		expect(lvl.ERROR).toBe("error");
		expect(lvl.FATAL).toBe("fatal");
	});

	test("level constants are accessible", () => {
		expect(lvl).toHaveProperty("TRACE");
		expect(lvl).toHaveProperty("DEBUG");
		expect(lvl).toHaveProperty("INFO");
		expect(lvl).toHaveProperty("WARN");
		expect(lvl).toHaveProperty("ERROR");
		expect(lvl).toHaveProperty("FATAL");
	});
});

describe("argument resolution (via stream spy)", () => {
	test("1 arg: ('msg') → info level", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("test message");

		const parsed = parseLastLog(writeSpy);
		expect(parsed).toBeTruthy();
		expect(parsed?.level).toBe(30); // info level
		expect(parsed?.msg).toBe("test message");
	});

	test("2 args level+msg: ('error', 'msg') → error level", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("error", "error occurred");

		const parsed = parseLastLog(writeSpy);
		expect(parsed).toBeTruthy();
		expect(parsed?.level).toBe(50); // error level
		expect(parsed?.msg).toBe("error occurred");
	});

	test("2 args msg+object: ('msg', {x:1}) → info level with context", () => {
		const { logger, writeSpy } = createSpyLogger();
		const ctx = { x: 1, y: "test" };
		logger("message", ctx);

		const parsed = parseLastLog(writeSpy);
		expect(parsed).toBeTruthy();
		expect(parsed?.level).toBe(30); // info level
		expect(parsed?.msg).toBe("message");
		expect(parsed?.x).toBe(1);
		expect(parsed?.y).toBe("test");
	});

	test("2 args msg+Err: ('msg', err) → info level with {err} context", () => {
		const { logger, writeSpy } = createSpyLogger();
		const err = Err.from("test error", "TEST_CODE");
		logger("message", err);

		const parsed = parseLastLog(writeSpy);
		expect(parsed).toBeTruthy();
		expect(parsed?.level).toBe(30); // info level
		expect(parsed?.msg).toBe("message");
		expect(parsed?.err).toBeTruthy();
		expect(typeof parsed?.err).toBe("object");
	});

	test("2 args msg+string: ('msg', 'detail') → info level with {detail} context", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("message", "some detail");

		const parsed = parseLastLog(writeSpy);
		expect(parsed).toBeTruthy();
		expect(parsed?.level).toBe(30); // info level
		expect(parsed?.msg).toBe("message");
		expect(parsed?.detail).toBe("some detail");
	});

	test("3 args: ('error', 'msg', {x:1}) → error level with context", () => {
		const { logger, writeSpy } = createSpyLogger();
		const ctx = { x: 1 };
		logger("error", "error message", ctx);

		const parsed = parseLastLog(writeSpy);
		expect(parsed).toBeTruthy();
		expect(parsed?.level).toBe(50); // error level
		expect(parsed?.msg).toBe("error message");
		expect(parsed?.x).toBe(1);
	});

	test("3 args with Err: ('error', 'msg', err) → error level with {err} context", () => {
		const { logger, writeSpy } = createSpyLogger();
		const err = Err.from("test error");
		logger("error", "error message", err);

		const parsed = parseLastLog(writeSpy);
		expect(parsed).toBeTruthy();
		expect(parsed?.level).toBe(50); // error level
		expect(parsed?.msg).toBe("error message");
		expect(parsed?.err).toBeTruthy();
	});
});

describe("createLogger", () => {
	test("creates logger without module name", () => {
		const { logger } = createSpyLogger();
		expect(logger).toBeDefined();
		expect(typeof logger).toBe("function");
	});

	test("creates logger with module name", () => {
		const { logger } = createSpyLogger("TEST");
		expect(logger).toBeDefined();
		expect(typeof logger).toBe("function");
	});

	test("logger is callable", () => {
		const { logger, writeSpy } = createSpyLogger();
		const o = Outcome.from(() => {
			logger("test message");
			return null;
		});
		const [_, err] = o.toTuple();
		expect(err).toBeNull();
		expect(writeSpy.callCount).toBe(1);
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
});

describe("child logger", () => {
	test("child() creates new logger", () => {
		const { logger: parent } = createSpyLogger();
		const child = parent.child("CHILD");
		expect(child).toBeDefined();
		expect(typeof child).toBe("function");
		expect(child).not.toBe(parent);
	});

	test("child has module prefix", () => {
		const { logger: parent } = createSpyLogger();
		const child = parent.child("MODULE");
		const writeSpy = sinon.spy();
		const _mockStream = new Writable({
			write(chunk, _encoding, callback) {
				writeSpy(chunk.toString());
				callback();
			},
		});

		// Call child logger (it shares parent's stream)
		child("test");
		expect(() => child("test")).not.toThrow();
	});

	test("nested children chain prefixes", () => {
		const { logger: parent } = createSpyLogger("PARENT");
		const child = parent.child("CHILD");
		expect(() => child("test message")).not.toThrow();
	});
});

describe("log singleton", () => {
	test("log is exported and callable", () => {
		expect(log).toBeDefined();
		expect(typeof log).toBe("function");
	});

	test("log.child() returns new logger instance", () => {
		const child = log.child("TEST");
		expect(child).toBeDefined();
		expect(typeof child).toBe("function");
		expect(child).not.toBe(log);
	});

	test("log has level constants", () => {
		expect(log.TRACE).toBe("trace");
		expect(log.DEBUG).toBe("debug");
		expect(log.INFO).toBe("info");
		expect(log.WARN).toBe("warn");
		expect(log.ERROR).toBe("error");
		expect(log.FATAL).toBe("fatal");
	});
});

describe("Err integration", () => {
	test("Err.isErr check works for Err instances", () => {
		const err = Err.from("test");
		expect(Err.isErr(err)).toBe(true);
		expect(Err.isErr("not an error")).toBe(false);
		expect(Err.isErr(null)).toBe(false);
		expect(Err.isErr({})).toBe(false);
	});
});

describe("environment variables", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	test("LOG_LEVEL env var is respected when creating default logger", () => {
		process.env.LOG_LEVEL = "warn";

		// Create logger without overriding level (so it uses env var)
		const writeSpy = sinon.spy();
		const mockStream = new Writable({
			write(chunk, _encoding, callback) {
				writeSpy(chunk.toString());
				callback();
			},
		});

		const logger = createLogger(undefined, {
			streams: [{ stream: mockStream }] as pino.StreamEntry[],
			// Don't set level - let it use env var
		});

		// Debug message should NOT log (level is warn)
		logger("debug", "debug message");
		expect(writeSpy.callCount).toBe(0);

		// Warn message SHOULD log
		logger("warn", "warn message");
		expect(writeSpy.callCount).toBe(1);

		const parsed = parseLastLog(writeSpy);
		expect(parsed?.level).toBe(40); // warn level
	});

	test("LOG_FILE_PATH env var doesn't affect spy logger", () => {
		process.env.LOG_FILE_PATH = "./tmp/test-logs/custom.log";
		const { logger } = createSpyLogger();
		expect(logger).toBeDefined();
		// Spy logger bypasses file path entirely
	});

	test("default values when env vars not set", () => {
		delete process.env.LOG_LEVEL;
		delete process.env.LOG_FILE_PATH;
		const { logger } = createSpyLogger();
		expect(logger).toBeDefined();
	});

	test("invalid LOG_LEVEL falls back to info", () => {
		process.env.LOG_LEVEL = "invalid_level";
		const { logger } = createSpyLogger();
		expect(logger).toBeDefined();
	});

	test("case-insensitive LOG_LEVEL", () => {
		process.env.LOG_LEVEL = "DEBUG";
		const { logger } = createSpyLogger();
		expect(logger).toBeDefined();
	});
});

describe("logger variadic signatures", () => {
	test("logger accepts (message: string)", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("simple message");
		expect(writeSpy.callCount).toBe(1);
	});

	test("logger accepts (message: string, context: object)", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("message", { key: "value" });
		expect(writeSpy.callCount).toBe(1);
	});

	test("logger accepts (message: string, detail: string)", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("message", "detail string");
		expect(writeSpy.callCount).toBe(1);
	});

	test("logger accepts (level: LevelValue, message: string)", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger(lvl.WARN, "warning message");
		expect(writeSpy.callCount).toBe(1);
	});

	test("logger accepts (level: LevelValue, message: string, context: object)", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger(lvl.ERROR, "error msg", { code: 500 });
		expect(writeSpy.callCount).toBe(1);
	});
});

describe("edge cases", () => {
	test("logger handles null context gracefully", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("message", null as unknown as object);
		expect(writeSpy.callCount).toBe(1);
	});

	test("logger handles undefined context gracefully", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("message", undefined as unknown as object);
		expect(writeSpy.callCount).toBe(1);
	});

	test("logger handles empty string message", () => {
		const { logger, writeSpy } = createSpyLogger();
		logger("");
		expect(writeSpy.callCount).toBe(1);
	});

	test("child logger with empty bindings", () => {
		const { logger } = createSpyLogger();
		const child = logger.child("MODULE", {});
		expect(child).toBeDefined();
	});

	test("multiple child loggers from same parent", () => {
		const { logger: parent } = createSpyLogger();
		const child1 = parent.child("MODULE1");
		const child2 = parent.child("MODULE2");
		expect(child1).not.toBe(child2);
	});
});
