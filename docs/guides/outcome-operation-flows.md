# Outcome Operation Flows

How `Outcome<T>` composes operations in `@pencroff-lab/kore`. For error creation, wrapping, codes, metadata, and aggregation, see [error-handling-patterns.md](./error-handling-patterns.md).

## Creating outcomes

### Success

```typescript
const outcome = Outcome.ok(42);
outcome.isOk;   // true
outcome.value;   // 42
outcome.error;   // null
```

### Error

```typescript
// From a message
Outcome.err("Not found", "NOT_FOUND");

// From a message with options
Outcome.err("Timeout", { code: "TIMEOUT", metadata: { durationMs: 5000 } });

// From an existing Err
const err = Err.from("Something failed");
Outcome.err(err);

// Wrapping a native Error or Err with context
Outcome.err("Parse failed", new Error("bad json"), { code: "PARSE_ERROR" });
```

### Void success

For operations that succeed but return no value:

```typescript
const outcome = Outcome.unit(); // Outcome<null>
outcome.isOk;   // true
outcome.value;   // null
```

### State checking

```typescript
const success = Outcome.ok(42);
success.isOk;  // true
success.isErr; // false

const failure = Outcome.err("Failed");
failure.isOk;  // false
failure.isErr; // true
```

### Direct accessors

```typescript
Outcome.ok(42).value;            // 42
Outcome.ok(42).error;            // null
Outcome.err("Failed").value;     // null
Outcome.err("Failed").error;     // Err { message: "Failed" }
```

## Factory methods

### `Outcome.from()` — catch synchronous throws

Callbacks can return three shapes:
- `[T, null]` — success tuple
- `Err` — error shorthand
- `null` — void success

```typescript
const outcome = Outcome.from(() => {
  const data = JSON.parse(rawString); // throws on bad input → caught
  return [data, null] as [Data, null];
});
```

Return `Err` directly as a shorthand for `[null, Err]`:

```typescript
const outcome = Outcome.from(() => {
  if (!input) return Err.from("Invalid input");
  return [input, null] as [string, null];
});
```

### `Outcome.fromAsync()` — catch async throws

```typescript
const outcome = await Outcome.fromAsync(async () => {
  const response = await fetch("/api/data"); // throws → caught
  const data = await response.json();
  return [data, null] as [Data, null];
});
```

### `Outcome.fromTuple()` — from existing tuple

Bridge between tuple-returning functions and Outcome chains:

```typescript
const tuple: ResultTuple<string> = ["hello", null];
const outcome = Outcome.fromTuple(tuple);

// Round-trip
const restored = Outcome.fromTuple(Outcome.ok(42).toTuple());
```

## Transformations

### `map()` — transform success values

Only called when in success state. Errors pass through unchanged. Thrown exceptions are caught and wrapped:

```typescript
const outcome = Outcome.ok(5)
  .map((n) => [n * 2, null] as [number, null])
  .map((n) => [n.toString(), null] as [string, null]);
// outcome.value === "10"
```

A map callback can fail:

```typescript
const outcome = Outcome.ok("not json").map((s) => {
  try {
    return [JSON.parse(s), null] as [unknown, null];
  } catch {
    return Err.from("Invalid JSON");
  }
});
// outcome.isErr === true
```

### `mapAsync()` — async transformation

```typescript
const outcome = await Outcome.ok("user-123").mapAsync(async (id) => {
  const user = await fetchUser(id);
  return [user, null] as [User, null];
});
```

### `mapErr()` — transform or recover from errors

Only called when in error state. Success passes through unchanged.

**Recovery** — convert an error into a success:

```typescript
const outcome = Outcome.err("Not found", "NOT_FOUND").mapErr((err) => {
  if (err.hasCode("NOT_FOUND")) {
    return ["default-value", null] as [string, null];
  }
  return err; // re-emit unhandled errors
});
// outcome.isOk === true, outcome.value === "default-value"
```

**Error transformation** — add context without recovering:

```typescript
const outcome = Outcome.err("Low-level error").mapErr((err) =>
  err.wrap("High-level context"),
);
// outcome.isErr === true, outcome.error.message === "High-level context"
```

### `mapErrAsync()` — async error recovery

```typescript
const outcome = await Outcome.err("Primary failed").mapErrAsync(async (err) => {
  const backup = await tryBackupSource();
  if (backup) return [backup, null] as [Data, null];
  return err.wrap("Backup also failed");
});
```

