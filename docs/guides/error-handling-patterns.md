# Error Handling Patterns

How `Err` works in practice within `@pencroff-lab/kore`. For operation flow patterns using `Outcome`, see [outcome-operation-flows.md](./outcome-operation-flows.md).

## When to use `Err` directly vs `Outcome`

| Scenario | Use |
|----------|-----|
| Returning `[value, null] \| [null, Err]` tuples from functions | `Err` directly |
| Chaining transformations, recovery, or combinators | `Outcome` |
| Validation collecting multiple errors | `Err.from()` + `add()`/`addAll()` |
| Wrapping third-party code that throws | `Outcome.from()` / `Outcome.fromAsync()` |

**Rule of thumb:** Use raw tuples at module boundaries (simple, no overhead). Use `Outcome` when you need to chain operations or combine results.

## Creating errors

### From a string message

```typescript
const err = Err.from("User not found", "NOT_FOUND");
```

With full options (code + metadata):

```typescript
const err = Err.from("Connection timeout", {
  code: "TIMEOUT",
  metadata: { host: "api.example.com", timeoutMs: 5000 },
});
```

### From a native Error

`Err.from()` preserves the original stack trace, cause chain, and `name`. Node.js system error `.code` (e.g., `ENOENT`, `EACCES`) is captured automatically:

```typescript
try {
  fs.readFileSync("/missing");
} catch (e) {
  const err = Err.from(e as Error);
  // err.code === "ENOENT" (captured from native Error .code)
  // err.metadata.originalName === "Error"
  // err.stack points to the original throw location
}
```

Override code or add metadata:

```typescript
const err = Err.from(nativeError, { code: "PARSE_ERROR" });
```

### From unknown values (safe in catch blocks)

```typescript
try {
  riskyThirdPartyCall();
} catch (e) {
  const err = Err.from(e); // handles Error, string, number, anything
  // Non-Error values: message = "Unknown error", code = "UNKNOWN",
  // metadata.originalValue = the thrown value
}
```

### Cloning with overrides

```typescript
const original = Err.from("Original error");
const modified = Err.from(original, { code: "NEW_CODE" });
// modified.message === "Original error", modified.code === "NEW_CODE"
// original is unchanged
```

## Type guard: `Err.isErr()`

Works across module boundaries via duck typing — checks for `instanceof Err`, `isErr === true`, or `kind === "Err"`:

```typescript
if (Err.isErr(value)) {
  // value is narrowed to Err
  console.log(value.message);
}
```

## Wrapping errors (cause chains)

### Instance method: `err.wrap()`

Adds context to an existing `Err`, making it the cause of a new wrapper:

```typescript
const dbErr = Err.from("Connection refused");
const repoErr = dbErr.wrap("Repository query failed");
const serviceErr = repoErr.wrap("User lookup failed");
// serviceErr.message === "User lookup failed"
// serviceErr.unwrap().message === "Repository query failed"
```

Wrap with options:

```typescript
const wrapped = dbErr.wrap("Service unavailable", {
  code: "SERVICE_ERROR",
  metadata: { service: "user-service" },
});
```

### Wrapping in catch blocks

Use `Err.from()` to normalize the caught value, then `wrap()` to add context:

```typescript
try {
  JSON.parse("{invalid");
} catch (e) {
  return [null, Err.from(e as Error).wrap("Failed to parse config", {
    code: "CONFIG_ERROR",
    metadata: { path: "/etc/app.json" },
  })];
}
```

### Navigating cause chains

```typescript
const err = Err.from("DB error")
  .wrap("Repository failed")
  .wrap("Service error");

err.unwrap()?.message;  // "Repository failed" (immediate cause)
err.root.message;       // "DB error" (deepest cause)

err.chain().map(e => e.message);
// ["DB error", "Repository failed", "Service error"] (root → current)
```

## Propagation through call stacks

Wrap errors at each layer to build a cause chain:

```typescript
// Repository layer
function findUser(id: string): [User, null] | [null, Err] {
  const [row, err] = db.query("SELECT ...", [id]);
  if (err) return [null, err.wrap("findUser failed")];
  return [row, null];
}

// Service layer
function getProfile(id: string): Outcome<Profile> {
  return Outcome.from(() => {
    const [user, err] = findUser(id);
    if (err) return err.wrap("getProfile failed").withCode("PROFILE_ERROR");
    return [{ ...user, displayName: user.name }, null];
  });
}

// Handler layer
function handleRequest(id: string): HttpResponse {
  return getProfile(id).either(
    (profile) => ({ status: 200, body: profile }),
    (err) => ({
      status: err.hasCode("NOT_FOUND") ? 404 : 500,
      body: { error: err.message },
    }),
  );
}
```

## Error codes

### Setting codes

```typescript
const err = Err.from("Record not found").withCode("NOT_FOUND");
```

`withCode` returns a new instance — the original is unchanged.

### Hierarchical codes

Use colon-separated segments for prefix matching:

```typescript
const err = Err.from("Token expired", { code: "AUTH:TOKEN:EXPIRED" });

err.hasCode("AUTH:TOKEN:EXPIRED"); // true (exact match)
err.hasCodePrefix("AUTH");         // true (prefix match)
err.hasCodePrefix("AUTH:TOKEN");   // true
err.hasCodePrefix("AUTHORIZATION"); // false (not a prefix boundary)
```

Custom boundary character:

```typescript
const err = Err.from("Not found", { code: "HTTP.404.NOT_FOUND" });
err.hasCodePrefix("HTTP", ".");     // true
err.hasCodePrefix("HTTP.404", "."); // true
```

### Searching the error tree

Both `hasCode` and `hasCodePrefix` search the entire error tree — cause chain and aggregated errors:

```typescript
const err = Err.from("DB error", { code: "DB:CONNECTION" })
  .wrap("Service failed", { code: "SERVICE:UNAVAILABLE" });

err.hasCodePrefix("DB");      // true (found in cause)
err.hasCodePrefix("SERVICE"); // true (found on wrapper)
```

## Metadata

### Attaching metadata

```typescript
const err = Err.from("Request failed")
  .withMetadata({ url: "/api/users" })
  .withMetadata({ statusCode: 500 }); // merges with existing
// err.metadata === { url: "/api/users", statusCode: 500 }
```

`withMetadata` returns a new instance — immutable.

### Querying metadata

```typescript
const err = Err.from("Test").withMetadata({
  url: "/api",
  status: null,
});

// hasMetadata checks value existence (non-null, non-undefined) by default
err.hasMetadata("url");                        // true
err.hasMetadata("status");                     // false (null)
err.hasMetadata("status", { keyCheck: true }); // true (key exists)

// getMetadata with typed retrieval and defaults
err.getMetadata<string>("url");           // "/api"
err.getMetadata("missing");              // undefined
err.getMetadata("missing", "fallback");  // "fallback"
```

### Removing metadata

```typescript
const err = Err.from("Test", {
  metadata: { url: "/api", token: "secret", retryable: true },
});

const safe = err.omitMetadata("token");
// safe.metadata === { url: "/api", retryable: true }

const minimal = err.omitMetadata(["url", "retryable"]);
// minimal.metadata === { token: "secret" }
```

When all keys are removed, `metadata` becomes `undefined`.

## Error aggregation

When collecting multiple errors, use the `"AGGREGATE"` code to signal that the error is a container:

### Collecting validation errors

```typescript
function validateUser(input: UserInput): [UserInput, null] | [null, Err] {
  let errors = Err.from("Validation failed", "AGGREGATE");

  if (!input.name?.trim()) errors = errors.add("Name is required");
  if (!input.email?.includes("@")) {
    errors = errors.add(Err.from("Invalid email", "INVALID_EMAIL"));
  }
  if (input.age !== undefined && input.age < 0) {
    errors = errors.add("Age cannot be negative");
  }

  if (errors.isAggregate) {
    return [null, errors.withCode("VALIDATION_ERROR")];
  }
  return [input, null];
}
```

### Batch adding

