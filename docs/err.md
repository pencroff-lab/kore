# Err

Immutable, value-based error type for TypeScript applications.

`Err` implements Go-style error handling where errors are passed as values rather than thrown as exceptions. It supports single error wrapping with context, error aggregation, hierarchical error codes, JSON serialization/deserialization, and conversion to native `Error`.

## Immutability Contract

All `Err` instances are immutable. Methods that appear to modify an error (`wrap`, `withCode`, `withMetadata`, `add`) return **new instances**. The original error is never mutated. This means:

- Safe to pass errors across boundaries without defensive copying
- Method chaining always produces new instances
- No "spooky action at a distance" bugs

## Types

### `ErrCode`

```typescript
type ErrCode = string;
```

Error code type -- typically uppercase snake_case identifiers.

```typescript
const codes: ErrCode[] = [
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "DB_CONNECTION_FAILED",
  "AUTH_EXPIRED",
];
```

### `ErrOptions`

```typescript
interface ErrOptions {
  code?: ErrCode;                    // Error code for programmatic handling
  message?: string;                  // Human-readable error message
  metadata?: Record<string, unknown>; // Additional contextual data
}
```

### `ErrJSONOptions`

Options for JSON serialization.

| Property   | Type      | Default | Description                                          |
|------------|-----------|---------|------------------------------------------------------|
| `stack`    | `boolean` | `true`  | Include stack trace. Set to `false` for public APIs. |
| `metadata` | `boolean` | `true`  | Include metadata. Set to `false` to omit sensitive data. |

### `ToStringOptions`

Options for `toString()` output formatting.

| Property   | Type                 | Default       | Description                                            |
|------------|----------------------|---------------|--------------------------------------------------------|
| `stack`    | `boolean \| number`  | `undefined`   | `true` for full stack, number for top N frames.       |
| `date`     | `boolean`            | `false`       | Include timestamp in ISO 8601 format.                 |
| `metadata` | `boolean`            | `false`       | Include metadata object in output.                    |
| `maxDepth` | `number`             | `undefined`   | Max depth for cause chain. Exceeded shows "... (N more causes)". |
| `indent`   | `string`             | `"  "`        | Indentation string for nested output.                 |

### `ErrJSON`

JSON representation of an `Err` for serialization.

```typescript
interface ErrJSON {
  message: string;
  kind?: "Err";
  isErr?: boolean;
  code?: ErrCode;
  metadata?: Record<string, unknown>;
  timestamp: string;
  stack?: string;
  cause?: ErrJSON;
  errors: ErrJSON[];
}
```

## Instance Properties

### `kind`

```typescript
readonly kind: "Err"
```

Discriminator property for type narrowing. Always `"Err"`.

### `isErr`

```typescript
readonly isErr: true
```

Discriminator property for type narrowing. Always `true`.

Useful when checking values from external sources (API responses, message queues) where `instanceof` may not work.

```typescript
// Checking unknown values from API
const data = await response.json();
if (data.error?.isErr) {
  // Likely an Err-like object
}

// For type narrowing, prefer Err.isErr()
if (Err.isErr(value)) {
  console.error(value.message);
}
```

### `message`

```typescript
readonly message: string
```

Human-readable error message.

### `code`

```typescript
readonly code?: ErrCode
```

Error code for programmatic handling.

### `metadata`

```typescript
readonly metadata?: Record<string, unknown>
```

Additional contextual data attached to the error.

### `timestamp`

```typescript
readonly timestamp: string
```

Timestamp when the error was created (ISO 8601 string). Stored as string for easy serialization and comparison.

### `stack`

```typescript
get stack(): string | undefined
```

The captured stack trace.

- For errors created from native `Error`s, this is the original stack.
- For errors created via `Err.from(string)`, this is the stack at creation.
- For wrapped errors, use `.root.stack` to get the original location.

## Static Constructors

### `Err.from()`

Create an `Err` from various input types.

#### From string with optional code

```typescript
static from(message: string, code?: ErrCode): Err
```

```typescript
const err = Err.from("User not found", "NOT_FOUND");
```

#### From string with full options

```typescript
static from(message: string, options: ErrOptions): Err
```

```typescript
const err = Err.from("Connection timeout", {
  code: "TIMEOUT",
  metadata: { host: "api.example.com", timeoutMs: 5000 },
});
```

#### From native Error

```typescript
static from(error: Error, options?: ErrOptions): Err
```

