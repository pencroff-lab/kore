# Outcome\<T\>

Monadic container for handling success and error states using tuple-first API design.

`Outcome<T>` provides a type-safe way to handle operations that can fail, using tuples as the primary interface. All instances are immutable.

## Core Patterns

- **Construction**: Use static methods `ok()`, `err()`, `from()`, `fromAsync()`
- **Inspection**: Use `isOk`, `isErr`, `value`, `error` properties
- **Transformation**: Use `map()`, `mapErr()` for chained operations
- **Pipeline**: Use `pipe()`, `pipeAsync()` for sequential transformations with access to both value and error
- **Combinators**: Use `all()`, `any()` for combining multiple Outcomes
- **Side Effects**: Use `effect()`, `effectAsync()` for logging/metrics
- **Extraction**: Use `toTuple()`, `defaultTo()`, `either()` for final value extraction

## Types

### `NullErr`

```typescript
type NullErr = null | Err;
```

Direct return types for errors or void success:
- `null` -- void success (function completed, no value to return)
- `Err` -- error (shorthand for `[null, Err]`)

```typescript
function saveConfig(config: Config): NullErr {
  if (!config.valid) return Err.from("Invalid config");
  fs.writeFileSync("config.json", JSON.stringify(config));
  return null; // void success
}
```

### `ResultTuple<T>`

```typescript
type ResultTuple<T> = [T, null] | [null, Err];
```

Tuple-based result with positional semantics:
- `[T, null]` -- success with value
- `[null, Err]` -- error

```typescript
function divide(a: number, b: number): ResultTuple<number> {
  if (b === 0) return [null, Err.from("Division by zero")];
  return [a / b, null];
}

const [result, err] = divide(10, 2);
if (err) console.error(err.message);
else console.log(result); // 5
```

### `CallbackReturn<T>`

```typescript
type CallbackReturn<T> = ResultTuple<T> | NullErr;
```

Combined callback return type for `Outcome.from()` and `Outcome.fromAsync()`. Supports all patterns:
- `[T, null]` -- success with value (tuple)
- `[null, Err]` -- error (tuple)
- `null` -- void success
- `Err` -- error (shorthand)

Discrimination order: `Err.isErr()` -> `=== null` -> destructure tuple

```typescript
Outcome.from(() => {
  if (badInput) return Err.from("Bad input");     // Err shorthand
  if (noResult) return null;                       // void success
  if (hasError) return [null, Err.from("Error")]; // tuple error
  return [value, null];                            // tuple success
});
```

### `PipeFn<In, Out>`

```typescript
type PipeFn<In, Out> = (tuple: ResultTuple<In>) => CallbackReturn<Out>;
```

Synchronous pipe function type. Receives a `ResultTuple` and returns a `CallbackReturn`.

### `PipeFnAsync<In, Out>`

```typescript
type PipeFnAsync<In, Out> = (
  tuple: ResultTuple<In>,
) => Promise<CallbackReturn<Out>>;
```

Asynchronous pipe function type. Receives a `ResultTuple` and returns a `Promise` of `CallbackReturn`.

## Static Constructors

### `Outcome.ok()`

```typescript
static ok<T>(value: T): Outcome<T>
```

Create a success Outcome with the given value.

```typescript
const outcome = Outcome.ok(42);
console.log(outcome.isOk);  // true
console.log(outcome.value); // 42

const [val, err] = outcome.toTuple();
// val: 42, err: null
```

### `Outcome.err()`

Create an error Outcome. Multiple overloads are available:

#### From an existing Err

```typescript
static err(error: Err): Outcome<never>
```

```typescript
const err = Err.from("Something failed");
const outcome = Outcome.err(err);
```

#### From a message with optional code

```typescript
static err(message: string, code?: ErrCode): Outcome<never>
```

```typescript
const outcome = Outcome.err("Not found", "NOT_FOUND");
const [, err] = outcome.toTuple();
console.log(err?.code); // 'NOT_FOUND'
```

#### From a message with options

