[**@pencroff-lab/kore**](index.md)

***

[@pencroff-lab/kore](index.md) / outcome

# outcome

Monadic container for handling success and error states using tuple-first API design.

This module provides the `Outcome<T>` class and related types for implementing
type-safe error handling without exceptions. All operations favor immutability.

## Examples

```typescript
import { Outcome } from './outcome';

const [val, err] = Outcome.from(() => [42, null]).toTuple();
```

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

## Classes

### Outcome

Defined in: [types/outcome.ts:166](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L166)

A monadic container for handling success and error states.

`Outcome<T>` provides a type-safe way to handle operations that can fail,
using tuples as the primary interface. All instances are immutable.

## Core Patterns

- **Construction**: Use static methods `ok()`, `err()`, `from()`, `fromAsync()`
- **Inspection**: Use `isOk`, `isErr`, `value`, `error` properties
- **Transformation**: Use `map()`, `mapErr()` for chained operations
- **Extraction**: Use `toTuple()` for final value extraction

#### Examples

```typescript
const outcome = Outcome.from(() => {
  if (Math.random() > 0.5) return [42, null];
  return Err.from('Bad luck');
});

const [value, err] = outcome.toTuple();
if (err) {
  console.error('Failed:', err.message);
} else {
  console.log('Success:', value);
}
```

```typescript
const result = Outcome.ok(5)
  .map(n => [n * 2, null])
  .map(n => [n.toString(), null])
  .toTuple();
// result: ['10', null]
```

#### Type Parameters

##### T

`T`

The type of the success value

#### Properties

##### isOk

> `readonly` **isOk**: `boolean`

Defined in: [types/outcome.ts:171](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L171)

Discriminator property for type narrowing.
`true` for success outcomes, `false` for error outcomes.

#### Accessors

##### error

###### Get Signature

