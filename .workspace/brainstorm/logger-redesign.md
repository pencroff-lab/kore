# Brainstorm Memory for Logger Redesign (Zero Dependencies)

## 1) Current Snapshot
- **Topic / Goal:** Redesign kore logger to be dependency-free (remove pino/pino-pretty/fast-safe-stringify)
- **Success criteria:** Zero runtime deps; pretty console output built-in; pino injectable via DI; Logger interface preserved; all tests pass
- **Audience:** kore library consumers (TypeScript projects)
- **Constraints:** Dual ESM/CJS build; no runtime deps; must integrate with Err type
- **Current approach:** Custom logger with transport DI abstraction; built-in pretty console transport; LogEntry with modules array for child logger chain
- **Next steps:**
    1. Write implementation plan
    2. Implement core logger + transport types
    3. Implement pretty console transport

## 2) Context (stable background)
- Why: kore is a zero-dependency core utilities library; pino adds ~1MB+ of deps
- Current: logger.ts has pino/pino-pretty/fast-safe-stringify; NOT exported from src/utils/index.ts; env vars use HERMES_ prefix (leftover)
- Exists: Logger interface, lvl constants, resolveCall/normalizeContext/isLevel helpers, child logger pattern, test suite (379 lines), logging guide in tmp/

## 3) Requirements (testable, numbered)
### Must-have
- R1: Zero runtime npm dependencies
- R2: `LogTransport` interface with `write(entry: LogEntry): void`
- R3: `LogEntry` carries level, timestamp, message, context, modules array
- R4: Built-in pretty console transport (default)
- R5: Transports array replaces default when provided: `createLogger({ transports: [t] })`
- R6: Child loggers accumulate modules and merge bindings into context
- R7: `log` singleton + `createLogger` factory both exported
- R8: `LOG_LEVEL` env var support (generic prefix)
- R9: Err instances formatted via `Err.toString()` in pretty transport
- R10: Logger interface preserved: callable function + level constants + child()

### Should-have
- R11: Pretty transport configurable: timestamp format ('short' default | 'iso' | custom fn)
- R12: Color auto-detect (TTY check), configurable via `colors: boolean | 'auto'`
- R13: Level colors configurable via `levelColors: Partial<Record<LevelValue, string>>`
- R14: Pretty layout: dim timestamp | colored level tag | default module+message | dim context

### Nice-to-have
- R15: 256-color orange for WARN level (default)

## 4) Non-goals (explicitly out of scope)
- NG1: Built-in file transport (use DI to inject)
- NG2: Log rotation or file management
- NG3: Structured JSON transport built-in (trivial to implement as custom transport)
- NG4: Async/buffered logging

## 5) Open Questions
- (all resolved)

## 6) Decisions Log
- **2026-02-20:** Transport = `write(entry: LogEntry)` function — minimal surface, easy to adapt any backend
- **2026-02-20:** Console-only built-in — file transport via DI, keeps default simple
- **2026-02-20:** LOG_ env prefix (generic) — not tied to any specific project
- **2026-02-20:** Transports always array — consistent API, no single/array overload
- **2026-02-20:** Export both `log` singleton + `createLogger` — quick start + full control
- **2026-02-20:** Timestamp presets: 'short' (default HH:MM:SS.mmm) + 'iso' + custom fn
- **2026-02-20:** Colors: auto-detect TTY, configurable boolean/'auto', level colors only (6 slots)
- **2026-02-20:** Layout: dim timestamp | colored level | default module+msg | dim context
- **2026-02-20:** Err formatting: delegate to Err.toString() for multi-line display
- **2026-02-20:** WARN color: 256-color orange (\x1b[38;5;208m)

## 7) Risks, Dependencies, and Constraints
- Risks: Breaking change if Logger interface changes (mitigated: keeping same interface shape)
- Dependencies: Err type (already in kore), node:process (TTY detection)
- Constraints: Must work in both ESM and CJS; no runtime deps

## 8) Used sources
- Current implementation: src/utils/logger.ts
- Current tests: src/utils/logger.test.ts
- Logging guide: tmp/logging_guide.md

## 9) Outcomes — Design Specification

### Core Types

```typescript
// Log levels (unchanged)
const lvl = {
  TRACE: "trace", DEBUG: "debug", INFO: "info",
  WARN: "warn", ERROR: "error", FATAL: "fatal",
} as const;
type LevelValue = (typeof lvl)[keyof typeof lvl];

// Transport abstraction (NEW)
interface LogEntry {
  level: LevelValue;
  timestamp: number;
  message: string;
  context: Record<string, unknown>;
  modules: string[];  // accumulated by child()
}

interface LogTransport {
  write(entry: LogEntry): void;
}

// Logger interface (preserved from current)
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

### createLogger API

```typescript
interface LoggerOptions {
  level?: LevelValue;           // default: from LOG_LEVEL env or 'info'
  transports?: LogTransport[];  // default: [prettyTransport()]
}

function createLogger(module?: string, options?: LoggerOptions): Logger;
```

### Pretty Transport API

```typescript
interface PrettyOptions {
  output?: { write(data: string): void };  // default: process.stderr
  colors?: boolean | 'auto';               // default: 'auto'
  levelColors?: Partial<Record<LevelValue, string>>;
  timestamp?: 'short' | 'iso' | ((ts: number) => string);  // default: 'short'
}

function prettyTransport(options?: PrettyOptions): LogTransport;
```

### Default Color Map

```
TRACE:  \x1b[2m       (dim/gray)
DEBUG:  \x1b[36m      (cyan)
INFO:   \x1b[32m      (green)
WARN:   \x1b[38;5;208m (256-color orange)
ERROR:  \x1b[31m      (red)
FATAL:  \x1b[1m\x1b[31m (bold red)
```

### Output Format

```
{dim 14:30:05.123} {colored INF} {default [api] [users]} {default User created} {dim {userId: "abc"}}
```

Err in context:
```
14:30:05.123 ERR [api] Query failed
  err: connection refused [DB_CONN]
    > timeout after 5000ms
```

### Internal Architecture

```
createLogger(module?, options?)
  └── builds LoggerCore { level, transports, modules[], bindings }
       ├── callable function: resolveCall() → LogEntry → fan-out to transports
       └── child(name, bindings?) → new LoggerCore with extended modules + merged bindings

prettyTransport(options?)
  └── returns { write(entry) } that formats and writes to output stream
```

### Pino DI Example

```typescript
import pino from 'pino';
import { createLogger, type LogTransport, type LogEntry } from '@pencroff-lab/kore';

const pinoInstance = pino();
const pinoTransport: LogTransport = {
  write(entry: LogEntry) {
    const prefix = entry.modules.map(m => `[${m}] `).join('');
    pinoInstance[entry.level](entry.context, prefix + entry.message);
  }
};

const log = createLogger('app', { transports: [pinoTransport] });
```

### Test Transport Example

```typescript
const entries: LogEntry[] = [];
const testTransport: LogTransport = { write(e) { entries.push(e); } };
const log = createLogger('test', { transports: [testTransport] });

log(log.INFO, 'hello');
expect(entries[0].message).toBe('hello');
expect(entries[0].modules).toEqual(['test']);
```
