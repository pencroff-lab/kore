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

`ok()` has three forms. An explicit argument is carried verbatim; no argument means
"no value", which is `undefined`:

```typescript
Outcome.ok(42);     // Outcome<number>, value 42
Outcome.ok();       // Outcome<void>,   value undefined
Outcome.ok(null);   // Outcome<null>,   value null
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

For operations that succeed but return no value, call `ok()` with no argument:

```typescript
const outcome = Outcome.ok(); // Outcome<void>
outcome.isOk;   // true
outcome.value;   // undefined
```

If you need a real `null` in the value slot — for example round-tripping through
JSON — pass it explicitly:

```typescript
const outcome = Outcome.ok(null); // Outcome<null>, value null
```

> **Deprecated:** `Outcome.unit()` is deprecated since v0.6.0 and removed in v0.7.0.
> Its replacement is `Outcome.ok(null)`, not `Outcome.ok()` — `unit()` carries `null`,
> while `ok()` carries `undefined`.

### State checking

```typescript
const success = Outcome.ok(42);
success.isOk;  // true
success.isErr; // false

const failure = Outcome.err("Failed");
failure.isOk;  // false
failure.isErr; // true
```

> **Deprecated:** `isOk` and `isErr` are deprecated as accessors since v0.6.0. In
> v0.7.0 they become **methods** — `isOk()` / `isErr()` — that act as type guards.
> Codemod when upgrading: `.isOk` → `.isOk()` (regex `\.isOk\b(?!\()`), same for
> `.isErr`.

Neither accessor narrows the type, and neither can. A type predicate is only legal in
return-type position on a function or method (TS1228), so a getter or boolean property
is incapable of narrowing no matter how it is declared:

```typescript
declare const o: Outcome<number>;
if (o.isOk) {
  o.value; // still number | null — not narrowed
}
```

Until v0.7.0, destructure to narrow. This works today and keeps working afterwards:

```typescript
const [val, err] = o.toTuple();
if (err !== null) return err;
val; // number — narrowed
```

Once they are methods, the guard form narrows directly:

```typescript
if (o.isErr()) return o.error; //  o narrowed to the failure variant
o.value;                       //  number
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

Takes a plain `(value: T) => U`. Only called when in success state; errors pass through unchanged. Thrown exceptions are caught and wrapped:

```typescript
const outcome = Outcome.ok(5)
  .map((n) => n * 2)
  .map((n) => n.toString());
// outcome.value === "10"
```

`map` cannot fail on its own — whatever the callback returns becomes the success value. A returned tuple or `Err` is **data**, not control flow:

```typescript
Outcome.ok(5).map(() => Err.from("carried"));
// isOk === true, value is the Err instance
```

### `flatMap()` — chain a step that can fail

Takes `(value: T) => Outcome<U>` and flattens the result, so the callback decides success or failure:

```typescript
const outcome = Outcome.ok("not json").flatMap((s) =>
  Outcome.from(() => [JSON.parse(s), null]).mapErr((err) =>
    err.wrap("Invalid JSON"),
  ),
);
// outcome.isErr === true
```

An error returned by the callback short-circuits the rest of the chain:

```typescript
Outcome.ok(10)
  .flatMap((n) => (n > 5 ? Outcome.err("Too big", "RANGE") : Outcome.ok(n)))
  .map((n) => n * 2); // never runs
```

### `mapAsync()` / `flatMapAsync()` — async transformation

```typescript
const outcome = await Outcome.ok("user-123").mapAsync(async (id) => id.length);

const user = await Outcome.ok("user-123").flatMapAsync(async (id) => {
  const found = await fetchUser(id);
  return found ? Outcome.ok(found) : Outcome.err("Not found", "NOT_FOUND");
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

### When to use `map`, `flatMap` or `pipe`

| Use | When |
|-----|------|
| `map` / `mapAsync` | Transforming success only, with a step that cannot fail. Simple A → B. |
| `flatMap` / `flatMapAsync` | The step itself can fail and returns an `Outcome`. Errors short-circuit the rest of the chain. |
| `pipe` / `pipeAsync` | Need access to both value and error — mid-chain recovery, conditional branching on error codes. |

A step that can fail belongs in `flatMap`, not `map`: whatever `map` returns becomes the
success value, so returning an `Err` from `map` produces a *successful* `Outcome` carrying
that `Err` as data.

## Side effects

### `effect()` — observe without changing

Runs a callback with the full tuple, then returns the original `Outcome` unchanged. Useful for logging, metrics, or debugging:

```typescript
const outcome = Outcome.ok(42)
  .effect(([val, err]) => {
    if (err) logger.error(`Failed: ${err.message}`);
    else logger.info(`Success: ${val}`);
  })
  .map((v) => v * 2);
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
Outcome.ok(42).toString();        // "Outcome.ok(42)"
Outcome.ok().toString();          // "Outcome.ok(undefined)"
Outcome.ok(null).toString();      // "Outcome.ok(null)"
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
