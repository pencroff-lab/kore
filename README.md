# @pencroff-lab/kore

TypeScript core utilities library providing value-based error handling types inspired by Go-style error handling. Published as a dual ESM/CJS package.

## Install

```bash
npm install @pencroff-lab/kore
# or
bun add @pencroff-lab/kore
```

Requires TypeScript 5.9+ as a peer dependency.

## Documentation

Detailed API documentation for each module:

- [Err](docs/err.md) -- Immutable, value-based error type with wrapping, aggregation, and serialization
- [Outcome\<T\>](docs/outcome.md) -- Monadic container for type-safe error handling with tuple-first API
- [dtStamp](docs/format_dt.md) -- Filesystem/log-safe date formatting utility

## API

### Err

Immutable, value-based error type. Supports wrapping (cause chains), aggregation (multiple errors), hierarchical error codes, JSON serialization, and conversion to native `Error`.

```typescript
import { Err } from "@pencroff-lab/kore";

// Create an error with a code
const err = Err.from("User not found", "NOT_FOUND");

// Wrap with context (returns a new instance)
const wrapped = err.wrap("Failed to load profile");

// Aggregate multiple errors
let errors = Err.aggregate("Validation failed");
errors = errors.add("Name is required");
errors = errors.add(Err.from("Invalid email", "INVALID_EMAIL"));

if (errors.count > 0) {
  console.log(errors.toString());
}
```

#### Creating errors

```typescript
// From string with code
Err.from("Timeout", "TIMEOUT");

// From string with options
Err.from("Connection failed", {
  code: "DB_ERROR",
  metadata: { host: "localhost" },
});

// From native Error (preserves stack and cause chain)
try {
  riskyOperation();
} catch (e) {
  Err.from(e as Error, { code: "OPERATION_FAILED" });
}

// Static wrap for catch blocks
try {
  await db.query(sql);
} catch (e) {
  Err.wrap("Database query failed", e as Error);
}
```

#### Error inspection

```typescript
const err = Err.from("DB error", "DB:CONNECTION:TIMEOUT")
  .wrap("Repository failed")
  .wrap("Service unavailable");

err.hasCode("DB:CONNECTION:TIMEOUT"); // true - exact match in chain
err.hasCodePrefix("DB"); // true - hierarchical prefix match
err.root.message; // "DB error" - original error
err.chain(); // array from root to current
err.find((e) => e.code === "DB:CONNECTION:TIMEOUT"); // find in tree
```

#### Serialization

```typescript
// Serialize for API responses
const json = err.toJSON({ stack: false }); // omit stack for public APIs

// Deserialize
const restored = Err.fromJSON(json);

// Convert to native Error
throw err.toError();
```

### Outcome\<T\>

Monadic container wrapping `ResultTuple<T>` (`[T, null] | [null, Err]`). Supports `map`/`mapErr`/`pipe`/`pipeAsync` chains, combinators (`all`, `any`), side effects (`effect`), and terminal operations (`toTuple`, `defaultTo`, `either`).

```typescript
import { Outcome, Err } from "@pencroff-lab/kore";

// Create from callback
const outcome = Outcome.from(() => {
  if (!isValid(input)) return Err.from("Invalid input", "VALIDATION");
  return [processedValue, null];
});

// Extract with tuple destructuring
const [value, err] = outcome.toTuple();
if (err) {
  console.error(err.message);
  return;
}
console.log(value);
```

#### Construction

```typescript
Outcome.ok(42); // success
Outcome.err("Failed", "ERROR_CODE"); // error
Outcome.unit(); // void success (null value)

// From sync callback (catches throws)
Outcome.from(() => {
  const data = JSON.parse(input); // may throw
  return [data, null];
});

// From async callback
await Outcome.fromAsync(async () => {
  const res = await fetch("/api/data");
  if (!res.ok) return Err.from("Request failed", "HTTP_ERROR");
  return [await res.json(), null];
});
```

#### Transformations

```typescript
const result = Outcome.ok(5)
  .map((n) => [n * 2, null]) // transform success
  .mapErr((err) => err.wrap("Added context")) // transform error
  .toTuple();

// Pipe for sequential transformations with access to both value and error
const piped = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  },
);
```

#### Combinators

```typescript
// All must succeed (collects all errors)
const all = Outcome.all([Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)]);
// all.value === [1, 2, 3]

// First success wins
const any = Outcome.any([
  Outcome.err("Failed"),
  Outcome.ok(42),
  Outcome.ok(100),
]);
// any.value === 42
```

#### Terminal operations

```typescript
// Default value on error
const count = parseNumber(input).defaultTo(0);

// Computed fallback
const name = fetchUser(id).defaultTo((err) =>
  err.hasCode("NOT_FOUND") ? "Guest" : "Unknown",
);

// Transform both cases
const response = processOrder(orderId).either(
  (order) => ({ status: 200, body: order }),
  (err) => ({ status: err.hasCode("NOT_FOUND") ? 404 : 500, body: { error: err.message } }),
);
```

### Utilities

#### dtStamp

Formats a `Date` into a compact timestamp string. Useful for filenames, logs, and identifiers.

```typescript
import { dtStamp } from "@pencroff-lab/kore";

dtStamp(); // "20260218_153045"
dtStamp(new Date(), { parts: "date" }); // "20260218"
dtStamp(new Date(), { parts: "time", ms: true }); // "153045_123"
dtStamp(new Date(), { compact: true }); // "20260218153045"
dtStamp(new Date(), { tz: "local" }); // uses local timezone
```

## Development

```bash
bun install                # install dependencies
bun test                   # run tests
bun run test:coverage      # run tests with coverage (>= 83%)
bun run lint               # lint + type check (auto-fix)
bun run build              # build ESM + CJS to dist/
```

## License

[Apache-2.0](LICENSE)
