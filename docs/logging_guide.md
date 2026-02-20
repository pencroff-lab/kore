# Logging Guide

This guide covers logging patterns, conventions, and integration for the project.

## Overview

| Aspect | Decision |
|--------|----------|
| Injection | DI via handler factory deps |
| Correlation | Child logger with `runId` binding |
| Dry-run | Child logger with `DRY-RUN` module prefix |
| Error logging | DEBUG at origin, ERROR at boundary only |

## Log Levels

Levels are bound directly on every `Logger` instance as readonly properties. Access them via the log function itself — no separate import needed:

```typescript
// Levels are properties on the log function
log(log.INFO, 'Starting generation');
log(log.ERROR, 'Command failed', err);

// Works on any Logger instance (child loggers too)
const svcLog = log.child('claude');
svcLog(svcLog.DEBUG, 'Calling CLI');
```

| Level | Use Case | Example |
|-------|----------|---------|
| `log.TRACE` | Function entry/exit, loop iterations | `Entering parseMarkdown` |
| `log.DEBUG` | Variable values, intermediate results, error origin | `Parsed 5 sections`, `CLI returned error` |
| `log.INFO` | Major workflow steps, user-visible events | `Generating note for section 3` |
| `log.WARN` | Recoverable issues, retry attempts | `CLI timeout, retrying (1/3)` |
| `log.ERROR` | Failures at handler boundary | `Command failed` (logged once) |
| `log.FATAL` | Unrecoverable, process exits | `Database connection failed` |

## Logger DI Pattern

Logger is passed through deps, matching the handler factory pattern. Only import `createLogger` at the entry point; everywhere else receive `Logger` type via deps:

```typescript
import type { Logger } from "../../utils/logger";

interface FromPlanDeps {
  db: Database;
  log: Logger;  // Injected logger function
  config: Config;
}

function createFromPlanHandler(deps: FromPlanDeps): Outcome<Handler> {
  // Validate deps...

  const handler = async (argv: ArgumentsCamelCase<FromPlanArgs>): Promise<void> => {
    const { log, db, config } = deps;
    const runId = Bun.randomUUIDv7("base64url");

    // Create run-scoped logger with correlation
    const runLog = log.child('from_plan', { runId });

    // Create dry-run logger if needed
    const dryRunLog = argv.dryRun
      ? runLog.child('DRY-RUN')
      : null;

    const ctx: ExecutionContext = {
      runId,
      dryRun: argv.dryRun ?? false,
      log: runLog,
      dryRunLog,
    };

    // ... handler logic
  };

  return Outcome.ok(handler);
}
```

## Run Correlation

Use child loggers with `runId` binding so all log lines from the same run can be traced:

```typescript
const runLog = log.child('from_plan', { runId });

// All subsequent log calls include runId automatically
runLog(runLog.INFO, 'Starting note generation', { plan: argv.plan });
runLog(runLog.INFO, 'Processing section', { index: 1, title: "Gradient Descent" });
```

## Error Logging Strategy

**Principle:** Log DEBUG at origin, add context via `.wrap()` in intermediate layers, log ERROR once at boundary.

### Service Layer (Origin) - DEBUG Only

```typescript
async function callClaude(prompt: string, ctx: ExecutionContext): Promise<Outcome<string>> {
  return Outcome.fromAsync(async () => {
    const result = await $`claude -p ${prompt}`.nothrow().quiet();

    if (result.exitCode !== 0) {
      const err = Err.from("CLI execution failed", { code: "CLI_ERROR" })
        .withMetadata({ exitCode: result.exitCode });

      // DEBUG at origin - captures technical detail
      ctx.log(ctx.log.DEBUG, 'Claude CLI failed', err);
      throw err;
    }

    return [result.stdout.toString(), null];
  });
}
```

### Intermediate Layer - Wrap Error, No Logging

```typescript
async function generateNote(
  section: Section,
  ctx: ExecutionContext
): Promise<Outcome<GeneratedNote>> {
  const prompt = buildPrompt(section);

  const [output, cliErr] = await callClaude(prompt, ctx).toTuple();
  if (cliErr) {
    // Wrap with context, don't log (avoid duplication)
    return Outcome.err(cliErr.wrap(`Failed to generate note for "${section.title}"`));
  }

  const [note, parseErr] = parseNoteOutput(output).toTuple();
  if (parseErr) {
    ctx.log(ctx.log.DEBUG, 'Note parsing failed', parseErr);
    return Outcome.err(parseErr.wrap("Failed to parse generated note"));
  }

  return Outcome.ok(note);
}
```

### Handler Boundary - ERROR Once

```typescript
const handler = async (argv: Args): Promise<void> => {
  const ctx = createContext(argv, deps);

  const { log } = ctx;

  log(log.INFO, 'Starting note generation', { plan: argv.plan });

  for (const section of sections) {
    log(log.INFO, 'Processing section', {
      index: section.index,
      title: section.title
    });

    const [note, err] = await generateNote(section, ctx).toTuple();
    if (err) {
      // ERROR at boundary - single log with full wrapped context
      log(log.ERROR, 'Section processing failed', err);
      continue;  // or return based on strategy
    }

    log(log.INFO, 'Note generated', { path: note.path });
  }

  log(log.INFO, 'Generation complete');
};
```

## Dry-Run Logging Pattern

Use a child logger with `DRY-RUN` module prefix for simulated operations:

```typescript
async function saveNote(
  note: GeneratedNote,
  ctx: ExecutionContext
): Promise<Outcome<string>> {
  const path = resolvePath(note);

  if (ctx.dryRun && ctx.dryRunLog) {
    // Use dedicated dry-run logger - message clearly marked
    ctx.dryRunLog(ctx.dryRunLog.INFO, 'Would write note', { path, size: note.content.length });
    return Outcome.ok(path);
  }

  return Outcome.fromAsync(async () => {
    await Bun.write(path, note.content);
    ctx.log(ctx.log.INFO, 'Wrote note', { path });
    return [path, null];
  });
}

// Console output:
// [hermes] [DRY-RUN] [from_plan] Would write note { path: "...", size: 4521 }
```

## Service Logger Injection

Services receive logger through their factory/constructor and create service-specific child loggers:

```typescript
import type { Logger } from "@utils/logger";

interface ClaudeServiceDeps {
  shell: ShellExecutor;
  log: Logger;
  config: LlmConfig;
}

function createClaudeService(deps: ClaudeServiceDeps) {
  const { shell, log, config } = deps;

  // Create service-specific child logger
  const svcLog = log.child('claude');

  return {
    async generate(prompt: string): Promise<Outcome<string>> {
      svcLog(svcLog.DEBUG, 'Calling Claude CLI', {
        model: config.model,
        promptLength: prompt.length
      });

      // ... implementation
    }
  };
}
```

## CLI Initialization with Logger

```typescript
import { createLogger } from "./utils/logger";

async function initializeCli(): Promise<Outcome<void>> {
  // 1. Create root logger
  const log = createLogger('hermes');

  // 2. Load config
  const [config, configErr] = await loadConfig().toTuple();
  if (configErr) {
    log(log.FATAL, 'Config load failed', configErr);
    return Outcome.err(configErr);
  }

  // 3. Initialize DB
  const [db, dbErr] = createDatabase(config.paths.workspace_dir).toTuple();
  if (dbErr) {
    log(log.FATAL, 'Database init failed', dbErr);
    return Outcome.err(dbErr);
  }

  // 4. Create handler with log in deps
  const [handler, handlerErr] = createFromPlanHandler({
    db,
    log,
    config
  }).toTuple();

  if (handlerErr) {
    log(log.FATAL, 'Handler creation failed', handlerErr);
    return Outcome.err(handlerErr);
  }

  // 5. Register and run
  await yargs(hideBin(process.argv))
    .command({ command: "study_note from_plan", handler })
    .parse();

  return Outcome.ok(null);
}
```

## Execution Context

```typescript
import type { Logger } from "../../utils/logger";

interface ExecutionContext {
  runId: string;
  dryRun: boolean;
  log: Logger;               // Run-scoped logger with runId binding
  dryRunLog: Logger | null;  // Only set when dryRun=true
}
```

## Environment Configuration

Hermes uses `HERMES_` prefix for env vars:

```bash
# Log level (default: info)
HERMES_LOG_LEVEL=debug

# Log file path (default: .workspace/logs/hermes.log)
HERMES_LOG_FILE_PATH=./logs/hermes.log
```

```typescript
// Internal to src/utils/logger.ts (lvl is module-private)
function getLogLevel(): LevelValue {
  const envLevel = process.env.HERMES_LOG_LEVEL?.toLowerCase();
  return isLevel(envLevel) ? envLevel : lvl.INFO;
}

function getLogFilePath(): string {
  return process.env.HERMES_LOG_FILE_PATH || "./.workspace/logs/hermes.log";
}
```

Consumer code never imports `lvl` — use `log.INFO`, `log.DEBUG`, etc. instead.

## Testing with Logger

Logger is silent in tests for v1. Use a mock logger that captures calls for assertion:

```typescript
import sinon from "sinon";
import type { Logger } from "@utils/logger";

export function createMockLog(): Logger {
  const log = sinon.stub() as unknown as Logger;

  Object.assign(log, {
    TRACE: "trace",
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
    FATAL: "fatal",
    child: sinon.stub().returns(log),
  });

  return log;
}

// Usage in tests
const mockLog = createMockLog();
const deps = { log: mockLog, db: mockDb, config: testConfig };

const [handler] = createFromPlanHandler(deps).toTuple();
await handler({ plan: "./test.md" });

sinon.assert.calledWith(
  mockLog as unknown as sinon.SinonStub,
  mockLog.INFO,
  sinon.match("Starting")
);
```

## Naming Convention

Logger is a function type — use short names: `log`, `ctx.log`, `svcLog`, `runLog`.

| Context | Name | Example |
|---------|------|---------|
| Root / deps field | `log` | `deps.log`, `const log = createLogger('hermes')` |
| Run-scoped child | `runLog` | `const runLog = log.child('from_plan', { runId })` |
| Service child | `svcLog` | `const svcLog = log.child('claude')` |
| Dry-run child | `dryRunLog` | `const dryRunLog = runLog.child('DRY-RUN')` |
| Execution context | `ctx.log` | `ctx.log(ctx.log.INFO, 'Processing')` |
| Test mock | `mockLog` | `const mockLog = createMockLog()` |

## Summary

1. **Inject `log` via deps** - never import a global singleton
2. **Use child loggers** for run correlation (`runId`) and module scoping
3. **DEBUG at origin, ERROR at boundary** - avoid duplicate error logs
4. **Wrap errors in intermediate layers** - add context without logging
5. **Dedicated dry-run logger** - prefix with `DRY-RUN` module for simulated ops
6. **FATAL for process exits** - config load, DB init, handler creation failures
7. **Silent in tests** - mock log captures calls for Sinon assertions
8. **Short names** - `log`, `ctx.log`, `svcLog`, `runLog` (not `logger`)
9. **Levels on the function** - use `log.INFO`, `log.ERROR` etc., never import `lvl` in consumer code