```typescript
static err(message: string, options: ErrOptions): Outcome<never>
```

```typescript
const outcome = Outcome.err("Timeout", {
  code: "TIMEOUT",
  metadata: { durationMs: 5000 },
});
```

#### By wrapping another error

```typescript
static err(
  message: string,
  error: Err | Error,
  options?: ErrOptions
): Outcome<never>
```

```typescript
try {
  JSON.parse(invalid);
} catch (e) {
  return Outcome.err("Parse failed", e as Error, { code: "PARSE_ERROR" });
}
```

### `Outcome.unit()`

```typescript
static unit(): Outcome<null>
```

Create a success Outcome with null value (void success). Use for operations that succeed but have no meaningful return value.

Returns `Outcome<null>` (not `Outcome<undefined>` or `Outcome<void>`). This is intentional for consistency with the tuple pattern where `null` indicates absence of error in `[value, null]`.

```typescript
function logMessage(msg: string): Outcome<null> {
  console.log(msg);
  return Outcome.unit();
}

const outcome = logMessage("Hello");
console.log(outcome.isOk); // true
console.log(outcome.value); // null
```

### `Outcome.from()`

```typescript
static from<T>(fn: () => CallbackReturn<T>): Outcome<T>
```

Create an Outcome from a synchronous callback. The callback can return any `CallbackReturn<T>` pattern. If the callback throws, the exception is caught and wrapped in an error Outcome.

```typescript
// Success with value
const outcome = Outcome.from(() => {
  return [42, null];
});
console.log(outcome.value); // 42

// Error shorthand
const outcome = Outcome.from(() => {
  if (invalid) return Err.from("Invalid input");
  return [result, null];
});

// Catching throws from external libraries
const outcome = Outcome.from(() => {
  const data = JSON.parse(untrustedInput); // may throw
  return [data, null];
});
// If JSON.parse throws, outcome.isErr === true
```

### `Outcome.fromAsync()`

```typescript
static async fromAsync<T>(
  fn: () => Promise<CallbackReturn<T>>
): Promise<Outcome<T>>
```

Async version of `from()` with identical semantics.

```typescript
// Async operation
const outcome = await Outcome.fromAsync(async () => {
  const response = await fetch("/api/data");
  if (!response.ok) {
    return Err.from("Request failed", { code: "HTTP_ERROR" });
  }
  const data = await response.json();
  return [data, null];
});

// With error aggregation
const outcome = await Outcome.fromAsync(async () => {
  let errors = Err.aggregate("Batch failed");

  const [a, errA] = await taskA().toTuple();
  if (errA) errors = errors.add(errA);

  const [b, errB] = await taskB().toTuple();
  if (errB) errors = errors.add(errB);

  if (errors.count > 0) return errors;
  return [{ a, b }, null];
});
```

### `Outcome.fromTuple()`

```typescript
static fromTuple<T>(tuple: ResultTuple<T>): Outcome<T>
```

Create an Outcome from an existing `ResultTuple`. Useful for deserializing Outcomes or converting from external tuple sources.

```typescript
const json = '["hello", null]';
const tuple = JSON.parse(json) as ResultTuple<string>;
const outcome = Outcome.fromTuple(tuple);
console.log(outcome.value); // 'hello'
```

### `Outcome.fromJSON()`

```typescript
static fromJSON<T>(
  payload: [T, null] | [null, ReturnType<Err["toJSON"]>]
): Outcome<T>
```

Create an Outcome from a JSON tuple produced by `toJSON()`. Accepts `[value, null]` for success or `[null, errJSON]` for errors. Errors are rehydrated with `Err.fromJSON()`.

```typescript
const json = JSON.stringify(outcome.toJSON());
const restored = Outcome.fromJSON(JSON.parse(json));
```

## Combinators

### `Outcome.all()`

```typescript
static all<T>(outcomes: Outcome<T>[]): Outcome<T[]>
```

Combines multiple Outcomes, succeeding if all succeed with an array of values. If any Outcome fails, returns an `Err` containing all failures aggregated via `Err.aggregate()`.

