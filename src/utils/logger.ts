/**
 * @fileoverview Structured logging utility with multi-stream support and Err integration.
 *
 * This module provides a flexible, callable logger built on pino with:
 * - Multiple output streams (console with pretty formatting + file with JSON)
 * - Automatic Err serialization and pretty-printing
 * - Child loggers with module prefixes
 * - Variadic API supporting multiple call signatures
 * - Environment-based log level configuration
 *
 * ## Design Philosophy
 *
 * The logger is designed as a callable function with overloaded signatures,
 * making it easy to use in any context. It automatically detects and formats
 * Err instances, providing rich error context in logs.
 *
 * ## Basic Usage
 *
 * @example Simple logging
 * ```typescript
 * import { log } from './utils/logger';
 *
 * log('Application started');                           // INFO level by default
 * log(log.WARN, 'Connection slow');                     // Explicit level
 * log(log.ERROR, 'Failed to save', { userId: '123' });  // With context
 * ```
 *
 * @example Logging with Err instances
 * ```typescript
 * import { Err } from './types/err';
 * import { log } from './utils/logger';
 *
 * const [data, err] = fetchData();
 * if (err) {
 *   // Err is automatically serialized with full context
 *   log(log.ERROR, 'Data fetch failed', err);
 *   return;
 * }
 * ```
 *
 * @example Child loggers with module context
 * ```typescript
 * const dbLogger = log.child('database', { version: '1.0' });
 * dbLogger('Connected to postgres');
 * // Output: [database] Connected to postgres
 *
 * const userLogger = dbLogger.child('users');
 * userLogger('User created');
 * // Output: [database] [users] User created
 * ```
 *
 * @example Custom logger for testing
 * ```typescript
 * import { createLogger, lvl } from './utils/logger';
 *
 * const testLogger = createLogger('test', {
 *   level: lvl.DEBUG,
 *   streams: [{ stream: process.stdout }]
 * });
 * ```
 *
 * ## Configuration
 *
 * The logger reads configuration from environment variables:
 * - `LOG_LEVEL`: Minimum level to log (trace|debug|info|warn|error|fatal). Default: 'info'
 * - `LOG_FILE_PATH`: Path to log file. Default: './tmp/logs/app.log'
 *
 * @example Environment configuration
 * ```bash
 * LOG_LEVEL=debug LOG_FILE_PATH=/var/log/app.log bun run start
 * ```
 *
 * ## Output Formats
 *
 * - **Console**: Pretty-formatted with colors, timestamps, and structured Err display
 * - **File**: JSON format for structured log aggregation and analysis
 *
 * @module logger
 */

import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Err } from "@types";
import stringifySafe from "fast-safe-stringify";
import pino from "pino";
import pinoPretty from "pino-pretty";

/**
 * Log level constants for type-safe level specification.
 *
 * Use these constants instead of string literals to ensure type safety
 * and avoid typos. Each level includes all higher-severity levels.
 *
 * **Level Hierarchy** (lowest to highest):
 * - `TRACE`: Detailed debugging information (e.g., function entry/exit)
 * - `DEBUG`: Debugging information (e.g., variable values, control flow)
 * - `INFO`: General informational messages (e.g., startup, shutdown, major steps)
 * - `WARN`: Warning messages for potentially problematic situations
 * - `ERROR`: Error messages for failures that don't crash the application
 * - `FATAL`: Fatal errors that cause application termination
 *
 * @example Using log levels
 * ```typescript
 * import { log, lvl } from './utils/logger';
 *
 * log(lvl.TRACE, 'Entering function', { args });
 * log(lvl.DEBUG, 'Processing item', { id: item.id });
 * log(lvl.INFO, 'Server started', { port: 3000 });
 * log(lvl.WARN, 'Deprecated API used', { endpoint });
 * log(lvl.ERROR, 'Database query failed', err);
 * log(lvl.FATAL, 'Critical system failure', err);
 * ```
 *
 * @example Creating logger with specific level
 * ```typescript
 * const debugLogger = createLogger('debug-module', { level: lvl.DEBUG });
 * ```
 */
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
 *
 * Extracted from the `lvl` constant for use in function signatures
 * and type annotations.
 */
