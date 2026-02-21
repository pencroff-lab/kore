# Logger

Structured logging utility with transport dependency injection and Err integration.

The logger is a callable function with overloaded signatures and level constants attached as properties. Transports are injectable, making the logger testable without streams or process-level side effects. The built-in pretty transport renders to stderr with ANSI colors and automatic `Err` formatting.

For usage patterns, DI conventions, and error logging strategy, see the [Logging Guide](logging_guide.md).

## Exports

```typescript
import { log, createLogger, prettyTransport, lvl } from "@pencroff-lab/kore";
import type {
  Logger,
  LevelValue,
  LogEntry,
  LogTransport,
  LoggerOptions,
  PrettyOptions,
} from "@pencroff-lab/kore";
```

## Types

### `LevelValue`

```typescript
type LevelValue = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
```

Union type of valid log level strings.

### `LogEntry`

A single structured log entry passed to transports.

```typescript
interface LogEntry {
  level: LevelValue;
  timestamp: number;
  message: string;
  context: Record<string, unknown>;
  modules: string[];
}
```

| Property    | Type                       | Description                                      |
|-------------|----------------------------|--------------------------------------------------|
| `level`     | `LevelValue`               | Log level of this entry.                         |
| `timestamp` | `number`                   | Unix timestamp in milliseconds (`Date.now()`).   |
| `message`   | `string`                   | Log message.                                     |
| `context`   | `Record<string, unknown>`  | Merged bindings and call-site context.            |
| `modules`   | `string[]`                 | Module chain accumulated by `child()` calls.     |

### `LogTransport`

Transport interface for log output backends. Implement this to integrate any logging backend (file, remote service, test spy, etc.).

```typescript
interface LogTransport {
  write(entry: LogEntry): void;
}
```

#### Example: Pino transport

```typescript
import pino from "pino";
import type { LogTransport, LogEntry } from "@pencroff-lab/kore";

const pinoInstance = pino();
const pinoTransport: LogTransport = {
  write(entry: LogEntry) {
    const prefix = entry.modules.map((m) => `[${m}] `).join("");
    pinoInstance[entry.level](entry.context, prefix + entry.message);
  },
};
```

#### Example: Test spy transport

```typescript
import type { LogEntry, LogTransport } from "@pencroff-lab/kore";

const entries: LogEntry[] = [];
const spy: LogTransport = { write(e) { entries.push(e); } };
```

### `PrettyOptions`

Options for the built-in pretty console transport.

```typescript
interface PrettyOptions {
  output?: { write(data: string): void };
  colors?: boolean | "auto";
  levelColors?: Partial<Record<LevelValue, string>>;
  timestamp?: "short" | "iso" | ((ts: number) => string);
}
```

| Option        | Type                                          | Default          | Description                                              |
|---------------|-----------------------------------------------|------------------|----------------------------------------------------------|
| `output`      | `{ write(data: string): void }`               | `process.stderr` | Output stream.                                           |
| `colors`      | `boolean \| "auto"`                           | `"auto"`         | ANSI colors. `"auto"` enables when output is a TTY.      |
| `levelColors` | `Partial<Record<LevelValue, string>>`         | (built-in)       | Override ANSI escape sequences per level.                |
| `timestamp`   | `"short" \| "iso" \| ((ts: number) => string)` | `"short"`        | Timestamp format. `"short"` is `HH:MM:SS.mmm` local time. |

### `LoggerOptions`

Options for `createLogger`.

```typescript
interface LoggerOptions {
  level?: LevelValue;
  transports?: LogTransport[];
}
```

| Option       | Type             | Default                               | Description                          |
|--------------|------------------|---------------------------------------|--------------------------------------|
| `level`      | `LevelValue`     | `LOG_LEVEL` env or `"info"`           | Minimum log level.                   |
| `transports` | `LogTransport[]` | `[prettyTransport()]`                 | Transports to write entries to.      |

### `Logger`

Callable logger interface. The Logger is both a function (for logging) and an object (with level constants and the `child` method).

```typescript
interface Logger {
  readonly TRACE: "trace";
  readonly DEBUG: "debug";
  readonly INFO: "info";
  readonly WARN: "warn";
  readonly ERROR: "error";
  readonly FATAL: "fatal";

  (message: string): void;
  (message: string, context: object | Err): void;
  (message: string, detail: string): void;
  (level: LevelValue, message: string): void;
  (level: LevelValue, message: string, context: object | Err): void;

  child(module: string, bindings?: object): Logger;
}
```

#### Call Signatures

| Signature                              | Level  | Description                         |
|----------------------------------------|--------|-------------------------------------|
| `log(message)`                         | INFO   | Log at default INFO level.          |
| `log(message, context)`               | INFO   | INFO with context object or Err.    |
| `log(message, detail)`                | INFO   | INFO with detail string.            |
| `log(level, message)`                 | given  | Log at specific level.              |
| `log(level, message, context)`        | given  | Specific level with context or Err. |