All outcomes are evaluated (non-short-circuiting) to collect all errors. For empty arrays, returns `Outcome.ok([])` (vacuous truth).

Time complexity: O(n) where n is the number of outcomes.

```typescript
// All succeed
const outcomes = [Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)];
const combined = Outcome.all(outcomes);
console.log(combined.value); // [1, 2, 3]

// One fails
const outcomes = [Outcome.ok(1), Outcome.err("Failed"), Outcome.ok(3)];
const combined = Outcome.all(outcomes);
console.log(combined.isErr); // true
console.log(combined.error?.message); // 'Failed'

// Many fail
const mixed = [
  Outcome.ok(1),
  Outcome.err("Error A"),
  Outcome.err("Error B"),
];
const failed = Outcome.all(mixed);
console.log(failed.isErr); // true
// Error contains both "Error A" and "Error B"

// Empty array
const combined = Outcome.all([]);
console.log(combined.value); // []
```

### `Outcome.any()`

```typescript
static any<T>(outcomes: Outcome<T>[]): Outcome<T>
```

Return the first successful Outcome from an array. Short-circuits on first success. Returns an aggregate error if ALL outcomes fail. For empty arrays, returns an error.

Time complexity: O(n) worst case; O(1) best case if first outcome is successful.

```typescript
// First success wins
const outcomes = [
  Outcome.err("First failed"),
  Outcome.ok(42),
  Outcome.ok(100),
];
const result = Outcome.any(outcomes);
console.log(result.value); // 42

// All fail
const outcomes = [Outcome.err("Error 1"), Outcome.err("Error 2")];
const result = Outcome.any(outcomes);
console.log(result.isErr); // true
console.log(result.error?.isAggregate); // true

// Empty array
const result = Outcome.any([]);
console.log(result.isErr); // true
console.log(result.error?.message); // 'No outcomes provided'
```

## Instance Accessors

### `isOk`

```typescript
readonly isOk: boolean
```

`true` for success outcomes, `false` for error outcomes.

### `isErr`

```typescript
get isErr(): boolean
```

Whether this Outcome is in error state.

```typescript
const success = Outcome.ok(42);
const failure = Outcome.err("Failed");

console.log(success.isErr); // false
console.log(failure.isErr); // true
```

### `value`

```typescript
get value(): T | null
```

The success value, or `null` if in error state.

```typescript
const success = Outcome.ok(42);
const failure = Outcome.err("Failed");

console.log(success.value); // 42
console.log(failure.value); // null
```

### `error`

```typescript
get error(): Err | null
```

The error, or `null` if in success state.

```typescript
const success = Outcome.ok(42);
const failure = Outcome.err("Failed");

console.log(success.error); // null
console.log(failure.error?.message); // 'Failed'
```

## Transformation

### `map()`

```typescript
map<U>(fn: (value: T) => CallbackReturn<U>): Outcome<U>
```

Transform the success value using a callback. Only called if this Outcome is successful. Errors pass through unchanged. If the callback throws, the exception is caught and wrapped.

```typescript
// Simple transformation
const outcome = Outcome.ok(5)
  .map((n) => [n * 2, null])
  .map((n) => [n.toString(), null]);

console.log(outcome.value); // '10'

// Transformation that can fail
const outcome = Outcome.ok('{"name":"John"}').map((json) => {
  try {
    return [JSON.parse(json), null];
  } catch {
    return Err.from("Invalid JSON");
  }
});

// Error passes through
const outcome = Outcome.err("Original error").map((v) => [v * 2, null]); // Never called

console.log(outcome.error?.message); // 'Original error'
```

### `mapAsync()`

```typescript
async mapAsync<U>(
  fn: (value: T) => Promise<CallbackReturn<U>>
): Promise<Outcome<U>>
```

Async version of `map()`.

```typescript
const outcome = await Outcome.ok(userId).mapAsync(async (id) => {
  const user = await fetchUser(id);
  return [user, null];
});
```

### `mapErr()`