Preserves the original error's:
- Stack trace (as primary stack for debugging)
- Cause chain (if `error.cause` is `Error` or `string`)
- Name (in metadata as `originalName`)

```typescript
try {
  JSON.parse(invalidJson);
} catch (e) {
  return Err.from(e as Error, { code: "PARSE_ERROR" });
}
```

#### From another Err (clone with overrides)

```typescript
static from(error: Err, options?: ErrOptions): Err
```

```typescript
const original = Err.from("Original error");
const modified = Err.from(original, { code: "NEW_CODE" });
```

#### From unknown value (safe for catch blocks)

```typescript
static from(error: unknown, options?: ErrOptions): Err
```

Handles any value that might be thrown, including non-Error objects, strings, numbers, `null`, and `undefined`.

```typescript
try {
  await riskyAsyncOperation();
} catch (e) {
  // Safe - handles any thrown value
  return Err.from(e).wrap("Operation failed");
}
```

### `Err.wrap()`

```typescript
static wrap(
  message: string,
  error: Err | Error | string,
  options?: ErrOptions
): Err
```

Static convenience method to wrap an error with a context message. Creates a new `Err` with the provided message, having the original error as its cause. Recommended pattern for catch blocks.

```typescript
// Basic usage in catch block
try {
  await db.query(sql);
} catch (e) {
  return Err.wrap("Database query failed", e as Error);
}

// With code and metadata
try {
  const user = await fetchUser(id);
} catch (e) {
  return Err.wrap("Failed to fetch user", e as Error, {
    code: "USER_FETCH_ERROR",
    metadata: { userId: id },
  });
}
```

### `Err.aggregate()`

```typescript
static aggregate(
  message: string,
  errors?: Array<Err | Error | string>,
  options?: ErrOptions
): Err
```

Create an aggregate error for collecting multiple errors. Useful for validation, batch operations, or any scenario where multiple errors should be collected and reported together. Defaults to code `"AGGREGATE"`.

```typescript
// Validation
function validate(data: Input): [Valid, null] | [null, Err] {
  let errors = Err.aggregate("Validation failed");

  if (!data.email) errors = errors.add("Email is required");
  if (!data.name) errors = errors.add("Name is required");

  if (errors.count > 0) {
    return [null, errors.withCode("VALIDATION_ERROR")];
  }
  return [data as Valid, null];
}

// Batch operations
async function processAll(items: Item[]): [null, Err] | [void, null] {
  let errors = Err.aggregate("Batch processing failed");

  for (const item of items) {
    const [, err] = await processItem(item);
    if (err) {
      errors = errors.add(err.withMetadata({ itemId: item.id }));
    }
  }

  if (errors.count > 0) return [null, errors];
  return [undefined, null];
}
```

### `Err.fromJSON()`

```typescript
static fromJSON(json: unknown): Err
```

Deserialize an `Err` from JSON representation. Reconstructs an `Err` instance from its JSON form, including cause chains and aggregated errors. Validates the input structure.

Throws `Error` if json is invalid or missing required fields.

```typescript
// API response handling
const response = await fetch("/api/users/123");
if (!response.ok) {
  const body = await response.json();
  if (body.error) {
    const err = Err.fromJSON(body.error);
    if (err.hasCode("NOT_FOUND")) {
      return showNotFound();
    }
    return showError(err);
  }
}

// Message queue processing
queue.on("error", (message) => {
  const err = Err.fromJSON(message.payload);
  logger.error("Task failed", { error: err.toJSON() });
});
```

### `Err.isErr()`

```typescript
static isErr(value: unknown): value is Err
```

Type guard to check if a value is an `Err` instance. Useful for checking values from external sources where `instanceof` may not work (different realms, serialization).

Checks for: `instanceof Err`, or presence of `isErr === true` or `kind === "Err"` properties.

```typescript
function handleApiResponse(data: unknown): void {
  if (Err.isErr(data)) {
    console.error("Received error:", data.message);
    return;
  }
  // Process data...
}
```

## Wrapping & Context

### `wrap()`

```typescript
wrap(context: string | ErrOptions): Err
```

Wrap this error with additional context. Creates a new error that has this error as its cause. The original error is preserved and accessible via `unwrap()` or `chain()`.

**Stack trace behavior:** The new wrapper captures a fresh stack trace pointing to where `wrap()` was called. The original error's stack is preserved and accessible via `err.unwrap()?.stack` or `err.root.stack`.