> **get** **error**(): [`Err`](err.md#err) \| `null`

Defined in: [types/outcome.ts:713](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L713)

The error, or null if in success state.

###### Example

```typescript
const success = Outcome.ok(42);
const failure = Outcome.err('Failed');

console.log(success.error); // null
console.log(failure.error?.message); // 'Failed'
```

###### Returns

[`Err`](err.md#err) \| `null`

##### isErr

###### Get Signature

> **get** **isErr**(): `boolean`

Defined in: [types/outcome.ts:681](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L681)

Whether this Outcome is in error state.

###### Example

```typescript
const success = Outcome.ok(42);
const failure = Outcome.err('Failed');

console.log(success.isErr); // false
console.log(failure.isErr); // true
```

###### Returns

`boolean`

##### value

###### Get Signature

> **get** **value**(): `T` \| `null`

Defined in: [types/outcome.ts:697](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L697)

The success value, or null if in error state.

###### Example

```typescript
const success = Outcome.ok(42);
const failure = Outcome.err('Failed');

console.log(success.value); // 42
console.log(failure.value); // null
```

###### Returns

`T` \| `null`

#### Methods

##### defaultTo()

###### Call Signature

> **defaultTo**(`fallback`): `T`

Defined in: [types/outcome.ts:995](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L995)

Extract the success value, or use a fallback value on error.

This is a terminal operation that exits the Outcome chain.
Returns `T` directly, not wrapped in Outcome.

###### Parameters

###### fallback

`T`

The fallback value to use if in error state

###### Returns

`T`

The success value or the fallback

###### Throws

If the outcome is an error and computing fallback throws

###### See

 - [either](#either) for transforming both cases with custom logic
 - [toTuple](#totuple) for raw tuple extraction

###### Examples

```typescript
const count = parseNumber(input).defaultTo(0);
// Returns parsed number or 0 on error
```

```typescript
const config = loadConfig().defaultTo({ port: 3000, host: 'localhost' });
```

###### Call Signature

> **defaultTo**(`handler`): `T`

Defined in: [types/outcome.ts:1022](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1022)

Extract the success value, or compute a fallback from the error.

This is a terminal operation that exits the Outcome chain.
The handler receives the `Err` and can use it to compute the fallback.

###### Parameters

###### handler

(`error`) => `T`

Function to compute fallback from error

###### Returns

`T`

The success value or computed fallback

###### Throws

If the handler throws, the exception propagates to the caller

###### Examples

```typescript
const name = fetchUser(id).defaultTo(err =>
  err.hasCode('NOT_FOUND') ? 'Guest' : 'Unknown'
);
```

```typescript
const data = loadData().defaultTo(err => {
  console.error('Load failed:', err.message);
  return cachedData;
});
```

###### Call Signature

> **defaultTo**(`fallback`, `asValue`): `T`

Defined in: [types/outcome.ts:1040](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1040)

Extract the success value, or use the provided fallback value.

When T is a function type, use this overload with `asValue: true`
to force treating the fallback as a static value rather than an error handler.

###### Parameters

###### fallback

`T`

The fallback value to use when error

###### asValue

`true`

Must be `true` to use this overload

###### Returns

`T`

The success value or the fallback

###### Example

```typescript
const defaultHandler = () => console.log('default');
const handler = getHandler().defaultTo(defaultHandler, true);
```

##### effect()

> **effect**(`fn`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:929](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L929)

Execute a side effect with access to the full tuple.

The callback receives the tuple `[value, error]` regardless of state.
Returns `this` unchanged for chaining.
If the callback throws, the exception is caught and the Outcome becomes an error.

###### Parameters

###### fn

(`tuple`) => `void`

Side effect function receiving the tuple

###### Returns

[`Outcome`](#outcome)\<`T`\>

This Outcome (for chaining), or error Outcome if callback throws

###### See

[effectAsync](#effectasync) for the async version

###### Examples

```typescript
const outcome = Outcome.ok(42)
  .effect(([val, err]) => {
    if (err) console.error('Failed:', err.message);
    else console.log('Success:', val);
  })
  .map(v => [v * 2, null]);
```

```typescript
outcome.effect(([val, err]) => {
  metrics.record({
    success: !err,
    value: val,
    errorCode: err?.code
  });
});
```

##### effectAsync()

> **effectAsync**(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Defined in: [types/outcome.ts:955](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L955)

Async version of `effect()`.

###### Parameters

###### fn

(`tuple`) => `Promise`\<`void`\>

Async side effect function

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Promise of this Outcome

###### See

[effect](#effect) for the synchronous version

###### Example

```typescript
const outcome = await Outcome.ok(data)
  .effectAsync(async ([val, err]) => {
    await logger.log({ value: val, error: err?.toJSON() });
  });
```

##### either()

> **either**\<`U`\>(`onOk`, `onErr`): `U`

Defined in: [types/outcome.ts:1108](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1108)

Transform the Outcome into a final value by handling both cases.

This is a terminal operation that exits the Outcome chain, similar to
`toTuple()` but with transformation logic applied.

Each handler receives only its relevant type with full type safety:
- `onOk` receives `T` (guaranteed non-null value)
- `onErr` receives `Err` (guaranteed error)

###### Type Parameters

###### U

`U`

###### Parameters

###### onOk

(`value`) => `U`

Function to transform success value into final result

###### onErr

(`error`) => `U`

Function to transform error into final result

###### Returns

`U`

The transformed value (not wrapped in Outcome)

###### Throws

If either callback throws, the exception propagates to the caller

###### See

 - [defaultTo](#defaultto) for simple value extraction with fallback
 - [toTuple](#totuple) for raw tuple extraction
 - [toJSON](#tojson) for JSON serialization

###### Examples

```typescript
const message = fetchUser(id).either(
  user => `Welcome, ${user.name}!`,
  err => `Error: ${err.message}`
);
// message is string, not Outcome<string>
```

```typescript
const response = processOrder(orderId).either(
  order => ({ status: 200, body: { id: order.id, total: order.total } }),
  err => ({
    status: err.hasCode('NOT_FOUND') ? 404 : 500,
    body: { error: err.message }
  })
);
```

```typescript
const count = parseNumber(input).either(n => n, () => 0);
```

```typescript
const status: 'success' | 'error' = outcomeEntity.either(
  () => 'success',
  () => 'error'
);
```

##### map()

> **map**\<`U`\>(`fn`): [`Outcome`](#outcome)\<`U`\>

Defined in: [types/outcome.ts:763](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L763)

Transform the success value using a callback.

Only called if this Outcome is successful. Errors pass through unchanged.
The callback can return any `CallbackReturn<U>` pattern.
If the callback throws, the exception is caught and wrapped.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`value`) => [`CallbackReturn`](#callbackreturn)\<`U`\>

Transformation function receiving the success value

###### Returns

[`Outcome`](#outcome)\<`U`\>

New Outcome with transformed value or original/new error

###### See

 - [mapAsync](#mapasync) for the async version
 - [mapErr](#maperr) for transforming or recovering from errors

###### Examples

```typescript
const outcome = Outcome.ok(5)
  .map(n => [n * 2, null])
  .map(n => [n.toString(), null]);

console.log(outcome.value); // '10'
```

```typescript
const outcome = Outcome.ok('{"name":"John"}')
  .map(json => {
    try {
      return [JSON.parse(json), null];
    } catch {
      return Err.from('Invalid JSON');
    }
  });
```

```typescript
const outcome = Outcome.err('Original error')
  .map(v => [v * 2, null]); // Never called

console.log(outcome.error?.message); // 'Original error'
```

##### mapAsync()

> **mapAsync**\<`U`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Defined in: [types/outcome.ts:792](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L792)

Async version of `map()`.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`value`) => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`U`\>\>

Async transformation function

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Promise of new Outcome

###### See

[map](#map) for the synchronous version

###### Example

```typescript
const outcome = await Outcome.ok(userId)
  .mapAsync(async id => {
    const user = await fetchUser(id);
    return [user, null];
  });
```

##### mapErr()

> **mapErr**\<`U`\>(`fn`): [`Outcome`](#outcome)\<`T` \| `U`\>

Defined in: [types/outcome.ts:846](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L846)

Transform or recover from an error using a callback.

Only called if this Outcome is in error state. Success passes through unchanged.
The callback can return any `CallbackReturn<U>` pattern, allowing:
- Recovery: return `[value, null]` to convert error to success
- Transform: return `Err` or `[null, Err]` to change the error

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`error`) => [`CallbackReturn`](#callbackreturn)\<`U`\>

Function receiving the error

###### Returns

[`Outcome`](#outcome)\<`T` \| `U`\>

New Outcome with transformed error or recovered value

###### See

 - [mapErrAsync](#maperrasync) for the async version
 - [map](#map) for transforming success values

###### Examples

```typescript
const outcome = Outcome.err('Not found')
  .mapErr(err => {
    if (err.hasCode('NOT_FOUND')) {
      return [defaultValue, null]; // recover with default
    }
    return err; // pass through other errors
  });
```

```typescript
const outcome = Outcome.err('Low-level error')
  .mapErr(err => err.wrap('High-level context'));
```

```typescript
const outcome = Outcome.err('Something failed')
  .mapErr(err => {
    console.error('Error occurred:', err.message);
    return err; // pass through unchanged
  });
```

##### mapErrAsync()

> **mapErrAsync**\<`U`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T` \| `U`\>\>

Defined in: [types/outcome.ts:877](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L877)

Async version of `mapErr()`.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`error`) => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`U`\>\>

Async function receiving the error

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T` \| `U`\>\>

Promise of new Outcome

###### See

[mapErr](#maperr) for the synchronous version

###### Example

```typescript
const outcome = await Outcome.err('Primary failed')
  .mapErrAsync(async err => {
    const fallback = await fetchFromBackup();
    if (fallback) return [fallback, null];
    return err.wrap('Backup also failed');
  });
```

##### pipe()

###### Call Signature

> **pipe**\<`A`\>(`f1`): [`Outcome`](#outcome)\<`A`\>

Defined in: [types/outcome.ts:1163](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1163)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### Returns

[`Outcome`](#outcome)\<`A`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`\>(`f1`, `f2`): [`Outcome`](#outcome)\<`B`\>

Defined in: [types/outcome.ts:1164](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1164)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### Returns

[`Outcome`](#outcome)\<`B`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`\>(`f1`, `f2`, `f3`): [`Outcome`](#outcome)\<`C`\>

Defined in: [types/outcome.ts:1165](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1165)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### Returns

[`Outcome`](#outcome)\<`C`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`\>(`f1`, `f2`, `f3`, `f4`): [`Outcome`](#outcome)\<`D`\>

Defined in: [types/outcome.ts:1170](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1170)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### Returns

[`Outcome`](#outcome)\<`D`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`\>(`f1`, `f2`, `f3`, `f4`, `f5`): [`Outcome`](#outcome)\<`E`\>

Defined in: [types/outcome.ts:1176](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1176)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### Returns

[`Outcome`](#outcome)\<`E`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`): [`Outcome`](#outcome)\<`F`\>

Defined in: [types/outcome.ts:1183](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1183)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### Returns

[`Outcome`](#outcome)\<`F`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`): [`Outcome`](#outcome)\<`G`\>

Defined in: [types/outcome.ts:1191](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1191)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### Returns

[`Outcome`](#outcome)\<`G`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`): [`Outcome`](#outcome)\<`H`\>

Defined in: [types/outcome.ts:1200](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1200)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### f8

[`PipeFn`](#pipefn)\<`G`, `H`\>

###### Returns

[`Outcome`](#outcome)\<`H`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`): [`Outcome`](#outcome)\<`I`\>

Defined in: [types/outcome.ts:1210](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1210)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### f8

[`PipeFn`](#pipefn)\<`G`, `H`\>

###### f9

[`PipeFn`](#pipefn)\<`H`, `I`\>

###### Returns

[`Outcome`](#outcome)\<`I`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`, `f10`): [`Outcome`](#outcome)\<`J`\>

Defined in: [types/outcome.ts:1221](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1221)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`.
This allows handling both success and error cases at each step,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### J

`J`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### f8

[`PipeFn`](#pipefn)\<`G`, `H`\>

###### f9

[`PipeFn`](#pipefn)\<`H`, `I`\>

###### f10

[`PipeFn`](#pipefn)\<`I`, `J`\>

###### Returns

[`Outcome`](#outcome)\<`J`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Examples

```typescript
const result = Outcome.ok(rawInput).pipe(
  ([val, err]) => {
    if (err) return err;
    return [validate(val), null];
  },
  ([val, err]) => {
    if (err) return err;
    return [transform(val), null];
  }
);
```

```typescript
const result = Outcome.ok(input).pipe(
  ([val, err]) => {
    if (err) return err;
    if (!val.isValid) return Err.from('Invalid', 'VALIDATION');
    return [val, null];
  },
  ([val, err]) => {
    // Recover from validation error
    if (err?.hasCode('VALIDATION')) {
      return [DEFAULT_VALUE, null];
    }
    if (err) return err;
    return [val.process(), null];
  }
);
```

##### pipeAsync()

###### Call Signature

> **pipeAsync**\<`A`\>(`f1`): `Promise`\<[`Outcome`](#outcome)\<`A`\>\>

Defined in: [types/outcome.ts:1296](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1296)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`A`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`\>(`f1`, `f2`): `Promise`\<[`Outcome`](#outcome)\<`B`\>\>

Defined in: [types/outcome.ts:1297](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1297)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`B`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`\>(`f1`, `f2`, `f3`): `Promise`\<[`Outcome`](#outcome)\<`C`\>\>

Defined in: [types/outcome.ts:1301](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1301)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`C`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`\>(`f1`, `f2`, `f3`, `f4`): `Promise`\<[`Outcome`](#outcome)\<`D`\>\>

Defined in: [types/outcome.ts:1306](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1306)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`D`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`\>(`f1`, `f2`, `f3`, `f4`, `f5`): `Promise`\<[`Outcome`](#outcome)\<`E`\>\>

Defined in: [types/outcome.ts:1312](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1312)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`E`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`): `Promise`\<[`Outcome`](#outcome)\<`F`\>\>

Defined in: [types/outcome.ts:1319](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1319)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`F`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`): `Promise`\<[`Outcome`](#outcome)\<`G`\>\>

Defined in: [types/outcome.ts:1327](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1327)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`G`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`): `Promise`\<[`Outcome`](#outcome)\<`H`\>\>

Defined in: [types/outcome.ts:1336](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1336)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### f8

[`PipeFnAsync`](#pipefnasync)\<`G`, `H`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`H`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`): `Promise`\<[`Outcome`](#outcome)\<`I`\>\>

Defined in: [types/outcome.ts:1346](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1346)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### f8

[`PipeFnAsync`](#pipefnasync)\<`G`, `H`\>

###### f9

[`PipeFnAsync`](#pipefnasync)\<`H`, `I`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`I`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`, `f10`): `Promise`\<[`Outcome`](#outcome)\<`J`\>\>

Defined in: [types/outcome.ts:1357](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1357)

Chain asynchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `Promise<CallbackReturn<U>>`.
Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### J

`J`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### f8

[`PipeFnAsync`](#pipefnasync)\<`G`, `H`\>

###### f9

[`PipeFnAsync`](#pipefnasync)\<`H`, `I`\>

###### f10

[`PipeFnAsync`](#pipefnasync)\<`I`, `J`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`J`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Examples

```typescript
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
  }
);
```

```typescript
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
  }
);
```

##### toJSON()

> **toJSON**(): \[`T`, `null`\] \| \[`null`, [`ErrJSON`](err.md#errjson)\]

Defined in: [types/outcome.ts:1440](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1440)

Convert to JSON-serializable tuple.

For success: returns `[value, null]`
For error: returns `[null, errJSON]` where errJSON is from `Err.toJSON()`

###### Returns

\[`T`, `null`\] \| \[`null`, [`ErrJSON`](err.md#errjson)\]

JSON-serializable representation

###### See

[fromJSON](#fromjson) for deserializing an Outcome from JSON

###### Example

```typescript
const outcome = Outcome.ok({ name: 'John' });
const json = JSON.stringify(outcome.toJSON());
// '[{"name":"John"},null]'

// Deserialize
const restored = Outcome.fromJSON(JSON.parse(json));
```

##### toString()

> **toString**(): `string`

Defined in: [types/outcome.ts:1461](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1461)

Convert to a human-readable string.

###### Returns

`string`

String representation

###### Example

```typescript
console.log(Outcome.ok(42).toString());
// 'Outcome.ok(42)'

console.log(Outcome.err('Failed').toString());
// 'Outcome.err([ERROR] Failed)'
```

##### toTuple()

> **toTuple**(): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [types/outcome.ts:1415](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L1415)

Extract the internal tuple.

Primary method for extracting values from an Outcome.
Use destructuring for ergonomic access.

###### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

The internal ResultTuple<T>

###### See

[fromTuple](#fromtuple) for creating an Outcome from a tuple

###### Example

```typescript
const outcome = Outcome.ok(42);
const [value, error] = outcome.toTuple();

if (error) {
  console.error('Failed:', error.message);
  return;
}
console.log('Value:', value); // 42
```

##### all()

> `static` **all**\<`T`\>(`outcomes`): [`Outcome`](#outcome)\<`T`[]\>

Defined in: [types/outcome.ts:579](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L579)

Combines multiple Outcomes, succeeding if all succeed with an array of values.
If any Outcome fails, returns an Err containing all failures aggregated via Err.aggregate().

This is useful for validation scenarios where you need to collect all errors.

For empty arrays, returns `Outcome.ok([])` (vacuous truth).

###### Type Parameters

###### T

`T`

###### Parameters

###### outcomes

[`Outcome`](#outcome)\<`T`\>[]

Array of Outcomes to combine

###### Returns

[`Outcome`](#outcome)\<`T`[]\>

Outcome containing array of all success values, or aggregate error

###### Remarks

Time complexity: O(n) where n is the number of outcomes.
All outcomes are evaluated (non-short-circuiting) to collect all errors.

###### Examples

```typescript
const outcomes = [Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)];
const combined = Outcome.all(outcomes);
console.log(combined.value); // [1, 2, 3]
```

```typescript
const outcomes = [
  Outcome.ok(1),
  Outcome.err('Failed'),
  Outcome.ok(3)
];
const combined = Outcome.all(outcomes);
console.log(combined.isErr); // true
console.log(combined.error?.message); // 'Failed'
```

```typescript
const mixed = [
  Outcome.ok(1),
  Outcome.err("Error A"),
  Outcome.err("Error B")
];
const failed = Outcome.all(mixed);
console.log(failed.isErr);  // true
// Error contains both "Error A" and "Error B"
```

```typescript
const combined = Outcome.all([]);
console.log(combined.value); // []
```

##### any()

> `static` **any**\<`T`\>(`outcomes`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:648](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L648)

Return the first successful Outcome from an array.

Returns the first success encountered.
Returns an aggregate error if ALL outcomes fail.

For empty arrays, returns an error (no value to return).

###### Type Parameters

###### T

`T`

###### Parameters

###### outcomes

[`Outcome`](#outcome)\<`T`\>[]

Array of Outcomes to check

###### Returns

[`Outcome`](#outcome)\<`T`\>

First successful Outcome, or aggregate of all errors

###### Remarks

Time complexity: O(n) worst case, but short-circuits on first success.
Best case: O(1) if first outcome is successful.

###### Examples

```typescript
const outcomes = [
  Outcome.err('First failed'),
  Outcome.ok(42),
  Outcome.ok(100)
];
const result = Outcome.any(outcomes);
console.log(result.value); // 42
```

```typescript
const outcomes = [
  Outcome.err('Error 1'),
  Outcome.err('Error 2')
];
const result = Outcome.any(outcomes);
console.log(result.isErr); // true
console.log(result.error?.isAggregate); // true
```

```typescript
const result = Outcome.any([]);
console.log(result.isErr); // true
console.log(result.error?.message); // 'No outcomes provided'
```

##### err()

###### Call Signature

> `static` **err**(`error`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:248](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L248)

Create an error Outcome from an existing Err.

###### Parameters

###### error

[`Err`](err.md#err)

The Err instance

###### Returns

[`Outcome`](#outcome)\<`never`\>

Outcome in error state

###### Example

```typescript
const err = Err.from('Something failed');
const outcome = Outcome.err(err);
```

###### Call Signature

> `static` **err**(`message`, `code?`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:264](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L264)

Create an error Outcome from a message with optional code.

###### Parameters

###### message

`string`

Error message

###### code?

`string`

Optional error code

###### Returns

[`Outcome`](#outcome)\<`never`\>

Outcome in error state

###### Example

```typescript
const outcome = Outcome.err('Not found', 'NOT_FOUND');
const [, err] = outcome.toTuple();
console.log(err?.code); // 'NOT_FOUND'
```

###### Call Signature

> `static` **err**(`message`, `options`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:281](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L281)

Create an error Outcome from a message with options.

###### Parameters

###### message

`string`

Error message

###### options

[`ErrOptions`](err.md#erroptions)

Error options (code, metadata)

###### Returns

[`Outcome`](#outcome)\<`never`\>

Outcome in error state

###### Example

```typescript
const outcome = Outcome.err('Timeout', {
  code: 'TIMEOUT',
  metadata: { durationMs: 5000 }
});
```

###### Call Signature

> `static` **err**(`message`, `error`, `options?`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:300](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L300)

Create an error Outcome by wrapping another error.

###### Parameters

###### message

`string`

Context message

###### error

Original error to wrap

[`Err`](err.md#err) | `Error`

###### options?

[`ErrOptions`](err.md#erroptions)

Optional additional options

###### Returns

[`Outcome`](#outcome)\<`never`\>

Outcome in error state with wrapped cause

###### Example

```typescript
try {
  JSON.parse(invalid);
} catch (e) {
  return Outcome.err('Parse failed', e as Error, { code: 'PARSE_ERROR' });
}
```

##### from()

> `static` **from**\<`T`\>(`fn`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:400](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L400)

Create an Outcome from a callback that returns `CallbackReturn<T>`.

The callback can return:
- `[value, null]` - success with value
- `[null, Err]` - error as tuple
- `null` - void success
- `Err` - error directly

If the callback throws, the exception is caught and wrapped in an error Outcome.

###### Type Parameters

###### T

`T`

###### Parameters

###### fn

() => [`CallbackReturn`](#callbackreturn)\<`T`\>

Callback returning CallbackReturn<T>

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome<T>

###### See

[fromAsync](#fromasync) for the async version

###### Examples

```typescript
const outcome = Outcome.from(() => {
  return [42, null];
});
console.log(outcome.value); // 42
```

```typescript
const outcome = Outcome.from(() => {
  if (invalid) return Err.from('Invalid input');
  return [result, null];
});
```

```typescript
const outcome = Outcome.from(() => {
  const data = JSON.parse(untrustedInput); // may throw
  return [data, null];
});
// If JSON.parse throws, outcome.isErr === true
```

##### fromAsync()

> `static` **fromAsync**\<`T`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Defined in: [types/outcome.ts:447](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L447)

Create an Outcome from an async callback that returns `Promise<CallbackReturn<T>>`.

Async version of `from()` with identical semantics.

###### Type Parameters

###### T

`T`

###### Parameters

###### fn

() => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`T`\>\>

Async callback returning Promise<CallbackReturn<T>>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Promise<Outcome<T>>

###### See

[from](#from) for the synchronous version

###### Examples

```typescript
const outcome = await Outcome.fromAsync(async () => {
  const response = await fetch('/api/data');
  if (!response.ok) {
    return Err.from('Request failed', { code: 'HTTP_ERROR' });
  }
  const data = await response.json();
  return [data, null];
});
```

```typescript
const outcome = await Outcome.fromAsync(async () => {
  let errors = Err.aggregate('Batch failed');

  const [a, errA] = await taskA().toTuple();
  if (errA) errors = errors.add(errA);

  const [b, errB] = await taskB().toTuple();
  if (errB) errors = errors.add(errB);

  if (errors.count > 0) return errors;
  return [{ a, b }, null];
});
```

##### fromJSON()

> `static` **fromJSON**\<`T`\>(`payload`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:505](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L505)

Create an Outcome from a JSON tuple produced by `toJSON()`.

Accepts `[value, null]` for success or `[null, errJSON]` for errors.
Errors are rehydrated with `Err.fromJSON()`.

###### Type Parameters

###### T

`T`

###### Parameters

###### payload

JSON tuple from `Outcome.toJSON()`

\[`null`, [`ErrJSON`](err.md#errjson)\] | \[`T`, `null`\]

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome<T>

###### See

[toJSON](#tojson) for serializing an Outcome to JSON

###### Example

```typescript
const json = JSON.stringify(outcome.toJSON());
const restored = Outcome.fromJSON(JSON.parse(json));
```

##### fromTuple()

> `static` **fromTuple**\<`T`\>(`tuple`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:484](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L484)

Create an Outcome from an existing ResultTuple.

Useful for deserializing Outcomes or converting from external tuple sources.

###### Type Parameters

###### T

`T`

###### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

A ResultTuple<T>

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome<T>

###### See

[toTuple](#totuple) for extracting the tuple from an Outcome

###### Examples

```typescript
const json = '["hello", null]';
const tuple = JSON.parse(json) as ResultTuple<string>;
const outcome = Outcome.fromTuple(tuple);
console.log(outcome.value); // 'hello'
```

```typescript
const original = Outcome.ok(42);
const json = JSON.stringify(original.toJSON());
const restored = Outcome.fromTuple(JSON.parse(json));
console.log(restored.value); // 42
```

##### ok()

> `static` **ok**\<`T`\>(`value`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:232](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L232)

Create a success Outcome with the given value.

###### Type Parameters

###### T

`T`

###### Parameters

###### value

`T`

The success value

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome containing the success value

###### Example

```typescript
const outcome = Outcome.ok(42);
console.log(outcome.isOk);  // true
console.log(outcome.value); // 42

const [val, err] = outcome.toTuple();
// val: 42, err: null
```

##### unit()

> `static` **unit**(): [`Outcome`](#outcome)\<`null`\>

Defined in: [types/outcome.ts:355](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L355)

Create a success Outcome with null value (void success).

Use for operations that succeed but have no meaningful return value.

###### Returns

[`Outcome`](#outcome)\<`null`\>

Outcome<null> representing void success

###### Remarks

Returns `Outcome<null>` (not `Outcome<undefined>` or `Outcome<void>`).
This is intentional for consistency with the tuple pattern where `null`
indicates absence of error in `[value, null]`.

###### Example

```typescript
function logMessage(msg: string): Outcome<null> {
  console.log(msg);
  return Outcome.unit();
}

const outcome = logMessage('Hello');
console.log(outcome.isOk); // true
console.log(outcome.value); // null
```

## Type Aliases

### CallbackReturn

> **CallbackReturn**\<`T`\> = [`ResultTuple`](#resulttuple)\<`T`\> \| [`NullErr`](#nullerr)

Defined in: [types/outcome.ts:105](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L105)

Combined callback return type for `Outcome.from()` and `Outcome.fromAsync()`.
Supports all patterns:
- `[T, null]`: success with value (tuple)
- `[null, Err]`: error (tuple)
- `null`: void success
- `Err`: error (shorthand)

Discrimination order: `Err.isErr()` → `=== null` → destructure tuple

#### Type Parameters

##### T

`T`

#### Example

```typescript
Outcome.from(() => {
  if (badInput) return Err.from('Bad input');     // Err shorthand
  if (noResult) return null;                       // void success
  if (hasError) return [null, Err.from('Error')]; // tuple error
  return [value, null];                            // tuple success
});
```

***

### NullErr

> **NullErr** = `null` \| [`Err`](err.md#err)

Defined in: [types/outcome.ts:64](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L64)

Direct return types for errors or void success.
- `null`: void success (function completed, no value to return)
- `Err`: error (shorthand for `[null, Err]`)

#### Example

```typescript
function saveConfig(config: Config): NullErr {
  if (!config.valid) return Err.from('Invalid config');
  fs.writeFileSync('config.json', JSON.stringify(config));
  return null; // void success
}
```

***

### PipeFn()

> **PipeFn**\<`In`, `Out`\> = (`tuple`) => [`CallbackReturn`](#callbackreturn)\<`Out`\>

Defined in: [types/outcome.ts:114](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L114)

Synchronous pipe function type.
Receives a ResultTuple and returns a CallbackReturn.

#### Type Parameters

##### In

`In`

Input value type

##### Out

`Out`

Output value type

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

#### Returns

[`CallbackReturn`](#callbackreturn)\<`Out`\>

***

### PipeFnAsync()

> **PipeFnAsync**\<`In`, `Out`\> = (`tuple`) => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`Out`\>\>

Defined in: [types/outcome.ts:123](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L123)

Asynchronous pipe function type.
Receives a ResultTuple and returns a Promise of CallbackReturn.

#### Type Parameters

##### In

`In`

Input value type

##### Out

`Out`

Output value type

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

#### Returns

`Promise`\<[`CallbackReturn`](#callbackreturn)\<`Out`\>\>

***

### ResultTuple

> **ResultTuple**\<`T`\> = \[`T`, `null`\] \| \[`null`, [`Err`](err.md#err)\]

Defined in: [types/outcome.ts:83](https://github.com/pencroff-lab/kore/blob/00b62ec68bfff9d4947401cc5a90c56603ece8c5/src/types/outcome.ts#L83)

Tuple-based result with positional semantics.
- `[T, null]`: success with value
- `[null, Err]`: error

#### Type Parameters

##### T

`T`

#### Example

```typescript
function divide(a: number, b: number): ResultTuple<number> {
  if (b === 0) return [null, Err.from('Division by zero')];
  return [a / b, null];
}

const [result, err] = divide(10, 2);
if (err) console.error(err.message);
else console.log(result); // 5
```
