/**
 * Structured, level-filtered logging with pluggable transports and `Err` integration.
 *
 * `createLogger()` returns a callable `Logger` that doubles as an object with
 * level constants and a `child()` factory. Log entries are plain `LogEntry`
 * objects dispatched to one or more `LogTransport` sinks. The built-in
 * `prettyTransport()` renders colored, human-readable output to stderr.
 *
 * **Key concepts:**
 * - **Callable interface** — `log("msg")` logs at INFO; `log(log.WARN, "msg")` at WARN.
 * - **Child loggers** — `log.child("mod")` adds a module tag and optional bindings.
 * - **Err-aware** — passing an `Err` as context renders it with stack + metadata on its own line.
 * - **Transport DI** — swap the default pretty transport for JSON, file, or test transports.
 *
 * @see [logger.examples.test.ts](../../src/utils/logger.examples.test.ts) for usage patterns
 * @module logger
 */

import stringifySafe from "fast-safe-stringify";
import { Err } from "../types/err";

/** Log level constants (TRACE < DEBUG < INFO < WARN < ERROR < FATAL). */
const lvl = {
	TRACE: "trace",
	DEBUG: "debug",
	INFO: "info",
	WARN: "warn",
	ERROR: "error",
	FATAL: "fatal",
} as const;

/**
 * Type representing valid log level values.
 */
type LevelValue = (typeof lvl)[keyof typeof lvl];

/**
 * A single structured log entry passed to transports.
 */
interface LogEntry {
	/** Log level */
	level: LevelValue;
	/** Unix timestamp in milliseconds (Date.now()) */
	timestamp: number;
	/** Log message */
	message: string;
	/** Merged bindings + call-site context */
	context: Record<string, unknown>;
	/** Module chain accumulated by child() calls */
	modules: string[];
}

/**
 * Transport interface — receives a `LogEntry` for each log call that passes
 * the level filter. Implement this to integrate any logging backend.
 */
interface LogTransport {
	write(entry: LogEntry): void;
}

/**
 * Options for the built-in pretty console transport.
 */
interface PrettyOptions {
	/** Output stream. Default: `process.stderr` */
	output?: { write(data: string): void };
	/**
	 * Enable ANSI colors.
	 * - `'auto'` (default): enable when output is a TTY
	 * - `true`: always enable
	 * - `false`: always disable
	 */
	colors?: boolean | "auto";
	/** Override default level colors (ANSI escape sequences) */
	levelColors?: Partial<Record<LevelValue, string>>;
	/**
	 * Timestamp format.
	 * - `'short'` (default): `HH:MM:SS.mmm` local time
	 * - `'iso'`: ISO 8601 string
	 * - Custom function receiving `Date.now()` timestamp
	 */
	timestamp?: "short" | "iso" | ((ts: number) => string);
}

/**
 * Options for `createLogger`.
 */
interface LoggerOptions {
	/** Minimum log level. Default: from `LOG_LEVEL` env or `'info'` */
	level?: LevelValue;
	/** Transports to write entries to. Default: `[prettyTransport()]` */
	transports?: LogTransport[];
}

/**
 * Callable logger interface — both a function and an object with level
 * constants and a `child` method.
 */
interface Logger {
	readonly TRACE: "trace";
	readonly DEBUG: "debug";
	readonly INFO: "info";
	readonly WARN: "warn";
	readonly ERROR: "error";
	readonly FATAL: "fatal";

	/** Log a message at INFO level. */
	(message: string): void;
	/** Log a message at INFO level with context. */
	(message: string, context: object | Err): void;
	/** Log a message at INFO level with detail string. */
	(message: string, detail: string): void;
	/** Log a message at a specific level. */
	(level: LevelValue, message: string): void;
	/** Log a message at a specific level with context. */
	(level: LevelValue, message: string, context: object | Err): void;