```typescript
// Simple wrapping
const dbErr = queryDatabase();
if (Err.isErr(dbErr)) {
  return dbErr.wrap("Failed to fetch user");
}

// Wrapping with full options
return originalErr.wrap({
  message: "Service unavailable",
  code: "SERVICE_ERROR",
  metadata: { service: "user-service", retryAfter: 30 },
});

// Accessing original stack
const wrapped = original.wrap("Context 1").wrap("Context 2");
console.log(wrapped.stack);       // Points to second wrap() call
console.log(wrapped.root.stack);  // Points to original error location
```

### `withCode()`

```typescript
withCode(code: ErrCode): Err
```

Create a new `Err` with a different or added error code. Preserves the original stack trace and timestamp.

```typescript
const err = Err.from("Record not found").withCode("NOT_FOUND");

if (err.code === "NOT_FOUND") {
  return res.status(404).json(err.toJSON());
}
```

### `withMetadata()`

```typescript
withMetadata(metadata: Record<string, unknown>): Err
```

Create a new `Err` with additional metadata. New metadata is merged with existing metadata. Preserves the original stack trace and timestamp.

```typescript
const err = Err.from("Request failed")
  .withMetadata({ url: "/api/users" })
  .withMetadata({ statusCode: 500, retryable: true });

console.log(err.metadata);
// { url: '/api/users', statusCode: 500, retryable: true }
```

## Aggregate Operations

### `add()`

```typescript
add(error: Err | Error | string): Err
```

Add an error to this aggregate. Returns a new `Err` with the error added (immutable).

```typescript
let errors = Err.aggregate("Form validation failed");

if (!email) {
  errors = errors.add("Email is required");
}
if (!password) {
  errors = errors.add(
    Err.from("Password is required").withCode("MISSING_PASSWORD"),
  );
}
```

### `addAll()`

```typescript
addAll(errors: Array<Err | Error | string>): Err
```

Add multiple errors to this aggregate at once. Returns a new `Err` with all errors added (immutable).

```typescript
const validationErrors = [
  "Name too short",
  Err.from("Invalid email format").withCode("INVALID_EMAIL"),
  new Error("Age must be positive"),
];

const aggregate = Err.aggregate("Validation failed").addAll(validationErrors);
```

## Inspection

### `isAggregate`

```typescript
get isAggregate(): boolean
```

Whether this error is an aggregate containing multiple errors.

```typescript
const single = Err.from("Single error");
const multi = Err.aggregate("Multiple").add("One").add("Two");

console.log(single.isAggregate); // false
console.log(multi.isAggregate);  // true
```

### `count`

```typescript
get count(): number
```

Total count of errors (including nested aggregates). For single errors, returns `1`. For aggregates, recursively counts all child errors.

```typescript
const single = Err.from("One error");
console.log(single.count); // 1

const nested = Err.aggregate("Parent")
  .add("Error 1")
  .add(Err.aggregate("Child").add("Error 2").add("Error 3"));

console.log(nested.count); // 3
```

### `errors`

```typescript
get errors(): ReadonlyArray<Err>
```

Direct child errors (for aggregates). Returns an empty array for non-aggregate errors.

```typescript
const aggregate = Err.aggregate("Batch failed")
  .add("Task 1 failed")
  .add("Task 2 failed");

for (const err of aggregate.errors) {
  console.log(err.message);
}
// "Task 1 failed"
// "Task 2 failed"
```

### `root`

```typescript
get root(): Err
```

The root/original error in a wrapped error chain. Follows the cause chain to find the deepest error. Returns `this` if there is no cause.

```typescript
const root = Err.from("Original error");
const wrapped = root.wrap("Added context").wrap("More context");

console.log(wrapped.message);      // "More context"
console.log(wrapped.root.message); // "Original error"
console.log(wrapped.root.stack);   // Stack pointing to original error
```

### `unwrap()`

```typescript
unwrap(): Err | undefined
```

Get the directly wrapped error (one level up). Returns `undefined` if this error has no cause.

```typescript
const inner = Err.from("DB connection failed");
const outer = inner.wrap("Could not save user");

const unwrapped = outer.unwrap();
console.log(unwrapped?.message); // "DB connection failed"
console.log(inner.unwrap());     // undefined
```

### `chain()`

```typescript
chain(): Err[]
```

Get the full chain of wrapped errors from root to current. The first element is the root/original error, the last is `this`.

Time complexity: O(n) where n is the depth of the cause chain.

