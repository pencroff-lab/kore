# Migration from Throwing

Step-by-step guide for converting `try/catch` code to result tuples with `flow`.

Every fallible function returns a `ResultTuple<T>` — `readonly [T, null]` on
success, `readonly [null, Err]` on failure — built with `ok()` and `fail()`.

## Step 1: Identify the throwing function

```typescript
// Before: throws on error
function parseConfig(raw: string): Config {
  const json = JSON.parse(raw); // throws SyntaxError
  if (!json.port) throw new Error("port is required");
  return { port: json.port, host: json.host ?? "localhost" };
}
```

## Step 2: Wrap with `attempt()`

The simplest migration — keep the internals, change the boundary:

```typescript
import { attempt, ok, type ResultTuple } from "@pencroff-lab/kore";

function parseConfig(raw: string): ResultTuple<Config> {
  return attempt(() => {
    const json = JSON.parse(raw);
    if (!json.port) throw new Error("port is required");
    return ok({ port: json.port, host: json.host ?? "localhost" });
  });
}
```

`attempt()` catches any thrown exception and converts it with `Err.from()`. The
callback still has to return a tuple — `ok(...)` or `fail(...)` — so a missing
return is a compile error rather than a silent success.

## Step 3: Replace throws with explicit failures

For real error codes and metadata, return `fail()` instead of throwing:

```typescript
import { attempt, Err, fail, ok, type ResultTuple } from "@pencroff-lab/kore";

function parseConfig(raw: string): ResultTuple<Config> {
  const [json, parseErr] = attempt<unknown>(() => ok(JSON.parse(raw)));
  if (parseErr) {
    return fail(parseErr.wrap("Invalid JSON", { code: "PARSE_ERROR" }));
  }

  const obj = json as Record<string, unknown>;
  if (!obj.port) return fail("port is required", "MISSING_FIELD");

  return ok({
    port: obj.port as number,
    host: (obj.host as string) ?? "localhost",
  });
}
```

## Step 4: Update calling code

```typescript
// Before: try/catch
try {
  const config = parseConfig(raw);
  startServer(config);
} catch (e) {
  console.error("Failed:", e);
  process.exit(1);
}

// After: destructure the result — there is nothing to unwrap
const [config, err] = parseConfig(raw);
if (err) {
  console.error("Failed:", err.toString());
  process.exit(1);
}
startServer(config);
```

Or fold both channels inline with `either`:

```typescript
either(
  parseConfig(raw),
  (config) => startServer(config),
  (err) => {
    console.error("Failed:", err.toString());
    process.exit(1);
  },
);
```

## Async functions

Use `attemptAsync()` for async throwing code:

```typescript
// Before
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// After
async function fetchUser(id: string): Promise<ResultTuple<User>> {
  return attemptAsync(async () => {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) {
      return fail(
        Err.from(`HTTP ${res.status}`, {
          code: "HTTP_ERROR",
          metadata: { status: res.status, url: `/api/users/${id}` },
        }),
      );
    }
    return ok((await res.json()) as User);
  });
}
```

## Common refactoring patterns

### Wrapping a throwing library call

```typescript
const safeJsonParse = (raw: string): ResultTuple<unknown> =>
  attempt(() => ok(JSON.parse(raw)));
```

### Composing tuple-returning functions

A tuple-returning callee composes directly — no lifting step, no unwrapping:

```typescript
const config = flatMap(findUser(id), loadConfigFor);

const loaded = pipe(
  ok(raw),
  onOk(parseConfig),
  onOk(validate),
  onErr((e) => fail(e.wrap("Startup failed", { code: "STARTUP" }))),
);
```

### Gradual migration

Nothing needs converting at once. `Err.from()` accepts a native `Error`, so a
legacy `try/catch` produces a value the rest of the code can carry:

```typescript
try {
  legacyOperation();
} catch (e) {
  const err = Err.from(e as Error).withCode("LEGACY_ERROR");
  return fail(err);
}
```

## Gotchas

- **`attempt()` catches every throw** — including programming errors like
  `TypeError`. To catch only expected failures, use an explicit `try/catch`
  inside the callback and return `fail(...)` yourself.
- **A fallible callback must return a tuple.** A bare value, a bare `Err`, and a
  missing return are all compile errors. `map` is the one exception: its return
  is data, never control flow.
- **`ok(err)` carries an error as data.** The tuple's error slot is the only
  failure signal, so a value that happens to be an `Err` — or a tuple — is
  carried unchanged.
- **`ok()` is `undefined`, `ok(null)` is `null`.** `ok()` is typed
  `ResultTuple<void>`; it serializes to `[null, null]` and comes back as
  `ok(null)`.
- **`defaultTo` is handler-only.** A constant fallback is a thunk:
  `defaultTo(result, () => 0)`.
- **Error codes are not inherited** — wrapping an `Err` does not copy the code.
  Use `err.hasCode()` to search the cause chain.
- **`Err.isErr` is nominal.** A plain `{ kind: "Err" }` object is data, not an
  error; use `Err.from(marker)` to reconstruct a real instance from wire data.

## See also

- [flow examples](../examples/flow.md) — every pattern above, executable
- [Err examples](../examples/err.md) — section 3 "Catching native errors"
- [Migrating from `Outcome`](../../README.md#migrating-from-outcome) — the class-tier operation map