Context handling:
- `Err` instances are stored as `{ err: <Err> }` in `context`
- Plain strings are stored as `{ detail: <string> }` in `context`
- Objects are used as-is

## `lvl`

Level constants object for use with `createLogger` options.

```typescript
const lvl = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;
```

**Level hierarchy** (lowest to highest):

| Numeric | Level   | Tag   | Description                          |
|---------|---------|-------|--------------------------------------|
| 0       | `trace` | `TRC` | Detailed debugging information       |
| 1       | `debug` | `DBG` | Debugging information                |
| 2       | `info`  | `INF` | General informational messages       |
| 3       | `warn`  | `WRN` | Warning messages                     |
| 4       | `error` | `ERR` | Error messages for failures          |
| 5       | `fatal` | `FTL` | Fatal errors causing termination     |

Consumer code should use level constants on the logger instance (`log.INFO`, `log.ERROR`, etc.) rather than importing `lvl` directly. The `lvl` export is intended for `createLogger` options only.

## `createLogger()`

Create a logger instance with optional module name and configuration.

```typescript
function createLogger(module?: string, options?: LoggerOptions): Logger
```

### Parameters

| Parameter | Type            | Default     | Description                                     |
|-----------|-----------------|-------------|-------------------------------------------------|
| `module`  | `string`        | `undefined` | Module name added as the first entry in `modules`. |
| `options` | `LoggerOptions` | `{}`        | Logger configuration.                           |

### Examples

```typescript
// Default logger (INFO level, pretty transport)
const logger = createLogger();
logger("Application ready");

// Module-specific logger
const dbLogger = createLogger("database");
dbLogger("Connected");
// Output: [database] Connected

// With explicit level and custom transport
const entries: LogEntry[] = [];
const spy: LogTransport = { write(e) { entries.push(e); } };
const testLogger = createLogger("test", {
  transports: [spy],
  level: lvl.TRACE,
});
```

## `prettyTransport()`

Create a built-in pretty console transport.

```typescript
function prettyTransport(options?: PrettyOptions): LogTransport
```

Renders log entries to a human-readable format with optional ANSI colors. Writes to `process.stderr` by default.

### Output Format

```
{dim timestamp} {colored TAG} {[mod] [mod]} {message} {dim context}
```

Example (colors disabled):

```
12:34:56.789 INF [app] Server started {"port":3000}
12:34:56.800 ERR [app] Request failed
  err: Err: Connection timeout [NET:TIMEOUT]
```

`Err` instances in context are rendered via `Err.toString()` on their own indented line below the main line.

### Examples

```typescript
// Default: stderr, auto colors, short timestamps
const transport = prettyTransport();

// Disable colors, use ISO timestamps
const plain = prettyTransport({
  colors: false,
  timestamp: "iso",
});

// Custom output stream
const buf: string[] = [];
const capture = prettyTransport({
  output: { write(data) { buf.push(data); } },
  colors: false,
});

// Custom timestamp formatter
const custom = prettyTransport({
  timestamp: (ts) => new Date(ts).toLocaleDateString(),
});
```

## `log`

Default logger instance created with no module name and default options. Provided for convenience; prefer `createLogger` with an explicit module name for production use.

```typescript
export const log: Logger = createLogger();
```

### Examples

```typescript
import { log } from "@pencroff-lab/kore";

log("Application started");
log(log.INFO, "Server listening", { port: 3000 });
log(log.ERROR, "Startup failed", err);
```

## `child()`

Create a child logger with module-specific context.

```typescript
child(module: string, bindings?: object): Logger
```

### Parameters

| Parameter  | Type     | Default     | Description                                       |
|------------|----------|-------------|---------------------------------------------------|
| `module`   | `string` | (required)  | Module name appended to the `modules` array.      |
| `bindings` | `object` | `undefined` | Key-value pairs merged into every entry's context. |

Child loggers inherit level, transports, and parent bindings. Module names are accumulated, producing `[parent] [child]` prefixes in output.

### Examples

```typescript
const appLog = createLogger("app");

// Service-scoped child
const dbLog = appLog.child("database", { version: "1.0" });
dbLog("Connected to postgres");
// Output: [app] [database] Connected to postgres {"version":"1.0"}

// Nested children
const userLog = dbLog.child("users");
userLog("User created");
// Output: [app] [database] [users] User created {"version":"1.0"}

// Run-scoped child with correlation ID
const runLog = appLog.child("handler", { runId: "abc-123" });
runLog(runLog.INFO, "Processing started");
// Output: [app] [handler] Processing started {"runId":"abc-123"}
```

## Environment Configuration

```bash
# Minimum log level (default: info)
# Valid values: trace, debug, info, warn, error, fatal
LOG_LEVEL=debug
```

The logger reads `LOG_LEVEL` at creation time. When not set, defaults to `info`. The level can be overridden via `createLogger` options.
