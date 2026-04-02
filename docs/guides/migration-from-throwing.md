# Migration from Throwing

Step-by-step guide for converting `try/catch` code to `Outcome`-based error handling.

## Step 1: Identify the throwing function

```typescript
// Before: throws on error
function parseConfig(raw: string): Config {
  const json = JSON.parse(raw); // throws SyntaxError
  if (!json.port) throw new Error("port is required");
  return { port: json.port, host: json.host ?? "localhost" };
}
```

## Step 2: Wrap with `Outcome.from()`

The simplest migration — wrap the existing code without changing its internals:

```typescript
import { Outcome } from "@pencroff-lab/kore/types";

function parseConfig(raw: string): Outcome<Config> {
  return Outcome.from(() => {
    const json = JSON.parse(raw);
    if (!json.port) throw new Error("port is required");
    return [{ port: json.port, host: json.host ?? "localhost" }, null];
  });
}
```

`Outcome.from()` catches any thrown exception and wraps it as an `Err`.

## Step 3: Replace throws with explicit errors

For better error codes and metadata, replace throws with `Err` returns:

```typescript
import { Err, Outcome } from "@pencroff-lab/kore/types";

function parseConfig(raw: string): Outcome<Config> {
  return Outcome.from(() => {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      return Err.from(e as Error).wrap("Invalid JSON", { code: "PARSE_ERROR" });
    }

    const obj = json as Record<string, unknown>;
    if (!obj.port) return Err.from("port is required", "MISSING_FIELD");

    return [{ port: obj.port as number, host: (obj.host as string) ?? "localhost" }, null];
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

// After: tuple destructuring
const [config, err] = parseConfig(raw).toTuple();
if (err) {
  console.error("Failed:", err.toString());
  process.exit(1);
}
startServer(config);
```

Or with `either` for inline handling:

```typescript
parseConfig(raw).either(
  (config) => startServer(config),
  (err) => {
    console.error("Failed:", err.toString());
    process.exit(1);
  },
);
```

## Async functions

Use `Outcome.fromAsync()` for async throwing code:

```typescript
// Before
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// After
async function fetchUser(id: string): Promise<Outcome<User>> {
  return Outcome.fromAsync(async () => {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) {
      return Err.from(`HTTP ${res.status}`, {
        code: "HTTP_ERROR",
        metadata: { status: res.status, url: `/api/users/${id}` },
      });
    }
    return [await res.json(), null] as [User, null];
  });
}
```

## Common refactoring patterns

### Wrapping existing throwing libraries

```typescript
function safeJsonParse(raw: string): Outcome<unknown> {
  return Outcome.from(() => {
    return [JSON.parse(raw), null] as [unknown, null];
  });
}
```

### Converting callback-to-tuple returns

If a function already returns `[value, null] | [null, Err]`, lift it into `Outcome`:

```typescript
const [user, err] = findUser(id);
const outcome = Outcome.fromTuple([user, err]);
```

### Gradual migration

You don't need to convert everything at once. `Err.from()` accepts native `Error`:

```typescript
try {
  legacyOperation();
} catch (e) {
  const err = Err.from(e as Error).withCode("LEGACY_ERROR");
  // Now you have a proper Err to work with
}
```

## Gotchas

- **`Outcome.from()` catches all throws** — including programming errors like `TypeError`. If you want to only catch expected errors, use explicit try/catch inside the callback.
- **Callbacks must return tuples or Err** — returning a plain value (not wrapped in a tuple) is a type error.
- **`null` return means void success** — `return null` inside `Outcome.from()` creates `Outcome.unit()`.
- **Error codes are not inherited** — wrapping an Err does not copy the code. Use `err.hasCode()` to search the cause chain.

## See also

- [outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) — section 7 "Migration from throwing"
- [err.examples.test.ts](../../src/types/err.examples.test.ts) — section 3 "Catching native errors"