type LevelValue = (typeof lvl)[keyof typeof lvl];

/**
 * Callable logger interface with overloaded signatures.
 *
 * The Logger is both a function (for logging) and an object (with level constants
 * and the `child` method). This design allows for flexible usage patterns while
 * maintaining type safety.
 *
 * ## Call Signatures
 *
 * The logger supports multiple call patterns:
 * 1. `log(message)` - Log at INFO level
 * 2. `log(message, context)` - Log at INFO level with context object or Err
 * 3. `log(message, detail)` - Log at INFO level with detail string
 * 4. `log(level, message)` - Log at specific level
 * 5. `log(level, message, context)` - Log at specific level with context
 *
 * ## Level Constants
 *
 * Each logger instance provides level constants as readonly properties:
 * - `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`
 *
 * ## Methods
 *
 * - `child(module, bindings?)` - Create a child logger with module prefix
 *
 * @example Basic usage
 * ```typescript
 * const logger: Logger = createLogger();
 *
 * logger('App started');                          // INFO: App started
 * logger('Config loaded', { env: 'production' }); // INFO: Config loaded {env: "production"}
 * logger(logger.DEBUG, 'Cache hit');              // DEBUG: Cache hit
 * ```
 *
 * @example With Err instances
 * ```typescript
 * const [user, err] = await getUser(id);
 * if (err) {
 *   logger(logger.ERROR, 'User fetch failed', err);
 *   // Automatically serializes Err with full context
 * }
 * ```
 *
 * @example Child loggers
 * ```typescript
 * const dbLogger = logger.child('database');
 * const userDbLogger = dbLogger.child('users', { table: 'users' });
 *
 * userDbLogger('Query executed'); // [database] [users] Query executed {table: "users"}
 * ```
 */
interface Logger {
	/** Trace level constant */
	readonly TRACE: "trace";
	/** Debug level constant */
	readonly DEBUG: "debug";
	/** Info level constant */
	readonly INFO: "info";
	/** Warning level constant */
	readonly WARN: "warn";
	/** Error level constant */
	readonly ERROR: "error";
	/** Fatal level constant */
	readonly FATAL: "fatal";

	/**
	 * Log a message at INFO level.
	 * @param message - The log message
	 */
	(message: string): void;

	/**
	 * Log a message at INFO level with context.
	 * @param message - The log message
	 * @param context - Context object or Err instance
	 */
	(message: string, context: object | Err): void;

	/**
	 * Log a message at INFO level with detail string.
	 * @param message - The log message
	 * @param detail - Additional detail string
	 */
	(message: string, detail: string): void;

	/**
	 * Log a message at a specific level.
	 * @param level - The log level
	 * @param message - The log message
	 */
	(level: LevelValue, message: string): void;

	/**
	 * Log a message at a specific level with context.
	 * @param level - The log level
	 * @param message - The log message
	 * @param context - Context object or Err instance
	 */
	(level: LevelValue, message: string, context: object | Err): void;

	/**
	 * Create a child logger with module-specific context.
	 *
	 * Child loggers inherit the parent's configuration and add a module
	 * prefix to all messages. They can also include additional bindings
	 * that appear in every log entry.
	 *
	 * @param module - Module name for message prefix (e.g., "database", "auth")
	 * @param bindings - Optional additional context to include in all logs
	 * @returns New Logger instance with module prefix
	 *
	 * @example Simple child logger
	 * ```typescript
	 * const mainLogger = createLogger();
	 * const dbLogger = mainLogger.child('database');
	 *
	 * dbLogger('Connection established');
	 * // Output: [database] Connection established
	 * ```
	 *
	 * @example With bindings
	 * ```typescript
	 * const userLogger = mainLogger.child('users', {
	 *   service: 'user-service',
	 *   version: '2.0'
	 * });
	 *
	 * userLogger('User created', { userId: '123' });
	 * // Output includes: service="user-service", version="2.0", userId="123"
	 * ```
	 *
	 * @example Nested child loggers
	 * ```typescript
	 * const apiLogger = log.child('api');
	 * const v2Logger = apiLogger.child('v2');
	 * const usersLogger = v2Logger.child('users');
	 *
	 * usersLogger('GET /users');
	 * // Output: [api] [v2] [users] GET /users
	 * ```
	 */
	child(module: string, bindings?: object): Logger;
}

