[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / err

# err

Error-as-value implementation for TypeScript applications.

This module provides a Go-style error handling approach where errors are
passed as values rather than thrown as exceptions. The `Err` class supports
both single error wrapping with context and error aggregation.

## Immutability Contract

All `Err` instances are immutable. Methods that appear to modify an error
(like `wrap`, `withCode`, `withMetadata`, `add`) return new instances.
The original error is never mutated. This means:

- Safe to pass errors across boundaries without defensive copying
- Method chaining always produces new instances
- No "spooky action at a distance" bugs

## Examples

```typescript
import { Err } from './err';

function divide(a: number, b: number): [number, null] | [null, Err] {
  if (b === 0) {
    return [null, Err.from('Division by zero', 'MATH_ERROR')];
  }
  return [a / b, null];
}

const [result, err] = divide(10, 0);
if (err) {
  console.error(err.toString());
  return;
}
console.log(result); // result is number here
```

```typescript
function readConfig(path: string): [Config, null] | [null, Err] {
  const [content, readErr] = readFile(path);
  if (readErr) {
    return [null, readErr.wrap(`Failed to read config from ${path}`)];
  }

  const [parsed, parseErr] = parseJSON(content);
  if (parseErr) {
    return [null, parseErr
      .wrap('Invalid config format')
      .withCode('CONFIG_ERROR')
      .withMetadata({ path })];
  }

  return [parsed as Config, null];
}
```

```typescript
function parseData(raw: string): [Data, null] | [null, Err] {
  try {
    return [JSON.parse(raw), null];
  } catch (e) {
    return [null, Err.wrap('Failed to parse data', e as Error)];
  }
}
```

```typescript
function validateUser(input: UserInput): [User, null] | [null, Err] {
  let errors = Err.aggregate('Validation failed');

  if (!input.name?.trim()) {
    errors = errors.add('Name is required');
  }
  if (!input.email?.includes('@')) {
    errors = errors.add(Err.from('Invalid email', 'INVALID_EMAIL'));
  }
  if (input.age !== undefined && input.age < 0) {
    errors = errors.add('Age cannot be negative');
  }

  if (errors.count > 0) {
    return [null, errors.withCode('VALIDATION_ERROR')];
  }

  return [input as User, null];
}
```

```typescript
// Backend: serialize error for API response
const err = Err.from('User not found', 'NOT_FOUND');
res.status(404).json({ error: err.toJSON() });

// Frontend: deserialize error from API response
const response = await fetch('/api/user/123');
if (!response.ok) {
  const { error } = await response.json();
  const err = Err.fromJSON(error);
  console.log(err.code); // 'NOT_FOUND'
}

// Public API: omit stack traces
res.json({ error: err.toJSON({ stack: false }) });
```

## Classes

### Err

Defined in: [types/err.ts:262](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L262)

A value-based error type that supports wrapping and aggregation.

`Err` is designed to be returned from functions instead of throwing exceptions,
following the Go-style error handling pattern. It supports:

- **Single errors**: Created via `Err.from()` with optional code and metadata
- **Error wrapping**: Adding context to errors as they propagate up the call stack
- **Error aggregation**: Collecting multiple errors under a single parent (e.g., validation)
- **Serialization**: Convert to/from JSON for service-to-service communication

All instances are immutable - methods return new instances rather than mutating.

#### Examples

```typescript
// From string with code (most common)
const err1 = Err.from('User not found', 'NOT_FOUND');

// From string with full options
const err2 = Err.from('Connection timeout', {
  code: 'TIMEOUT',
  metadata: { host: 'api.example.com' }
});

// From native Error (preserves original stack and cause chain)
try {
  riskyOperation();
} catch (e) {
  const err = Err.from(e).withCode('OPERATION_FAILED');
  return [null, err];
}

// From unknown (safe for catch blocks)
const err3 = Err.from(unknownValue);
```

```typescript
try {
  await db.query(sql);
} catch (e) {
  return [null, Err.wrap('Database query failed', e as Error)];
}
```

```typescript
let errors = Err.aggregate('Multiple operations failed')
  .add(Err.from('Database write failed'))
  .add(Err.from('Cache invalidation failed'))
  .add('Notification send failed'); // strings are auto-wrapped

console.log(errors.count); // 3
console.log(errors.flatten()); // Array of all individual errors
```

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [types/err.ts:296](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L296)

Error code for programmatic handling

##### isErr

> `readonly` **isErr**: `true`

Defined in: [types/err.ts:290](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L290)

Discriminator property for type narrowing.
Always `true` for Err instances.

Useful when checking values from external sources (API responses,
message queues) where `instanceof` may not work.

###### Example

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

##### kind

> `readonly` **kind**: `"Err"` = `"Err"`

Defined in: [types/err.ts:267](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L267)

Discriminator property for type narrowing.
Always "Err" for Err instances.

##### message

> `readonly` **message**: `string`

Defined in: [types/err.ts:293](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L293)

Human-readable error message

##### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.ts:299](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L299)

Additional contextual data

##### timestamp

> `readonly` **timestamp**: `string`

Defined in: [types/err.ts:306](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L306)

Timestamp when the error was created (ISO 8601 string).

Stored as string for easy serialization and comparison.

#### Accessors

##### count

###### Get Signature

> **get** **count**(): `number`

Defined in: [types/err.ts:974](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L974)

Total count of errors (including nested aggregates).

For single errors, returns 1.
For aggregates, recursively counts all child errors.

###### Example

```typescript
const single = Err.from('One error');
console.log(single.count); // 1

const nested = Err.aggregate('Parent')
  .add('Error 1')
  .add(Err.aggregate('Child').add('Error 2').add('Error 3'));

console.log(nested.count); // 3
```

###### Returns

`number`

##### errors

###### Get Signature

> **get** **errors**(): readonly [`Err`](#err)[]

Defined in: [types/err.ts:999](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L999)

Direct child errors (for aggregates).

Returns an empty array for non-aggregate errors.

###### Example

```typescript
const aggregate = Err.aggregate('Batch failed')
  .add('Task 1 failed')
  .add('Task 2 failed');

for (const err of aggregate.errors) {
  console.log(err.message);
}
// "Task 1 failed"
// "Task 2 failed"
```

###### Returns

readonly [`Err`](#err)[]

##### isAggregate

###### Get Signature

> **get** **isAggregate**(): `boolean`

Defined in: [types/err.ts:952](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L952)

Whether this error is an aggregate containing multiple errors.

###### Example

```typescript
const single = Err.from('Single error');
const multi = Err.aggregate('Multiple').add('One').add('Two');

console.log(single.isAggregate); // false
console.log(multi.isAggregate);  // true
```

###### Returns

`boolean`

##### root

###### Get Signature

> **get** **root**(): [`Err`](#err)

Defined in: [types/err.ts:1021](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1021)

The root/original error in a wrapped error chain.

Follows the cause chain to find the deepest error.
Returns `this` if there is no cause.

###### Example

```typescript
const root = Err.from('Original error');
const wrapped = root
  .wrap('Added context')
  .wrap('More context');

console.log(wrapped.message);      // "More context"
console.log(wrapped.root.message); // "Original error"
console.log(wrapped.root.stack);   // Stack pointing to original error
```

###### Returns

[`Err`](#err)

##### stack

###### Get Signature

> **get** **stack**(): `string` \| `undefined`

Defined in: [types/err.ts:1611](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1611)

Get the captured stack trace.

For errors created from native Errors, this is the original stack.
For errors created via `Err.from(string)`, this is the stack at creation.
For wrapped errors, use `.root.stack` to get the original location.

###### Returns

`string` \| `undefined`

Stack trace string or undefined

#### Methods

##### add()

> **add**(`error`): [`Err`](#err)

Defined in: [types/err.ts:900](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L900)

Add an error to this aggregate.

Returns a new Err with the error added to the list (immutable).
If this is not an aggregate error, it will be treated as one with
the added error as the first child.

###### Parameters

###### error

Error to add (Err, Error, or string)

`string` | [`Err`](#err) | `Error`

###### Returns

[`Err`](#err)

New Err instance with the error added

###### Example

```typescript
let errors = Err.aggregate('Form validation failed');

if (!email) {
  errors = errors.add('Email is required');
}
if (!password) {
  errors = errors.add(Err.from('Password is required').withCode('MISSING_PASSWORD'));
}
```

##### addAll()

> **addAll**(`errors`): [`Err`](#err)

Defined in: [types/err.ts:932](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L932)

Add multiple errors to this aggregate at once.

Returns a new Err with all errors added (immutable).

###### Parameters

###### errors

(`string` \| [`Err`](#err) \| `Error`)[]

Array of errors to add

###### Returns

[`Err`](#err)

New Err instance with all errors added

###### Example

```typescript
const validationErrors = [
  'Name too short',
  Err.from('Invalid email format').withCode('INVALID_EMAIL'),
  new Error('Age must be positive'),
];

const aggregate = Err.aggregate('Validation failed').addAll(validationErrors);
```

##### chain()

> **chain**(): [`Err`](#err)[]

Defined in: [types/err.ts:1073](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1073)

Get the full chain of wrapped errors from root to current.

The first element is the root/original error, the last is `this`.

###### Returns

[`Err`](#err)[]

Array of Err instances in causal order

###### Remarks

Time complexity: O(n) where n is the depth of the cause chain.

###### Example

```typescript
const chain = Err.from('Network timeout')
  .wrap('API request failed')
  .wrap('Could not refresh token')
  .wrap('Authentication failed')
  .chain();

console.log(chain.map(e => e.message));
// [
//   "Network timeout",
//   "API request failed",
//   "Could not refresh token",
//   "Authentication failed"
// ]
```

##### filter()

> **filter**(`predicate`): [`Err`](#err)[]

Defined in: [types/err.ts:1255](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1255)

Find all errors matching a predicate.

Searches this error, its cause chain, and all aggregated errors.

###### Parameters

###### predicate

(`e`) => `boolean`

Function to test each error

###### Returns

[`Err`](#err)[]

Array of all matching Err instances

###### Example

```typescript
const err = Err.aggregate('Validation failed')
  .add(Err.from('Name required', 'REQUIRED'))
  .add(Err.from('Invalid email', 'INVALID'))
  .add(Err.from('Age required', 'REQUIRED'));

const required = err.filter(e => e.code === 'REQUIRED');
console.log(required.length); // 2
```

##### find()

> **find**(`predicate`): [`Err`](#err) \| `undefined`

Defined in: [types/err.ts:1222](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1222)

Find the first error matching a predicate.

Searches this error, its cause chain, and all aggregated errors.

###### Parameters

###### predicate

(`e`) => `boolean`

Function to test each error

###### Returns

[`Err`](#err) \| `undefined`

The first matching Err or undefined

###### Example

```typescript
const err = Err.aggregate('Multiple failures')
  .add(Err.from('Not found', 'NOT_FOUND'))
  .add(Err.from('Timeout', 'TIMEOUT'));

const timeout = err.find(e => e.code === 'TIMEOUT');
console.log(timeout?.message); // "Timeout"
```

##### flatten()

> **flatten**(): [`Err`](#err)[]

Defined in: [types/err.ts:1109](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1109)

Flatten all errors into a single array.

For aggregates, recursively collects all leaf errors.
For single errors, returns an array containing just this error.

###### Returns

[`Err`](#err)[]

Flattened array of all individual errors

###### Remarks

Time complexity: O(n) where n is the total number of errors in all nested aggregates.
Recursively traverses the error tree.

###### Example

```typescript
const nested = Err.aggregate('All errors')
  .add('Error A')
  .add(Err.aggregate('Group B')
    .add('Error B1')
    .add('Error B2'))
  .add('Error C');

const flat = nested.flatten();
console.log(flat.map(e => e.message));
// ["Error A", "Error B1", "Error B2", "Error C"]
```

##### hasCode()

> **hasCode**(`code`): `boolean`

Defined in: [types/err.ts:1138](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1138)

Check if this error or any error in its chain/aggregate has a specific code.

Searches the cause chain and all aggregated errors.

###### Parameters

###### code

`string`

The error code to search for

###### Returns

`boolean`

`true` if the code is found anywhere in the error tree

###### Example

```typescript
const err = Err.from('DB error', 'DB_ERROR')
  .wrap('Repository failed')
  .wrap('Service unavailable');

console.log(err.hasCode('DB_ERROR'));      // true
console.log(err.hasCode('NETWORK_ERROR')); // false
```

##### hasCodePrefix()

> **hasCodePrefix**(`prefix`, `boundary?`): `boolean`

Defined in: [types/err.ts:1189](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1189)

Check if this error or any error in its chain/aggregate has a code
matching the given prefix with boundary awareness.

This enables hierarchical error code patterns like `AUTH:TOKEN:EXPIRED`
where libraries define base codes and consumers extend with subcodes.

Matches if:
- Code equals prefix exactly (e.g., `"AUTH"` matches `"AUTH"`)
- Code starts with prefix + boundary (e.g., `"AUTH"` matches `"AUTH:EXPIRED"`)

Does NOT match partial strings (e.g., `"AUTH"` does NOT match `"AUTHORIZATION"`).

###### Parameters

###### prefix

`string`

The code prefix to search for

###### boundary?

`string` = `":"`

Separator character/string between code segments (default: ":")

###### Returns

`boolean`

`true` if a matching code is found anywhere in the error tree

###### Examples

```typescript
const err = Err.from('Token expired', { code: 'AUTH:TOKEN:EXPIRED' });

err.hasCodePrefix('AUTH');           // true (matches AUTH:*)
err.hasCodePrefix('AUTH:TOKEN');     // true (matches AUTH:TOKEN:*)
err.hasCodePrefix('AUTHORIZATION');  // false (no boundary match)
```

```typescript
const err = Err.from('Not found', { code: 'HTTP.404.NOT_FOUND' });

err.hasCodePrefix('HTTP', '.');      // true
err.hasCodePrefix('HTTP.404', '.');  // true
err.hasCodePrefix('HTTP', ':');      // false (wrong boundary)
```

```typescript
const err = Err.from('DB error', { code: 'DB:CONNECTION' })
  .wrap('Service failed', { code: 'SERVICE:UNAVAILABLE' });

err.hasCodePrefix('DB');       // true (found in cause)
err.hasCodePrefix('SERVICE');  // true (found in current)
```

##### toError()

> **toError**(): `Error`

Defined in: [types/err.ts:1586](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1586)

Convert to a native Error for interop with throw-based APIs.

Creates an Error with:
- `message`: This error's message
- `name`: This error's code (or "Err")
- `stack`: This error's original stack trace
- `cause`: Converted cause chain (native Error)

Note: Metadata is not included on the native Error.

###### Returns

`Error`

Native Error instance

###### Example

```typescript
const err = Err.from('Something failed', 'MY_ERROR');

// If you need to throw for some API
throw err.toError();

// The thrown error will have:
// - error.message === "Something failed"
// - error.name === "MY_ERROR"
// - error.stack === (original stack trace)
// - error.cause === (if wrapped)
```

##### toJSON()

> **toJSON**(`options?`): [`ErrJSON`](#errjson)

Defined in: [types/err.ts:1320](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1320)

Convert to a JSON-serializable object.

Useful for logging, API responses, and serialization.
Use options to control what's included (e.g., omit stack for public APIs).

###### Parameters

###### options?

[`ErrJSONOptions`](#errjsonoptions) = `{}`

Control what fields are included

###### Returns

[`ErrJSON`](#errjson)

Plain object representation

###### See

[fromJSON](#fromjson) for deserializing an Err from JSON

###### Examples

```typescript
const err = Err.from('Not found', {
  code: 'NOT_FOUND',
  metadata: { userId: '123' }
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
```

```typescript
app.get('/user/:id', (req, res) => {
  const result = getUser(req.params.id);
  if (Err.isErr(result)) {
    const status = result.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({
      error: result.toJSON({ stack: false })
    });
  }
  res.json(result);
});
```

```typescript
err.toJSON({ stack: false, metadata: false });
// Only includes: message, code, timestamp, cause, errors
```

##### toString()

> **toString**(`options?`): `string`

Defined in: [types/err.ts:1486](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1486)

Convert to a formatted string for logging/display.

Includes cause chain and aggregated errors with indentation.
When called with options, can include additional details like
stack traces, timestamps, and metadata.

###### Parameters

###### options?

[`ToStringOptions`](#tostringoptions)

Formatting options (optional)

###### Returns

`string`

Formatted error string

###### Examples

```typescript
const err = Err.from('DB error')
  .wrap('Repository failed')
  .wrap('Service unavailable');

console.log(err.toString());
// [ERROR] Service unavailable
//   Caused by: [ERROR] Repository failed
//     Caused by: [ERROR] DB error
```

```typescript
const err = Err.from('Connection failed', {
  code: 'DB:CONNECTION',
  metadata: { host: 'localhost', port: 5432 }
});

console.log(err.toString({ date: true, metadata: true, stack: 3 }));
// [2024-01-15T10:30:00.000Z] [DB:CONNECTION] Connection failed
//   metadata: {"host":"localhost","port":5432}
//   stack:
//     at Database.connect (src/db.ts:45)
//     at Repository.init (src/repo.ts:23)
//     at Service.start (src/service.ts:12)
```

```typescript
const err = Err.aggregate('Validation failed', [], { code: 'VALIDATION' })
  .add('Name required')
  .add('Email invalid');

console.log(err.toString());
// [VALIDATION] Validation failed
//   Errors (2):
//     - [ERROR] Name required
//     - [ERROR] Email invalid
```

```typescript
const deep = Err.from('Root')
  .wrap('Level 1')
  .wrap('Level 2')
  .wrap('Level 3');

console.log(deep.toString({ maxDepth: 2 }));
// [ERROR] Level 3
//   Caused by: [ERROR] Level 2
//     ... (1 more cause)
```

##### unwrap()

> **unwrap**(): [`Err`](#err) \| `undefined`

Defined in: [types/err.ts:1042](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L1042)

Get the directly wrapped error (one level up).

Returns `undefined` if this error has no cause.

###### Returns

[`Err`](#err) \| `undefined`

The wrapped Err or undefined

###### Example

```typescript
const inner = Err.from('DB connection failed');
const outer = inner.wrap('Could not save user');

const unwrapped = outer.unwrap();
console.log(unwrapped?.message); // "DB connection failed"
console.log(inner.unwrap());     // undefined
```

##### withCode()

> **withCode**(`code`): [`Err`](#err)

Defined in: [types/err.ts:833](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L833)

Create a new Err with a different or added error code.

Preserves the original stack trace and timestamp.

###### Parameters

###### code

`string`

The error code to set

###### Returns

[`Err`](#err)

New Err instance with the specified code

###### Example

```typescript
const err = Err.from('Record not found').withCode('NOT_FOUND');

if (err.code === 'NOT_FOUND') {
  return res.status(404).json(err.toJSON());
}
```

##### withMetadata()

> **withMetadata**(`metadata`): [`Err`](#err)

Defined in: [types/err.ts:863](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L863)

Create a new Err with additional metadata.

New metadata is merged with existing metadata. Preserves the original
stack trace and timestamp.

###### Parameters

###### metadata

`Record`\<`string`, `unknown`\>

Key-value pairs to add to metadata

###### Returns

[`Err`](#err)

New Err instance with merged metadata

###### Example

```typescript
const err = Err.from('Request failed')
  .withMetadata({ url: '/api/users' })
  .withMetadata({ statusCode: 500, retryable: true });

console.log(err.metadata);
// { url: '/api/users', statusCode: 500, retryable: true }
```

##### wrap()

> **wrap**(`context`): [`Err`](#err)

Defined in: [types/err.ts:806](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L806)

Wrap this error with additional context.

Creates a new error that has this error as its cause. The original error
is preserved and accessible via `unwrap()` or `chain()`.

## Stack Trace Behavior

The new wrapper captures a fresh stack trace pointing to where `wrap()`
was called. This is intentional - it shows the propagation path. The
original error's stack is preserved and accessible via:
- `err.unwrap()?.stack` - immediate cause's stack
- `err.root.stack` - original error's stack

###### Parameters

###### context

Either a message string or full options object

`string` | [`ErrOptions`](#erroptions)

###### Returns

[`Err`](#err)

New Err instance with this error as cause

###### See

[Err.wrap](#wrap-1) for the static version (useful in catch blocks)

###### Examples

```typescript
const dbErr = queryDatabase();
if (Err.isErr(dbErr)) {
  return dbErr.wrap('Failed to fetch user');
}
```

```typescript
return originalErr.wrap({
  message: 'Service unavailable',
  code: 'SERVICE_ERROR',
  metadata: { service: 'user-service', retryAfter: 30 }
});
```

```typescript
const wrapped = original.wrap('Context 1').wrap('Context 2');
console.log(wrapped.stack);       // Points to second wrap() call
console.log(wrapped.root.stack);  // Points to original error location
```

##### aggregate()

> `static` **aggregate**(`message`, `errors?`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:594](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L594)

Create an aggregate error for collecting multiple errors.

Useful for validation, batch operations, or any scenario where
multiple errors should be collected and reported together.

###### Parameters

###### message

`string`

Parent error message describing the aggregate

###### errors?

(`string` \| [`Err`](#err) \| `Error`)[] = `[]`

Optional initial list of errors

###### options?

[`ErrOptions`](#erroptions)

Optional code and metadata for the aggregate

###### Returns

[`Err`](#err)

New aggregate Err instance

###### Examples

```typescript
function validate(data: Input): [Valid, null] | [null, Err] {
  let errors = Err.aggregate('Validation failed');

  if (!data.email) errors = errors.add('Email is required');
  if (!data.name) errors = errors.add('Name is required');

  if (errors.count > 0) {
    return [null, errors.withCode('VALIDATION_ERROR')];
  }
  return [data as Valid, null];
}
```

```typescript
async function processAll(items: Item[]): [null, Err] | [void, null] {
  let errors = Err.aggregate('Batch processing failed');

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

##### from()

###### Call Signature

> `static` **from**(`message`, `code?`): [`Err`](#err)

Defined in: [types/err.ts:370](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L370)

Create an Err from a string message with optional code.

###### Parameters

###### message

`string`

Error message

###### code?

`string`

Optional error code

###### Returns

[`Err`](#err)

New Err instance

###### Example

```typescript
const err = Err.from('User not found', 'NOT_FOUND');
```

###### Call Signature

> `static` **from**(`message`, `options`): [`Err`](#err)

Defined in: [types/err.ts:387](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L387)

Create an Err from a string message with full options.

###### Parameters

###### message

`string`

Error message

###### options

[`ErrOptions`](#erroptions)

Code and metadata options

###### Returns

[`Err`](#err)

New Err instance

###### Example

```typescript
const err = Err.from('Connection timeout', {
  code: 'TIMEOUT',
  metadata: { host: 'api.example.com', timeoutMs: 5000 }
});
```

###### Call Signature

> `static` **from**(`error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:410](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L410)

Create an Err from a native Error.

Preserves the original error's:
- Stack trace (as primary stack for debugging)
- Cause chain (if `error.cause` is Error or string)
- Name (in metadata as `originalName`)

###### Parameters

###### error

`Error`

Native Error instance

###### options?

[`ErrOptions`](#erroptions)

Optional overrides for message, code, and metadata

###### Returns

[`Err`](#err)

New Err instance

###### Example

```typescript
try {
  JSON.parse(invalidJson);
} catch (e) {
  return Err.from(e as Error, { code: 'PARSE_ERROR' });
}
```

###### Call Signature

> `static` **from**(`error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:425](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L425)

Create an Err from another Err instance (clone with optional overrides).

###### Parameters

###### error

[`Err`](#err)

Existing Err instance

###### options?

[`ErrOptions`](#erroptions)

Optional overrides

###### Returns

[`Err`](#err)

New Err instance with merged properties

###### Example

```typescript
const original = Err.from('Original error');
const modified = Err.from(original, { code: 'NEW_CODE' });
```

###### Call Signature

> `static` **from**(`error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:447](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L447)

Create an Err from an unknown value (safe for catch blocks).

Handles any value that might be thrown, including non-Error objects,
strings, numbers, null, and undefined.

###### Parameters

###### error

`unknown`

Any value

###### options?

[`ErrOptions`](#erroptions)

Optional code and metadata

###### Returns

[`Err`](#err)

New Err instance

###### Example

```typescript
try {
  await riskyAsyncOperation();
} catch (e) {
  // Safe - handles any thrown value
  return Err.from(e).wrap('Operation failed');
}
```

##### fromJSON()

> `static` **fromJSON**(`json`): [`Err`](#err)

Defined in: [types/err.ts:642](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L642)

Deserialize an Err from JSON representation.

Reconstructs an Err instance from its JSON form, including
cause chains and aggregated errors. Validates the input structure.

###### Parameters

###### json

`unknown`

JSON object matching ErrJSON structure

###### Returns

[`Err`](#err)

Reconstructed Err instance

###### Throws

Error if json is invalid or missing required fields

###### See

[toJSON](#tojson) for serializing an Err to JSON

###### Examples

```typescript
const response = await fetch('/api/users/123');
if (!response.ok) {
  const body = await response.json();
  if (body.error) {
    const err = Err.fromJSON(body.error);
    if (err.hasCode('NOT_FOUND')) {
      return showNotFound();
    }
    return showError(err);
  }
}
```

```typescript
queue.on('error', (message) => {
  const err = Err.fromJSON(message.payload);
  logger.error('Task failed', { error: err.toJSON() });
});
```

##### isErr()

> `static` **isErr**(`value`): `value is Err`

Defined in: [types/err.ts:748](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L748)

Type guard to check if a value is an Err instance.

Useful for checking values from external sources where
`instanceof` may not work (different realms, serialization).

###### Parameters

###### value

`unknown`

Any value to check

###### Returns

`value is Err`

`true` if value is an Err instance

###### Examples

```typescript
// Useful for values from external sources
function handleApiResponse(data: unknown): void {
  if (Err.isErr(data)) {
    console.error('Received error:', data.message);
    return;
  }
  // Process data...
}
```

```typescript
function getUser(id: string): [User, null] | [null, Err] {
  // ...
}

const [user, err] = getUser('123');
if (err) {
  console.error(err.message);
  return;
}
console.log(user.name);
```

##### wrap()

> `static` **wrap**(`message`, `error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:538](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L538)

Static convenience method to wrap an error with a context message.

Creates a new Err with the provided message, having the original
error as its cause. This is the recommended pattern for catch blocks.

###### Parameters

###### message

`string`

Context message explaining what operation failed

###### error

The original error (Err, Error, or string)

`string` | [`Err`](#err) | `Error`

###### options?

[`ErrOptions`](#erroptions)

Optional code and metadata for the wrapper

###### Returns

[`Err`](#err)

New Err instance with the original as cause

###### See

[Err.prototype.wrap](#wrap) for the instance method

###### Examples

```typescript
try {
  await db.query(sql);
} catch (e) {
  return Err.wrap('Database query failed', e as Error);
}
```

```typescript
try {
  const user = await fetchUser(id);
} catch (e) {
  return Err.wrap('Failed to fetch user', e as Error, {
    code: 'USER_FETCH_ERROR',
    metadata: { userId: id }
  });
}
```

## Interfaces

### ErrJSON

Defined in: [types/err.ts:194](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L194)

JSON representation of an Err for serialization.

#### Properties

##### cause?

> `optional` **cause**: [`ErrJSON`](#errjson)

Defined in: [types/err.ts:202](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L202)

##### code?

> `optional` **code**: `string`

Defined in: [types/err.ts:198](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L198)

##### errors

> **errors**: [`ErrJSON`](#errjson)[]

Defined in: [types/err.ts:203](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L203)

##### isErr?

> `optional` **isErr**: `boolean`

Defined in: [types/err.ts:197](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L197)

##### kind?

> `optional` **kind**: `"Err"`

Defined in: [types/err.ts:196](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L196)

##### message

> **message**: `string`

Defined in: [types/err.ts:195](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L195)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.ts:199](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L199)

##### stack?

> `optional` **stack**: `string`

Defined in: [types/err.ts:201](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L201)

##### timestamp

> **timestamp**: `string`

Defined in: [types/err.ts:200](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L200)

***

### ErrJSONOptions

Defined in: [types/err.ts:142](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L142)

Options for JSON serialization.

#### Properties

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.ts:154](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L154)

Include metadata in output.
Set to `false` to omit potentially sensitive data.

###### Default

```ts
true
```

##### stack?

> `optional` **stack**: `boolean`

Defined in: [types/err.ts:148](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L148)

Include stack trace in output.
Set to `false` for public API responses.

###### Default

```ts
true
```

***

### ErrOptions

Defined in: [types/err.ts:130](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L130)

Options for creating or modifying an Err instance.

#### Properties

##### code?

> `optional` **code**: `string`

Defined in: [types/err.ts:132](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L132)

Error code for programmatic error handling

##### message?

> `optional` **message**: `string`

Defined in: [types/err.ts:134](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L134)

Human-readable error message

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.ts:136](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L136)

Additional contextual data

***

### ToStringOptions

Defined in: [types/err.ts:160](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L160)

Options for toString() output formatting.

#### Properties

##### date?

> `optional` **date**: `boolean`

Defined in: [types/err.ts:172](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L172)

Include timestamp in output (ISO 8601 format).

###### Default

```ts
false
```

##### indent?

> `optional` **indent**: `string`

Defined in: [types/err.ts:188](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L188)

Indentation string for nested output.

###### Default

```ts
"  " (two spaces)
```

##### maxDepth?

> `optional` **maxDepth**: `number`

Defined in: [types/err.ts:183](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L183)

Maximum depth for cause chain traversal.
When exceeded, shows "... (N more causes)".

###### Default

```ts
undefined (unlimited)
```

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.ts:177](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L177)

Include metadata object in output.

###### Default

```ts
false
```

##### stack?

> `optional` **stack**: `number` \| `boolean`

Defined in: [types/err.ts:167](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L167)

Include stack trace in output.
- `true`: Include full stack trace
- `number`: Include only top N frames (default: 3 when number)

###### Default

```ts
undefined (no stack)
```

## Type Aliases

### ErrCode

> **ErrCode** = `string`

Defined in: [types/err.ts:125](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/types/err.ts#L125)

Error code type - typically uppercase snake_case identifiers.

#### Example

```typescript
const codes: ErrCode[] = [
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'DB_CONNECTION_FAILED',
  'AUTH_EXPIRED',
];
```