```typescript
const chain = Err.from("Network timeout")
  .wrap("API request failed")
  .wrap("Could not refresh token")
  .wrap("Authentication failed")
  .chain();

console.log(chain.map((e) => e.message));
// [
//   "Network timeout",
//   "API request failed",
//   "Could not refresh token",
//   "Authentication failed",
// ]
```

### `flatten()`

```typescript
flatten(): Err[]
```

Flatten all errors into a single array. For aggregates, recursively collects all leaf errors. For single errors, returns an array containing just this error.

Time complexity: O(n) where n is the total number of errors in all nested aggregates.

```typescript
const nested = Err.aggregate("All errors")
  .add("Error A")
  .add(Err.aggregate("Group B").add("Error B1").add("Error B2"))
  .add("Error C");

const flat = nested.flatten();
console.log(flat.map((e) => e.message));
// ["Error A", "Error B1", "Error B2", "Error C"]
```

## Matching & Filtering

### `hasCode()`

```typescript
hasCode(code: ErrCode): boolean
```

Check if this error or any error in its chain/aggregate has a specific code. Searches the cause chain and all aggregated errors.

```typescript
const err = Err.from("DB error", "DB_ERROR")
  .wrap("Repository failed")
  .wrap("Service unavailable");

console.log(err.hasCode("DB_ERROR"));      // true
console.log(err.hasCode("NETWORK_ERROR")); // false
```

### `hasCodePrefix()`

```typescript
hasCodePrefix(prefix: string, boundary?: string): boolean
```

Check if this error or any error in its chain/aggregate has a code matching the given prefix with boundary awareness. Default boundary is `":"`.

This enables hierarchical error code patterns like `AUTH:TOKEN:EXPIRED`.

Matches if:
- Code equals prefix exactly (e.g., `"AUTH"` matches `"AUTH"`)
- Code starts with prefix + boundary (e.g., `"AUTH"` matches `"AUTH:EXPIRED"`)

Does **NOT** match partial strings (e.g., `"AUTH"` does **NOT** match `"AUTHORIZATION"`).

```typescript
const err = Err.from("Token expired", { code: "AUTH:TOKEN:EXPIRED" });

err.hasCodePrefix("AUTH");           // true (matches AUTH:*)
err.hasCodePrefix("AUTH:TOKEN");     // true (matches AUTH:TOKEN:*)
err.hasCodePrefix("AUTHORIZATION");  // false (no boundary match)

// Custom boundary
const err2 = Err.from("Not found", { code: "HTTP.404.NOT_FOUND" });
err2.hasCodePrefix("HTTP", ".");      // true
err2.hasCodePrefix("HTTP.404", ".");  // true
err2.hasCodePrefix("HTTP", ":");      // false (wrong boundary)

// Search in error tree
const err3 = Err.from("DB error", { code: "DB:CONNECTION" })
  .wrap("Service failed", { code: "SERVICE:UNAVAILABLE" });

err3.hasCodePrefix("DB");       // true (found in cause)
err3.hasCodePrefix("SERVICE");  // true (found in current)
```

### `find()`

```typescript
find(predicate: (e: Err) => boolean): Err | undefined
```

Find the first error matching a predicate. Searches this error, its cause chain, and all aggregated errors.

```typescript
const err = Err.aggregate("Multiple failures")
  .add(Err.from("Not found", "NOT_FOUND"))
  .add(Err.from("Timeout", "TIMEOUT"));

const timeout = err.find((e) => e.code === "TIMEOUT");
console.log(timeout?.message); // "Timeout"
```

### `filter()`

```typescript
filter(predicate: (e: Err) => boolean): Err[]
```

Find all errors matching a predicate. Searches this error, its cause chain, and all aggregated errors.

```typescript
const err = Err.aggregate("Validation failed")
  .add(Err.from("Name required", "REQUIRED"))
  .add(Err.from("Invalid email", "INVALID"))
  .add(Err.from("Age required", "REQUIRED"));

const required = err.filter((e) => e.code === "REQUIRED");
console.log(required.length); // 2
```

## Conversion

### `toJSON()`

```typescript
toJSON(options?: ErrJSONOptions): ErrJSON
```

Convert to a JSON-serializable object. Use options to control what's included (e.g., omit stack for public APIs).