## Pipelines

### `pipe()` — synchronous chain with full tuple access

Each step receives the full `ResultTuple<T>`, enabling mid-chain inspection and recovery. Use `pipe` when steps need to see both value and error:

```typescript
const result = Outcome.ok("hello").pipe(
  ([val, err]) => {
    if (err) return err;
    return [val.toUpperCase(), null] as [string, null];
  },
  ([val, err]) => {
    if (err) return err;
    return [`${val}!`, null] as [string, null];
  },
);
// result.value === "HELLO!"
```

### Mid-chain recovery in `pipe()`

Recover from errors partway through a pipeline:

```typescript
const result = Outcome.ok("input").pipe(
  ([_val, err]) => {
    if (err) return err;
    return Err.from("Invalid", "VALIDATION"); // step 1 fails
  },
  ([val, err]) => {
    if (err?.hasCode("VALIDATION")) {
      return ["recovered", null] as [string, null]; // step 2 recovers
    }
    if (err) return err;
    return [val, null] as [string, null];
  },
);
// result.isOk === true, result.value === "recovered"
```

### `pipeAsync()` — async pipeline

Steps execute sequentially, each awaiting the previous result:

```typescript
const result = await Outcome.ok("user-1").pipeAsync(
  async ([val, err]) => {
    if (err) return err;
    const user = await fetchUser(val);
    return [user, null] as [User, null];
  },
  async ([user, err]) => {
    if (err) return err;
    const profile = await enrichProfile(user);
    return [profile, null] as [Profile, null];
  },
);
```

### When to use `pipe` vs `map`

| Use `map` / `mapAsync` when | Use `pipe` / `pipeAsync` when |
|------------------------------|-------------------------------|
| Transforming success only | Need access to both value and error |
| Errors should pass through | Mid-chain recovery is needed |
| Simple A → B mapping | Conditional branching on error codes |

## Side effects

### `effect()` — observe without changing

Runs a callback with the full tuple, then returns the original `Outcome` unchanged. Useful for logging, metrics, or debugging:

```typescript
const outcome = Outcome.ok(42)
  .effect(([val, err]) => {
    if (err) logger.error(`Failed: ${err.message}`);
    else logger.info(`Success: ${val}`);
  })
  .map((v) => [v * 2, null] as [number, null]);
// logged "Success: 42", outcome.value === 84
```

If the callback throws, the `Outcome` becomes an error:

```typescript
const outcome = Outcome.ok(42).effect(() => {
  throw new Error("effect blew up");
});
// outcome.isErr === true
```

### `effectAsync()` — async side effects

```typescript
const outcome = await Outcome.ok(order).effectAsync(async ([val, err]) => {
  if (!err) await auditLog.record("order_created", val.id);
});
// outcome unchanged, audit log written
```

## Combinators

### `Outcome.all()` — succeed when all succeed

Non-short-circuiting: collects all errors via `Err.from()` + `add()`/`addAll()`:

```typescript
const results = Outcome.all([
  Outcome.ok(1),
  Outcome.ok(2),
  Outcome.ok(3),
]);
// results.value === [1, 2, 3]

const mixed = Outcome.all([
  Outcome.ok(1),
  Outcome.err("Error A"),
  Outcome.err("Error B"),
]);
// mixed.isErr === true
// mixed.error.isAggregate === true, mixed.error.errors.length === 2
```

Empty array returns `Outcome.ok([])`.

### `Outcome.any()` — succeed on first success

Short-circuits on first success. Returns aggregate error if all fail:

```typescript
const result = Outcome.any([
  Outcome.err("Primary failed"),
  Outcome.ok(42),            // short-circuits here
  Outcome.ok(100),           // not evaluated
]);
// result.value === 42

const allFailed = Outcome.any([
  Outcome.err("Error 1"),
  Outcome.err("Error 2"),
]);
// allFailed.isErr === true, allFailed.error.isAggregate === true
```

Empty array returns an error with code `EMPTY_INPUT`.

## Terminal operations

### `toTuple()` — extract the result tuple

Primary extraction method. Destructure as `[val, err]`:

```typescript
const [user, err] = getUserOutcome("123").toTuple();
if (err) {
  console.error(err.message);
  return;
}
console.log(user.name);
```

