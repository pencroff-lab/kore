# Plan: Zero-Dependency Logger Redesign

## Context

The kore library (`@pencroff-lab/kore`) is a TypeScript utilities library. The current logger at `src/utils/logger.ts` depends on `pino`, `pino-pretty`, and `fast-safe-stringify`. The logger is not yet exported from the public API. This rewrite removes `pino` and `pino-pretty` dependencies, keeps `fast-safe-stringify` for safe JSON serialization, introduces a transport DI abstraction (so consumers can inject pino or any backend), and adds a built-in pretty console transport.

Full design spec: `.workspace/brainstorm/logger-redesign.md`

## Files to Modify

| File | Action |
|------|--------|
| `src/utils/logger.ts` | Full rewrite (~380 lines) |
| `src/utils/logger.test.ts` | Full rewrite (~480 lines) |
| `src/utils/index.ts` | Add 1 export line |
| `package.json` | Add `fast-safe-stringify` to `dependencies` |

## Step 1: Rewrite `src/utils/logger.ts`

### 1a. Imports
- Remove: `pino`, `pino-pretty`, `node:fs`, `node:path`, `@types` alias
- Keep: `fast-safe-stringify` (add to package.json `dependencies`)
- Add: `import { Err } from "../types/err";` (matches barrel pattern in `src/types/index.ts`)

### 1b. Keep from current (unchanged)
- `lvl` constant object
- `LevelValue` type
- `Logger` interface (all call signatures and JSDoc)
- `levelSet` / `isLevel()` helper
- `resolveCall()` helper (variadic arg parser)
- `normalizeContext()` helper (change return type to `Record<string, unknown>`)

### 1c. New types

```typescript
interface LogEntry {
    level: LevelValue;
    timestamp: number;        // Date.now()
    message: string;
    context: Record<string, unknown>;
    modules: string[];        // accumulated by child()
}

interface LogTransport {
    write(entry: LogEntry): void;
}

interface PrettyOptions {
    output?: { write(data: string): void };   // default: process.stderr
    colors?: boolean | "auto";                 // default: 'auto' (TTY detect)
    levelColors?: Partial<Record<LevelValue, string>>;
    timestamp?: "short" | "iso" | ((ts: number) => string);  // default: 'short'
}

interface LoggerOptions {
    level?: LevelValue;            // default: LOG_LEVEL env or 'info'
    transports?: LogTransport[];   // default: [prettyTransport()]
}
```

### 1d. New constants
- `LEVEL_NUMBERS: Record<LevelValue, number>` — simple 0-5 indexing for `>=` comparison (internal only)
- `LEVEL_TAGS: Record<LevelValue, string>` — 3-char tags: TRC/DBG/INF/WRN/ERR/FTL
- Default ANSI colors: trace=dim, debug=cyan, info=green, warn=orange(256), error=red, fatal=bold+red

### 1e. `fast-safe-stringify`
- Keep as dependency (move from implicit to explicit `dependencies` in `package.json`)
- Used in pretty transport for safe context serialization
- Import: `import stringifySafe from "fast-safe-stringify";`

### 1f. Update `getLogLevel()`
- Change env var from `HERMES_LOG_LEVEL` to `LOG_LEVEL`
- Remove `getLogFilePath()` (no built-in file transport)

### 1g. Core: `buildLogger(modules, bindings, level, transports) -> Logger`
Replaces `wrapPino`. Creates callable Logger:
- `resolveCall()` parses args -> check level >= config level -> build `LogEntry` -> fan-out to transports
- `child(name, bindings?)` -> new `buildLogger` with `[...modules, name]`, merged bindings, same transports ref
- Attach level constants via `Object.defineProperty`

### 1h. Pretty transport: `prettyTransport(options?) -> LogTransport`
- TTY auto-detection: `"isTTY" in output && output.isTTY === true`
- Layout: `{dim timestamp} {colored TAG} {default [modules] message} {dim context}`
- Timestamp: 'short' = `HH:MM:SS.mmm` local time (default), 'iso' = ISO string, or custom fn
- Err handling: extract `err` key from context, format via `Err.toString({ stack: 3, metadata: true })`, indent below main line
- Context (non-err keys) serialized via `stringifySafe` from `fast-safe-stringify`

### 1i. Factory: `createLogger(module?, options?) -> Logger`
- Reads `LOG_LEVEL` env var for default level
- Default transport: `[prettyTransport()]`
- Delegates to `buildLogger`

### 1j. Exports
```typescript
export { createLogger, prettyTransport, log, lvl };
export type { Logger, LevelValue, LogEntry, LogTransport, LoggerOptions, PrettyOptions };
```

## Step 2: Rewrite `src/utils/logger.test.ts`

### Test helper: spy transport
```typescript
function createSpyLogger(module?, options?) {
    const entries: LogEntry[] = [];
    const spyTransport: LogTransport = { write(e) { entries.push(e); } };
    const logger = createLogger(module, { transports: [spyTransport], level: lvl.TRACE, ...options });
    return { logger, entries };
}
```

### Test groups
1. **lvl constants** — values and properties (keep from current)
2. **Argument resolution** — `test.each` with all 5 call signatures, verify LogEntry fields
3. **LogEntry structure** — timestamp is number, modules is array, context merges bindings
4. **Level filtering** — `test.each` matrix: config level vs log level -> shouldLog boolean
5. **createLogger factory** — callable, level constants, with/without module, custom transports/level
6. **Child loggers** — module accumulation, binding merging, transport sharing, level inheritance
7. **Pretty transport formatting** — use string collector + sinon fake timers for deterministic output; test: short/iso/custom timestamp, colors on/off/auto, level tags, module brackets, context JSON, empty context
8. **Err integration in pretty transport** — Err extracted and formatted via toString(), indented multi-line
9. **Environment variables** — LOG_LEVEL respected, invalid fallback, case-insensitive
10. **Multiple transports** — both receive same entry
11. **log singleton** — exported, callable, has child(), has level constants
12. **Edge cases** — null/undefined context, empty message, circular refs in context, empty bindings

## Step 3: Update `src/utils/index.ts`

```typescript
export * from "./format_dt";
export * from "./logger";
```

## Verification

Run in sequence:
1. `bunx biome check --fix src/` — fix formatting
2. `bun run lint:type` — type check passes
3. `bun test` — all tests pass
4. `bun run test:coverage` — >= 83% coverage
5. `bun run build` — dual ESM/CJS build succeeds