```typescript
// Full serialization (default)
const err = Err.from("Not found", {
  code: "NOT_FOUND",
  metadata: { userId: "123" },
});

console.log(JSON.stringify(err.toJSON(), null, 2));
// {
//   "message": "Not found",
//   "code": "NOT_FOUND",
//   "metadata": { "userId": "123" },
//   "timestamp": "2024-01-15T10:30:00.000Z",
//   "stack": "Error: ...",
//   "errors": []
// }

// Public API response (no stack)
app.get("/user/:id", (req, res) => {
  const result = getUser(req.params.id);
  if (Err.isErr(result)) {
    const status = result.code === "NOT_FOUND" ? 404 : 500;
    return res.status(status).json({
      error: result.toJSON({ stack: false }),
    });
  }
  res.json(result);
});

// Minimal payload
err.toJSON({ stack: false, metadata: false });
// Only includes: message, code, timestamp, cause, errors
```

### `toString()`

```typescript
toString(options?: ToStringOptions): string
```

Convert to a formatted string for logging/display. Includes cause chain and aggregated errors with indentation.

```typescript
// Basic usage (no options)
const err = Err.from("DB error")
  .wrap("Repository failed")
  .wrap("Service unavailable");

console.log(err.toString());
// [ERROR] Service unavailable
//   Caused by: [ERROR] Repository failed
//     Caused by: [ERROR] DB error

// With options
const err2 = Err.from("Connection failed", {
  code: "DB:CONNECTION",
  metadata: { host: "localhost", port: 5432 },
});

console.log(err2.toString({ date: true, metadata: true, stack: 3 }));
// [2024-01-15T10:30:00.000Z] [DB:CONNECTION] Connection failed
//   metadata: {"host":"localhost","port":5432}
//   stack:
//     at Database.connect (src/db.ts:45)
//     at Repository.init (src/repo.ts:23)
//     at Service.start (src/service.ts:12)

// Aggregate
const err3 = Err.aggregate("Validation failed", [], { code: "VALIDATION" })
  .add("Name required")
  .add("Email invalid");

console.log(err3.toString());
// [VALIDATION] Validation failed
//   Errors (2):
//     - [ERROR] Name required
//     - [ERROR] Email invalid

// With maxDepth limit
const deep = Err.from("Root")
  .wrap("Level 1")
  .wrap("Level 2")
  .wrap("Level 3");

console.log(deep.toString({ maxDepth: 2 }));
// [ERROR] Level 3
//   Caused by: [ERROR] Level 2
//     ... (2 more causes)
```

### `toError()`

```typescript
toError(): Error
```

Convert to a native `Error` for interop with throw-based APIs.

Creates an `Error` with:
- `message`: This error's message
- `name`: This error's code (or `"Err"`)
- `stack`: This error's original stack trace
- `cause`: Converted cause chain (native `Error`)

Note: Metadata is not included on the native `Error`.

```typescript
const err = Err.from("Something failed", "MY_ERROR");

// If you need to throw for some API
throw err.toError();

// The thrown error will have:
// - error.message === "Something failed"
// - error.name === "MY_ERROR"
// - error.stack === (original stack trace)
// - error.cause === (if wrapped)
```

## Usage Patterns

### Tuple pattern

```typescript
function divide(a: number, b: number): [number, null] | [null, Err] {
  if (b === 0) {
    return [null, Err.from("Division by zero", "MATH_ERROR")];
  }
  return [a / b, null];
}

const [result, err] = divide(10, 0);
if (err) {
  console.error(err.toString());
  return;
}
console.log(result);
```

### Error wrapping with context

```typescript
function readConfig(path: string): [Config, null] | [null, Err] {
  const [content, readErr] = readFile(path);
  if (readErr) {
    return [null, readErr.wrap(`Failed to read config from ${path}`)];
  }

  const [parsed, parseErr] = parseJSON(content);
  if (parseErr) {
    return [
      null,
      parseErr
        .wrap("Invalid config format")
        .withCode("CONFIG_ERROR")
        .withMetadata({ path }),
    ];
  }

  return [parsed as Config, null];
}
```

### Catching native errors

```typescript
function parseData(raw: string): [Data, null] | [null, Err] {
  try {
    return [JSON.parse(raw), null];
  } catch (e) {
    return [null, Err.wrap("Failed to parse data", e as Error)];
  }
}
```

### Serialization for service-to-service communication

```typescript
// Backend: serialize error for API response
const err = Err.from("User not found", "NOT_FOUND");
res.status(404).json({ error: err.toJSON() });

// Frontend: deserialize error from API response
const response = await fetch("/api/user/123");
if (!response.ok) {
  const { error } = await response.json();
  const err = Err.fromJSON(error);
  console.log(err.code); // 'NOT_FOUND'
}

// Public API: omit stack traces
res.json({ error: err.toJSON({ stack: false }) });
```
