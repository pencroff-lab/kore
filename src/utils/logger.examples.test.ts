import { describe, expect, test } from "bun:test";
import { Err } from "../types/err";
import type { LogEntry, LogTransport } from "./logger";
import { createLogger, lvl } from "./logger";

// ─── Test transport helper ───────────────────────────────────────────────────

function spyTransport(): { entries: LogEntry[]; transport: LogTransport } {
	const entries: LogEntry[] = [];
	return {
		entries,
		transport: {
			write(e: LogEntry) {
				entries.push(e);
			},
		},
	};
}

describe("Basic logging", () => {
	test("logs at INFO level by default", () => {
		const { entries, transport } = spyTransport();
		const log = createLogger("test", {
			transports: [transport],
			level: lvl.TRACE,
		});

		log("Application started");

		expect(entries).toHaveLength(1);
		expect(entries[0]!.level).toBe("info");
		expect(entries[0]!.message).toBe("Application started");
	});

	test("logs at explicit level", () => {
		const { entries, transport } = spyTransport();
		const log = createLogger("test", {
			transports: [transport],
			level: lvl.TRACE,
		});

		log(log.WARN, "Connection slow");

		expect(entries).toHaveLength(1);
		expect(entries[0]!.level).toBe("warn");
		expect(entries[0]!.message).toBe("Connection slow");
	});

	test("logs with context object", () => {
		const { entries, transport } = spyTransport();
		const log = createLogger("test", {
			transports: [transport],
			level: lvl.TRACE,
		});

		log(log.ERROR, "Failed to save", { userId: "123" });

		expect(entries).toHaveLength(1);
		expect(entries[0]!.level).toBe("error");
		expect(entries[0]!.context).toEqual({ userId: "123" });
	});

	test("filters messages below configured level", () => {
		const { entries, transport } = spyTransport();
		const log = createLogger("test", {
			transports: [transport],
			level: lvl.WARN,
		});

		log(log.DEBUG, "Debug message");
		log(log.INFO, "Info message");
		log(log.WARN, "Warning message");

		expect(entries).toHaveLength(1);
		expect(entries[0]!.level).toBe("warn");
	});
});

describe("Err integration", () => {
	test("logs Err instances in context", () => {
		const { entries, transport } = spyTransport();
		const log = createLogger("test", {
			transports: [transport],
			level: lvl.TRACE,
		});

		const err = Err.from("Data fetch failed", "FETCH_ERROR");
		log(log.ERROR, "Data fetch failed", err);

		expect(entries).toHaveLength(1);
		expect(entries[0]!.context).toHaveProperty("err");
		expect(Err.isErr(entries[0]!.context.err)).toBe(true);
	});
});

describe("Child loggers", () => {
	test("child logger adds module context", () => {
		const { entries, transport } = spyTransport();
		const log = createLogger("test", {
			transports: [transport],
			level: lvl.TRACE,
		});

		const dbLogger = log.child("database", { version: "1.0" });
		dbLogger("Connected to postgres");

		expect(entries).toHaveLength(1);
		expect(entries[0]!.modules).toEqual(["test", "database"]);
		expect(entries[0]!.context).toEqual({ version: "1.0" });
	});

	test("nested child loggers accumulate modules", () => {
		const { entries, transport } = spyTransport();
		const log = createLogger("test", {
			transports: [transport],
			level: lvl.TRACE,
		});

		const dbLogger = log.child("database");
		const userLogger = dbLogger.child("users");
		userLogger("User created");

		expect(entries).toHaveLength(1);
		expect(entries[0]!.modules).toEqual(["test", "database", "users"]);
	});
});

describe("Custom transports", () => {
	test("spy transport captures all entries", () => {
		const entries: LogEntry[] = [];
		const spy: LogTransport = {
			write(e) {
				entries.push(e);
			},
		};
		const testLogger = createLogger("test", {
			transports: [spy],
			level: lvl.TRACE,
		});

		testLogger("First message");
		testLogger(testLogger.ERROR, "Second message");

		expect(entries).toHaveLength(2);
		expect(entries[0]!.level).toBe("info");
		expect(entries[1]!.level).toBe("error");
	});
});

describe("Level configuration", () => {
	test("logger exposes level constants", () => {
		const { transport } = spyTransport();
		const log = createLogger("test", { transports: [transport] });

		expect(log.TRACE).toBe("trace");
		expect(log.DEBUG).toBe("debug");
		expect(log.INFO).toBe("info");
		expect(log.WARN).toBe("warn");
		expect(log.ERROR).toBe("error");
		expect(log.FATAL).toBe("fatal");
	});
});