```typescript
const aggregate = Err.from("Validation failed", "AGGREGATE").addAll([
  "Name too short",
  Err.from("Invalid email format").withCode("INVALID_EMAIL"),
  new Error("Age must be positive"),
]);
```

### Inspecting aggregates

```typescript
const err = Err.from("All errors")
  .add("Error A")
  .add(Err.from("Group B").add("Error B1").add("Error B2"))
  .add("Error C");

err.isAggregate;      // true
err.errors;           // ReadonlyArray<Err> — direct children only
err.errors.length;    // 3

// flatten() recursively collects all leaf errors
err.flatten().length; // 4
err.flatten().map(e => e.message);
// ["Error A", "Error B1", "Error B2", "Error C"]
```

### Finding and filtering

```typescript
const err = Err.from("Validation failed")
  .add(Err.from("Name required", "REQUIRED"))
  .add(Err.from("Invalid email", "INVALID"))
  .add(Err.from("Age required", "REQUIRED"));

// find() — first match in tree
err.find(e => e.code === "INVALID")?.message; // "Invalid email"

// filter() — all matches in tree
err.filter(e => e.code === "REQUIRED").length; // 2
```

Both `find` and `filter` search the full error tree (current, cause chain, and aggregate children).

## Serialization

### JSON round-trip

```typescript
const err = Err.from("Not found", {
  code: "NOT_FOUND",
  metadata: { userId: "123" },
});

// Serialize
const json = err.toJSON();
// { message, code, metadata, timestamp, kind: "Err", isErr: true, stack, cause, errors }

// Deserialize
const restored = Err.fromJSON(json);
restored.hasCode("NOT_FOUND"); // true
```

Cause chains and aggregated errors are serialized/deserialized recursively.

### Controlling serialized fields

Strip sensitive data at API boundaries:

```typescript
err.toJSON({ stack: false });               // no stack traces
err.toJSON({ metadata: false });            // no metadata
err.toJSON({ stack: false, metadata: false }); // minimal payload
```

### Native Error conversion

Convert to native `Error` for interop with throw-based APIs:

```typescript
const err = Err.from("Something failed", "MY_ERROR");
const nativeErr = err.toError();
// nativeErr.name === "MY_ERROR"
// nativeErr.message === "Something failed"
// Cause chain is preserved as native Error.cause
```

## Formatting with `toString()`

```typescript
const err = Err.from("Connection failed", {
  code: "DB:CONNECTION",
  metadata: { host: "localhost", port: 5432 },
});

err.toString();
// "[DB:CONNECTION] Connection failed"

err.toString({ date: true, metadata: true });
// "[2024-01-15T10:30:00.000Z] [DB:CONNECTION] Connection failed"
// "  metadata: {"host":"localhost","port":5432}"
```

### Cause chain formatting

```typescript
const deep = Err.from("Root").wrap("Level 1").wrap("Level 2").wrap("Level 3");

deep.toString();
// [ERROR] Level 3
//   Caused by: [ERROR] Level 2
//     Caused by: [ERROR] Level 1
//       Caused by: [ERROR] Root

deep.toString({ maxDepth: 2 });
// [ERROR] Level 3
//   Caused by: [ERROR] Level 2
//     ... (1 more cause)
```

### Aggregate formatting

```typescript
Err.from("Validation failed", { code: "VALIDATION" })
  .add("Name required")
  .add("Email invalid")
  .toString();
// [VALIDATION] Validation failed
//   Errors (2):
//     - [ERROR] Name required
//     - [ERROR] Email invalid
```

### `toString()` options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stack` | `boolean \| number` | `undefined` | `true` = full stack, `number` = top N frames |
| `date` | `boolean` | `false` | Prefix with ISO 8601 timestamp |
| `metadata` | `boolean` | `false` | Show metadata object |
| `maxDepth` | `number` | `undefined` | Truncate cause chain after N levels |
| `indent` | `string` | `"  "` | Indentation per nesting level |

## See also

- [outcome-operation-flows.md](./outcome-operation-flows.md) — Outcome patterns for operation flows
- [err.examples.test.ts](../../src/types/err.examples.test.ts) — Err usage examples
- [outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) — Outcome usage examples