### `defaultTo()` — extract value with fallback

Static fallback value:

```typescript
const count = (Outcome.err("bad input") as Outcome<number>).defaultTo(0);
// count === 0
```

Computed fallback from error:

```typescript
const name = (Outcome.err("Not found", "NOT_FOUND") as Outcome<string>)
  .defaultTo((err) => err.hasCode("NOT_FOUND") ? "Guest" : "Unknown");
// name === "Guest"
```

When `T` is a function type, use `asValue: true` to prevent it from being treated as a handler:

```typescript
const defaultHandler = () => "default";
const handler = (Outcome.err("no handler") as Outcome<() => string>)
  .defaultTo(defaultHandler, true);
// handler === defaultHandler (the function itself, not its return value)
```

### `either()` — fold into a single type

Handle both success and error cases, producing one result type:

```typescript
const response = getOrder(id).either<HttpResponse>(
  (order) => ({ status: 200, body: order }),
  (err) => ({
    status: err.hasCode("NOT_FOUND") ? 404 : 500,
    body: { error: err.message },
  }),
);
```

## Serialization

### JSON round-trip

```typescript
// Serialize
const json = Outcome.ok({ name: "John" }).toJSON();
// [{ name: "John" }, null]

const errJson = Outcome.err("Failed", "CODE").toJSON();
// [null, { message: "Failed", code: "CODE", ... }]

// Deserialize
const restored = Outcome.fromJSON(JSON.parse(jsonString));
```

Invalid payloads return an error `Outcome` rather than throwing:

```typescript
const bad = Outcome.fromJSON({ not: "a tuple" });
// bad.isErr === true, bad.error.message === "Invalid Outcome JSON"
```

### String representation

```typescript
Outcome.ok(42).toString();       // "Outcome.ok(42)"
Outcome.err("Failed").toString(); // "Outcome.err([ERROR] Failed)"
```

## Real-world patterns

### API handler with validation

```typescript
function createOrder(input: OrderInput): Outcome<Order> {
  return Outcome.from(() => {
    let errors = Err.from("Validation failed");
    if (!input.items?.length) errors = errors.add("Items required");
    if (!input.address) errors = errors.add("Address required");

    if (errors.isAggregate) {
      return errors.withCode("VALIDATION_ERROR");
    }
    return [{ id: generateId(), ...input, status: "pending" }, null];
  });
}

const response = createOrder(body).either(
  (order) => ({ status: 201, body: order }),
  (err) => ({ status: 422, body: err.toJSON({ stack: false }) }),
);
```

### File processing pipeline

Imperative style with `Outcome.fromAsync`:

```typescript
async function processFile(path: string): Promise<Outcome<Report>> {
  return Outcome.fromAsync(async () => {
    const [content, readErr] = await readFile(path);
    if (readErr) return readErr.wrap("processFile: read failed");

    const [parsed, parseErr] = parse(content);
    if (parseErr) return parseErr.wrap("processFile: parse failed");

    const [report, genErr] = await generateReport(parsed);
    if (genErr) return genErr.wrap("processFile: report failed");

    return [report, null];
  });
}
```

Declarative style with `pipeAsync`:

```typescript
async function processFile(path: string): Promise<Outcome<Report>> {
  return Outcome.ok(path).pipeAsync(
    async ([p, err]) => {
      if (err) return err;
      return await readFile(p);
    },
    async ([content, err]) => {
      if (err) return err;
      return parse(content);
    },
    async ([parsed, err]) => {
      if (err) return err;
      return await generateReport(parsed);
    },
  );
}
```

### Parallel operations with error collection

```typescript
async function processAll(items: Item[]): Promise<Outcome<Result[]>> {
  const outcomes = await Promise.all(
    items.map((item) => processItem(item)),
  );
  return Outcome.all(outcomes);
  // All errors collected, not just the first
}
```

### Fallback chain

```typescript
const config = Outcome.any([
  loadFromEnv(),
  loadFromFile("./config.json"),
  loadFromDefaults(),
]);
// First source that succeeds wins
```

## See also

- [error-handling-patterns.md](./error-handling-patterns.md) — Err creation, wrapping, codes, metadata, aggregation
- [err.examples.test.ts](../../src/types/err.examples.test.ts) — Err usage examples
- [outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) — Outcome usage examples