```typescript
mapErr<U>(fn: (error: Err) => CallbackReturn<U>): Outcome<T | U>
```

Transform or recover from an error. Only called if this Outcome is in error state. Success passes through unchanged.

The callback can:
- **Recover**: return `[value, null]` to convert error to success
- **Transform**: return `Err` or `[null, Err]` to change the error

```typescript
// Recovery
const outcome = Outcome.err("Not found").mapErr((err) => {
  if (err.hasCode("NOT_FOUND")) {
    return [defaultValue, null]; // recover with default
  }
  return err; // pass through other errors
});

// Error transformation
const outcome = Outcome.err("Low-level error").mapErr((err) =>
  err.wrap("High-level context"),
);

// Logging and pass-through
const outcome = Outcome.err("Something failed").mapErr((err) => {
  console.error("Error occurred:", err.message);
  return err; // pass through unchanged
});
```

### `mapErrAsync()`

```typescript
async mapErrAsync<U>(
  fn: (error: Err) => Promise<CallbackReturn<U>>
): Promise<Outcome<T | U>>
```

Async version of `mapErr()`.

```typescript
const outcome = await Outcome.err("Primary failed").mapErrAsync(
  async (err) => {
    const fallback = await fetchFromBackup();
    if (fallback) return [fallback, null];
    return err.wrap("Backup also failed");
  },
);
```

## Side Effects

### `effect()`

```typescript
effect(fn: (tuple: ResultTuple<T>) => void): Outcome<T>
```

Execute a side effect with access to the full tuple. The callback receives the tuple `[value, error]` regardless of state. Returns `this` unchanged for chaining. If the callback throws, the Outcome becomes an error.

```typescript
// Logging
const outcome = Outcome.ok(42)
  .effect(([val, err]) => {
    if (err) console.error("Failed:", err.message);
    else console.log("Success:", val);
  })
  .map((v) => [v * 2, null]);

// Metrics
outcome.effect(([val, err]) => {
  metrics.record({
    success: !err,
    value: val,
    errorCode: err?.code,
  });
});
```

### `effectAsync()`

```typescript
async effectAsync(
  fn: (tuple: ResultTuple<T>) => Promise<void>
): Promise<Outcome<T>>
```

Async version of `effect()`.

```typescript
const outcome = await Outcome.ok(data).effectAsync(async ([val, err]) => {
  await logger.log({ value: val, error: err?.toJSON() });
});
```

## Terminal Operations

### `defaultTo()`

Extract the success value, or use a fallback value on error. This is a terminal operation that exits the Outcome chain.

#### Static fallback

```typescript
defaultTo(fallback: T): T
```

```typescript
const count = parseNumber(input).defaultTo(0);
// Returns parsed number or 0 on error

const config = loadConfig().defaultTo({ port: 3000, host: "localhost" });
```

#### Computed fallback from error

```typescript
defaultTo(handler: (error: Err) => T): T
```

The handler receives the `Err` and can use it to compute the fallback.

```typescript
const name = fetchUser(id).defaultTo((err) =>
  err.hasCode("NOT_FOUND") ? "Guest" : "Unknown",
);

const data = loadData().defaultTo((err) => {
  console.error("Load failed:", err.message);
  return cachedData;
});
```

#### Function as value (asValue overload)

```typescript
defaultTo(fallback: T, asValue: true): T
```

When `T` is a function type, use `asValue: true` to force treating the fallback as a static value rather than an error handler.

```typescript
const defaultHandler = () => console.log("default");
const handler = getHandler().defaultTo(defaultHandler, true);
```

### `either()`

```typescript
either<U>(onOk: (value: T) => U, onErr: (error: Err) => U): U
```

Transform the Outcome into a final value by handling both cases. This is a terminal operation. Each handler receives only its relevant type with full type safety.