// Level validation set

const levelSet = new Set(Object.values(lvl));
// Helper: Check if string is a valid level
function isLevel(val: unknown): val is LevelValue {
	return (
		typeof val === "string" &&
		levelSet.has(val.toLocaleLowerCase() as LevelValue)
	);
}

// Helper: Normalize context - wrap Err objects in { err }
function normalizeContext(ctx: unknown): object {
	if (Err.isErr(ctx)) return { err: ctx };
	if (typeof ctx === "string") return { detail: ctx };
	if (typeof ctx === "object" && ctx !== null) return ctx as object;
	return {};
}

// Helper: Parse variadic arguments into { level, message, context }
function resolveCall(...args: unknown[]): {
	level: LevelValue;
	message: string;
	context: object;
} {
	// 1 arg: [msg] → { level: 'info', message: msg, context: {} }
	if (args.length === 1) {
		return {
			level: lvl.INFO,
			message: String(args[0]),
			context: {},
		};
	}

	// 2 args
	if (args.length === 2) {
		const [first, second] = args;

		// 2 args where first is level: [lvl, msg]
		if (isLevel(first)) {
			return {
				level: first,
				message: String(second),
				context: {},
			};
		}

		// 2 args where first is message, second is context
		return {
			level: lvl.INFO,
			message: String(first),
			context: normalizeContext(second),
		};
	}

	// 3 args: [lvl, msg, ctx]
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

	// Fallback for unexpected cases
	return {
		level: lvl.INFO,
		message: String(args[0] ?? ""),
		context: {},
	};
}

// Helper: Get log level from env var
function getLogLevel(): LevelValue {
	const envLevel = process.env.HERMES_LOG_LEVEL?.toLowerCase();
	return isLevel(envLevel) ? envLevel : lvl.INFO;
}

// Helper: Get log file path from env var with default
function getLogFilePath(): string {
	return process.env.HERMES_LOG_FILE_PATH || ".workspace/logs/hermes.log";
}

// Factory: Create pino instance with multistream
function createPinoInstance(options?: {
	streams?: pino.StreamEntry[];
	level?: LevelValue;
}): pino.Logger {
	// Use provided streams or create defaults
	const streams =
		options?.streams ??
		(() => {
			const logFilePath = getLogFilePath();

			// Ensure directory exists
			mkdirSync(dirname(logFilePath), { recursive: true });

			// Create console stream with pretty formatting
			const prettyStream = pinoPretty({
				colorize: true,
				translateTime: "SYS:yyyy-mm-dd__HH:MM:ss.l",
				ignore: "pid,hostname",
				customPrettifiers: {
					err: (val: unknown) => {
						if (val && typeof val === "object") {
							try {
								const err = Err.fromJSON(val);
								return err.toString({ stack: 3, metadata: true });
							} catch {
								return stringifySafe(val);
							}
						}
						return stringifySafe(val);
					},
				},
			});

			// Create file stream
			const fileStream = createWriteStream(logFilePath, { flags: "a" });

			return [{ stream: prettyStream }, { stream: fileStream }];
		})();

	// Create multistream
	const multistream = pino.multistream(streams);

	// Return pino logger
	return pino(
		{
			level: options?.level ?? getLogLevel(),
			base: { pid: process.pid },
			serializers: {
				err: (err: unknown) => {
					if (Err.isErr(err)) return err.toJSON();
					return pino.stdSerializers.err(err as Error);
				},
			},
		},
		multistream,
	);
}