	/**
	 * Create a child logger with module-specific context.
	 *
	 * @param module - Module name added to the modules array
	 * @param bindings - Optional bindings merged into every log entry's context
	 * @returns New Logger instance
	 */
	child(module: string, bindings?: object): Logger;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const levelSet = new Set(Object.values(lvl));

const LEVEL_NUMBERS: Record<LevelValue, number> = {
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
	fatal: 5,
};

const LEVEL_TAGS: Record<LevelValue, string> = {
	trace: "TRC",
	debug: "DBG",
	info: "INF",
	warn: "WRN",
	error: "ERR",
	fatal: "FTL",
};

const DEFAULT_LEVEL_COLORS: Record<LevelValue, string> = {
	trace: "\x1b[2m",
	debug: "\x1b[36m",
	info: "\x1b[32m",
	warn: "\x1b[38;5;208m",
	error: "\x1b[31m",
	fatal: "\x1b[1m\x1b[31m",
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Check whether a value is a valid LevelValue string.
function isLevel(val: unknown): val is LevelValue {
	return (
		typeof val === "string" &&
		levelSet.has(val.toLocaleLowerCase() as LevelValue)
	);
}

// Normalize a log context argument to a plain object.
function normalizeContext(ctx: unknown): Record<string, unknown> {
	if (Err.isErr(ctx)) return { err: ctx };
	if (typeof ctx === "string") return { detail: ctx };
	if (typeof ctx === "object" && ctx !== null)
		return ctx as Record<string, unknown>;
	return {};
}

// Resolve variadic logger call arguments into { level, message, context }.
function resolveCall(...args: unknown[]): {
	level: LevelValue;
	message: string;
	context: Record<string, unknown>;
} {
	// 1 arg: [msg]
	if (args.length === 1) {
		return { level: lvl.INFO, message: String(args[0]), context: {} };
	}

	// 2 args
	if (args.length === 2) {
		const [first, second] = args;
		if (isLevel(first)) {
			return { level: first, message: String(second), context: {} };
		}
		return {
			level: lvl.INFO,
			message: String(first),
			context: normalizeContext(second),
		};
	}

	// 3+ args: [lvl, msg, ctx]
	if (args.length >= 3) {
		const [first, second, third] = args;
		if (isLevel(first)) {
			return {
				level: first,
				message: String(second),
				context: normalizeContext(third),
			};
		}
	}

	// Fallback
	return { level: lvl.INFO, message: String(args[0] ?? ""), context: {} };
}

// Read minimum log level from LOG_LEVEL env var, default INFO.
function getLogLevel(): LevelValue {
	const envLevel = process.env.LOG_LEVEL?.toLowerCase();
	return isLevel(envLevel) ? envLevel : lvl.INFO;
}

// ─── Timestamp formatters ─────────────────────────────────────────────────────

// Format a Unix ms timestamp as HH:MM:SS.mmm (local time).
function formatShortTimestamp(ts: number): string {
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	const ss = String(d.getSeconds()).padStart(2, "0");
	const ms = String(d.getMilliseconds()).padStart(3, "0");
	return `${hh}:${mm}:${ss}.${ms}`;
}

// ─── Pretty transport ─────────────────────────────────────────────────────────

/**
 * Create a built-in pretty console transport.
 *
 * Err instances in context are rendered via `Err.toString()` on their own
 * indented line below the main line.
 *
 * @param options - Optional configuration
 */
function prettyTransport(options?: PrettyOptions): LogTransport {
	const output = options?.output ?? process.stderr;
	const colorsOpt = options?.colors ?? "auto";
	const tsOpt = options?.timestamp ?? "short";
	const levelColors = { ...DEFAULT_LEVEL_COLORS, ...options?.levelColors };

	const isTTY =
		"isTTY" in output && (output as { isTTY?: boolean }).isTTY === true;
	const useColors = colorsOpt === "auto" ? isTTY : colorsOpt === true;

	// Format timestamp per the configured tsOpt option.
	function formatTimestamp(ts: number): string {
		if (typeof tsOpt === "function") return tsOpt(ts);
		if (tsOpt === "iso") return new Date(ts).toISOString();
		return formatShortTimestamp(ts);
	}

	return {
		write(entry: LogEntry): void {
			const ts = formatTimestamp(entry.timestamp);
			const tag = LEVEL_TAGS[entry.level] ?? entry.level.toUpperCase();
			const levelColor = levelColors[entry.level] ?? "";

			// Module prefix
			const modulePrefix =
				entry.modules.length > 0
					? `${entry.modules.map((m) => `[${m}]`).join(" ")} `
					: "";

			// Split err from rest of context
			const { err: errVal, ...rest } = entry.context;
			const hasErr = errVal !== undefined;
			const hasRest = Object.keys(rest).length > 0;

			let line: string;
			if (useColors) {
				const ctxStr = hasRest ? ` ${DIM}${stringifySafe(rest)}${RESET}` : "";
				line = `${DIM}${ts}${RESET} ${levelColor}${tag}${RESET} ${modulePrefix}${entry.message}${ctxStr}`;
			} else {
				const ctxStr = hasRest ? ` ${stringifySafe(rest)}` : "";
				line = `${ts} ${tag} ${modulePrefix}${entry.message}${ctxStr}`;
			}

			if (hasErr) {
				let errStr: string;
				if (Err.isErr(errVal)) {
					errStr = (errVal as Err).toString({ stack: 3, metadata: true });
				} else {
					errStr = stringifySafe(errVal);
				}
				const indented = errStr
					.split("\n")
					.map((l) => `  ${l}`)
					.join("\n");
				line += `\n  err: ${indented.trimStart()}`;
			}

			output.write(`${line}\n`);
		},
	};
}

// ─── Core logger builder ──────────────────────────────────────────────────────

// Build a Logger function bound to module stack, bindings, level filter, and transports.
function buildLogger(
	modules: string[],
	bindings: Record<string, unknown>,
	level: LevelValue,
	transports: LogTransport[],
): Logger {
	const configNum = LEVEL_NUMBERS[level];

	const logFn = (...args: unknown[]): void => {
		const { level: callLevel, message, context } = resolveCall(...args);
		if ((LEVEL_NUMBERS[callLevel] ?? 0) < configNum) return;

		const entry: LogEntry = {
			level: callLevel,
			timestamp: Date.now(),
			message,
			context: { ...bindings, ...context },
			modules,
		};

		for (const transport of transports) {
			transport.write(entry);
		}
	};

	// Attach level constants
	const keys = Object.keys(lvl) as (keyof typeof lvl)[];
	for (const key of keys) {
		Object.defineProperty(logFn, key, {
			value: lvl[key],
			writable: false,
			enumerable: true,
		});
	}

	// Attach child()
	(logFn as unknown as { child: Logger["child"] }).child = (
		name: string,
		childBindings?: object,
	): Logger => {
		const mergedBindings: Record<string, unknown> = {
			...bindings,
			...(childBindings as Record<string, unknown> | undefined),
		};
		return buildLogger([...modules, name], mergedBindings, level, transports);
	};

	return logFn as unknown as Logger;
}

// ─── Public factory ───────────────────────────────────────────────────────────

/**
 * Create a logger instance with optional module name and configuration.
 *
 * @param module - Optional module name added as the first entry in `modules`
 * @param options - Optional configuration
 * @returns New Logger instance
 */
function createLogger(module?: string, options?: LoggerOptions): Logger {
	const level = options?.level ?? getLogLevel();
	const transports = options?.transports ?? [prettyTransport()];
	const modules = module ? [module] : [];
	return buildLogger(modules, {}, level, transports);
}

/**
 * Default logger instance for application-wide logging.
 */
export const log = createLogger();

export { createLogger, prettyTransport, lvl };
export type {
	Logger,
	LevelValue,
	LogEntry,
	LogTransport,
	LoggerOptions,
	PrettyOptions,
};