```typescript
// Basic transformation
const message = fetchUser(id).either(
  (user) => `Welcome, ${user.name}!`,
  (err) => `Error: ${err.message}`,
);
// message is string, not Outcome<string>

// HTTP response building
const response = processOrder(orderId).either(
  (order) => ({ status: 200, body: { id: order.id, total: order.total } }),
  (err) => ({
    status: err.hasCode("NOT_FOUND") ? 404 : 500,
    body: { error: err.message },
  }),
);

// Default value on error
const count = parseNumber(input).either(
  (n) => n,
  () => 0,
);

// Type transformation
const status: "success" | "error" = outcomeEntity.either(
  () => "success",
  () => "error",
);
```

## Transformation Pipeline

### `pipe()`

```typescript
pipe<A>(f1: PipeFn<T, A>): Outcome<A>
pipe<A, B>(f1: PipeFn<T, A>, f2: PipeFn<A, B>): Outcome<B>
// ... up to 10 functions
```

Chain synchronous transformations using tuple-based predicates. Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`. This allows handling both success and error cases at each step, enabling mid-chain recovery or conditional transformations.

```typescript
// Basic pipeline
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  },
);

// Mid-chain recovery
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from("Invalid", "VALIDATION");
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode("VALIDATION")) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  },
);
```

### `pipeAsync()`

```typescript
pipeAsync<A>(f1: PipeFnAsync<T, A>): Promise<Outcome<A>>
pipeAsync<A, B>(
  f1: PipeFnAsync<T, A>,
  f2: PipeFnAsync<A, B>
): Promise<Outcome<B>>
// ... up to 10 functions
```

Chain asynchronous transformations using tuple-based predicates. Predicates are executed sequentially, each awaiting the previous result.

```typescript
// Async pipeline
const result = await Outcome.ok(userId).pipeAsync(
  async ([val, err]) => {
    if (err) return err;
    const user = await fetchUser(val);
    return [user, null];
  },
  async ([user, err]) => {
    if (err) return err;
    const profile = await fetchProfile(user.profileId);
    return [{ ...user, profile }, null];
  },
);

// Async recovery
const result = await Outcome.ok(id).pipeAsync(
  async ([val, err]) => {
    if (err) return err;
    return await fetchFromPrimary(val);
  },
  async ([val, err]) => {
    // Fallback to secondary on error
    if (err) {
      return await fetchFromSecondary(id);
    }
    return [val, null];
  },
);
```

## Conversion

### `toTuple()`

```typescript
toTuple(): ResultTuple<T>
```

Extract the internal tuple. Primary method for extracting values from an Outcome. Use destructuring for ergonomic access.

```typescript
const outcome = Outcome.ok(42);
const [value, error] = outcome.toTuple();

if (error) {
  console.error("Failed:", error.message);
  return;
}
console.log("Value:", value); // 42
```

### `toJSON()`

```typescript
toJSON(): [T, null] | [null, ReturnType<Err["toJSON"]>]
```

Convert to JSON-serializable tuple. For success: returns `[value, null]`. For error: returns `[null, errJSON]` where `errJSON` is from `Err.toJSON()`.

```typescript
const outcome = Outcome.ok({ name: "John" });
const json = JSON.stringify(outcome.toJSON());
// '[{"name":"John"},null]'

// Deserialize
const restored = Outcome.fromJSON(JSON.parse(json));
```

### `toString()`

```typescript
toString(): string
```

Convert to a human-readable string.

```typescript
console.log(Outcome.ok(42).toString());
// 'Outcome.ok(42)'

console.log(Outcome.err("Failed").toString());
// 'Outcome.err([ERROR] Failed)'
```

## Migration Example

```typescript
// Before (throwing):
function getUser(id: string): User {
  const user = db.find(id);
  if (!user) throw new Error("Not found");
  return user;
}
try {
  const user = getUser("123");
  console.log(user.name);
} catch (e) {
  console.error(e.message);
}

// After (Outcome):
function getUser(id: string): Outcome<User> {
  return Outcome.from(() => {
    const user = db.find(id);
    if (!user) return Err.from("Not found", "NOT_FOUND");
    return [user, null];
  });
}
const [user, err] = getUser("123").toTuple();
if (err) {
  console.error(err.message);
  return;
}
console.log(user.name);
```