// Factory: Wrap pino logger as callable Logger
function wrapPino(pinoLogger: pino.Logger): Logger {
	// Create callable function
	const logFn = (...args: unknown[]) => {
		const { level, message, context } = resolveCall(...args);
		pinoLogger[level](context, message);
	};

	const keys = Object.keys(lvl) as (keyof typeof lvl)[];

	keys.forEach((key) => {
		Object.defineProperty(logFn, key, {
			value: lvl[key],
			writable: false,
			enumerable: true,
		});
	});

	// Attach child() method
	logFn.child = (module: string, bindings?: object): Logger => {
		const childPinoLogger = pinoLogger.child(bindings ?? {}, {
			msgPrefix: `[${module}] `,
		});
		return wrapPino(childPinoLogger);
	};

	return logFn as unknown as Logger;
}

/**
 * Create a logger instance with optional module name and configuration.
 *
 * This factory function creates a new Logger instance with customizable
 * output streams and log level. It's useful for:
 * - Creating module-specific loggers
 * - Testing with custom streams
 * - Setting up different log levels for different parts of the application
 *
 * @param module - Optional module name for message prefix
 * @param options - Optional configuration
 * @param options.streams - Custom pino stream entries (default: console + file)
 * @param options.level - Minimum log level (default: from LOG_LEVEL env or 'info')
 * @returns New Logger instance
 *
 * @example Basic usage
 * ```typescript
 * // Create root logger
 * const logger = createLogger();
 * logger('Application ready');
 * ```
 *
 * @example Module-specific logger
 * ```typescript
 * // Create logger with module prefix
 * const dbLogger = createLogger('database');
 * dbLogger('Connected'); // Output: [database] Connected
 * ```
 *
 * @example Custom configuration
 * ```typescript
 * // Create logger with debug level
 * const debugLogger = createLogger('debug', { level: lvl.DEBUG });
 * debugLogger(debugLogger.DEBUG, 'Verbose info');
 * ```
 *
 * @example Testing with custom streams
 * ```typescript
 * import { createLogger, lvl } from './utils/logger';
 *
 * // Capture logs in tests
 * const logs: string[] = [];
 * const testStream = {
 *   write: (msg: string) => logs.push(msg)
 * };
 *
 * const testLogger = createLogger('test', {
 *   streams: [{ stream: testStream }],
 *   level: lvl.DEBUG
 * });
 *
 * testLogger('Test started');
 * expect(logs).toContain('[test] Test started');
 * ```
 *
 * @example Production setup with custom file path
 * ```typescript
 * // Custom streams for different environments
 * const prodLogger = createLogger('api', {
 *   level: lvl.INFO,
 *   streams: [
 *     { stream: process.stdout },
 *     { stream: createWriteStream('/var/log/api.log', { flags: 'a' }) }
 *   ]
 * });
 * ```
 */
function createLogger(
	module?: string,
	options?: { streams?: pino.StreamEntry[]; level?: LevelValue },
): Logger {
	const pinoLogger = createPinoInstance(options);

	if (module) {
		const childLogger = pinoLogger.child({}, { msgPrefix: `[${module}] ` });
		return wrapPino(childLogger);
	}

	return wrapPino(pinoLogger);
}

/**
 * Default logger instance for application-wide logging.
 *
 * This is a pre-configured logger ready to use throughout the application.
 * It uses the default configuration (console + file output, INFO level unless
 * overridden by LOG_LEVEL environment variable).
 *
 * For module-specific logging, use `log.child(moduleName)` instead of importing
 * separate loggers.
 *
 * @example Basic usage
 * ```typescript
 * import { log } from './utils/logger';
 *
 * log('Application started');
 * log(log.INFO, 'Server listening', { port: 3000 });
 * log(log.ERROR, 'Startup failed', err);
 * ```
 *
 * @example Module-specific logging
 * ```typescript
 * import { log } from './utils/logger';
 *
 * const dbLogger = log.child('database');
 * const authLogger = log.child('auth');
 *
 * dbLogger('Connection pool initialized');
 * authLogger('JWT keys loaded');
 * ```
 */
export const log = createLogger();

// Exports
export { createLogger };
export { lvl };
export type { Logger, LevelValue };
