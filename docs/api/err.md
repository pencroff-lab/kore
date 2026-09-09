[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / err

# err

Value-based error handling inspired by Go's explicit error returns.

`Err` replaces thrown exceptions with immutable error values that carry
context (codes, metadata, timestamps) and compose via wrapping and
aggregation. Because every `Err` is a plain value, errors flow through
the type system — no `try/catch` needed.

**Key concepts:**
- **Immutability** — every mutating method (`wrap`, `withCode`, `add`) returns a new instance.
  `metadata` is copied on construction and frozen, so neither the caller's original
  object nor a cast can write into it. The copy and freeze are shallow: values nested
  inside `metadata` remain the caller's to mutate.
- **Hierarchical codes** — colon-separated segments (`AUTH:TOKEN:EXPIRED`) enable prefix matching.
- **Cause chains** — `wrap()` links errors into a chain queryable via `root`, `chain()`, and `unwrap()`.
- **Aggregation** — `add()` / `addAll()` collect multiple independent errors under one parent.

## See

[err.examples.test.ts](../../src/types/err.examples.test.ts) for usage patterns

## Classes

### Err

Defined in: [types/err.ts:38](../../src/types/err.ts#L38)

A value-based error type that supports wrapping, aggregation, and serialization.

All instances are immutable - methods return new instances rather than mutating.
`metadata` is copied and frozen on construction (shallowly - nested values are not).

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [types/err.ts:55](../../src/types/err.ts#L55)

Error code for programmatic handling

##### isErr

> `readonly` **isErr**: `true`

Defined in: [types/err.ts:49](../../src/types/err.ts#L49)

Discriminator property for type narrowing.
Always `true` for Err instances.

##### kind

> `readonly` **kind**: `"Err"` = `"Err"`

Defined in: [types/err.ts:43](../../src/types/err.ts#L43)

Discriminator property for type narrowing.
Always "Err" for Err instances.

##### message

> `readonly` **message**: `string`

Defined in: [types/err.ts:52](../../src/types/err.ts#L52)

Human-readable error message

##### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.ts:58](../../src/types/err.ts#L58)

Additional contextual data. Frozen; nested values are not.

##### timestamp

> `readonly` **timestamp**: `string`

Defined in: [types/err.ts:65](../../src/types/err.ts#L65)

Timestamp when the error was created (ISO 8601 string).

Stored as string for easy serialization and comparison.

#### Accessors

##### errors

###### Get Signature

> **get** **errors**(): readonly [`Err`](#err)[]

Defined in: [types/err.ts:535](../../src/types/err.ts#L535)

Direct child errors (for aggregates).

###### Returns

readonly [`Err`](#err)[]

##### isAggregate

###### Get Signature

> **get** **isAggregate**(): `boolean`

Defined in: [types/err.ts:528](../../src/types/err.ts#L528)

Whether this error is an aggregate containing multiple errors.

###### Returns

`boolean`

##### root

###### Get Signature

> **get** **root**(): [`Err`](#err)

Defined in: [types/err.ts:542](../../src/types/err.ts#L542)

The root/original error in a wrapped error chain.

###### Returns

[`Err`](#err)

##### stack

###### Get Signature

> **get** **stack**(): `string` \| `undefined`

Defined in: [types/err.ts:923](../../src/types/err.ts#L923)

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

Defined in: [types/err.ts:498](../../src/types/err.ts#L498)

Add an error to this aggregate.

###### Parameters

###### error

Error to add (Err, Error, or string)

`string` | [`Err`](#err) | `Error`

###### Returns

[`Err`](#err)

New Err instance with the error added

##### addAll()

> **addAll**(`errors`): [`Err`](#err)

Defined in: [types/err.ts:517](../../src/types/err.ts#L517)

Add multiple errors to this aggregate at once.

###### Parameters

###### errors

(`string` \| [`Err`](#err) \| `Error`)[]

Array of errors to add

###### Returns

[`Err`](#err)

New Err instance with all errors added

##### chain()

> **chain**(): [`Err`](#err)[]

Defined in: [types/err.ts:560](../../src/types/err.ts#L560)

Get the full chain of wrapped errors from root to current.

###### Returns

[`Err`](#err)[]

Array of Err instances in causal order

##### filter()

> **filter**(`predicate`): [`Err`](#err)[]

Defined in: [types/err.ts:648](../../src/types/err.ts#L648)

Find all errors matching a predicate.

###### Parameters

###### predicate

(`e`) => `boolean`

Function to test each error

###### Returns

[`Err`](#err)[]

Array of all matching Err instances

##### find()

> **find**(`predicate`): [`Err`](#err) \| `undefined`

Defined in: [types/err.ts:628](../../src/types/err.ts#L628)

Find the first error matching a predicate.

###### Parameters

###### predicate

(`e`) => `boolean`

Function to test each error

###### Returns

[`Err`](#err) \| `undefined`

The first matching Err or undefined

##### flatten()

> **flatten**(): [`Err`](#err)[]

Defined in: [types/err.ts:575](../../src/types/err.ts#L575)

Flatten all errors into a single array.

###### Returns

[`Err`](#err)[]

Flattened array of all individual errors

##### getMetadata()

###### Call Signature

> **getMetadata**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [types/err.ts:436](../../src/types/err.ts#L436)

Get metadata value for a given key.

###### Type Parameters

###### T

`T` = `unknown`

The expected type of the metadata value

###### Parameters

###### key

`string`

The metadata key to retrieve

###### Returns

`T` \| `undefined`

The metadata value or default, cast to type T

###### Call Signature

> **getMetadata**\<`T`\>(`key`, `defaultValue`): `T`

Defined in: [types/err.ts:437](../../src/types/err.ts#L437)

Get metadata value for a given key.

###### Type Parameters

###### T

`T` = `unknown`

The expected type of the metadata value

###### Parameters

###### key

`string`

The metadata key to retrieve

###### defaultValue

`T`

Optional default value if key is missing

###### Returns

`T`

The metadata value or default, cast to type T

##### hasCode()

###### Call Signature

> **hasCode**(): `boolean`

Defined in: [types/err.ts:593](../../src/types/err.ts#L593)

Check if this error or any error in its chain/aggregate has a specific code,
or — when called with no argument — whether any code is present in the tree.

###### Returns

`boolean`

`true` if the code is found (or any code exists, when called with no argument)

###### Call Signature

> **hasCode**(`code`): `boolean`

Defined in: [types/err.ts:594](../../src/types/err.ts#L594)

Check if this error or any error in its chain/aggregate has a specific code,
or — when called with no argument — whether any code is present in the tree.

###### Parameters

###### code

`string`

The error code to search for. Omit to check for the presence of any code.

###### Returns

`boolean`

`true` if the code is found (or any code exists, when called with no argument)

##### hasCodePrefix()

> **hasCodePrefix**(`prefix`, `boundary?`): `boolean`

Defined in: [types/err.ts:607](../../src/types/err.ts#L607)

Check if this error or any error in its chain/aggregate has a code matching the given prefix.

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

##### hasMetadata()

> **hasMetadata**(`key`, `options?`): `boolean`

Defined in: [types/err.ts:410](../../src/types/err.ts#L410)

Check if metadata exists for a given key.

###### Parameters

###### key

`string`

The metadata key to check

###### options?

Optional configuration

###### keyCheck?

`boolean`

If true, only checks key existence (default: false)

###### Returns

`boolean`

true if metadata exists according to the selected mode

##### omitMetadata()

> **omitMetadata**(`key`): [`Err`](#err)

Defined in: [types/err.ts:456](../../src/types/err.ts#L456)

Create a new Err instance with specified metadata keys removed.

###### Parameters

###### key

Single key or array of keys to remove

`string` | `string`[]

###### Returns

[`Err`](#err)

New Err instance with keys omitted

##### toError()

> **toError**(): `Error`

Defined in: [types/err.ts:898](../../src/types/err.ts#L898)

Convert to a native Error for interop with throw-based APIs.

###### Returns

`Error`

Native Error instance

##### toJSON()

> **toJSON**(`options?`): [`ErrJSON`](#errjson)

Defined in: [types/err.ts:672](../../src/types/err.ts#L672)

Convert to a JSON-serializable object.

###### Parameters

###### options?

[`ErrJSONOptions`](#errjsonoptions) = `{}`

Control what fields are included

###### Returns

[`ErrJSON`](#errjson)

Plain object representation

###### See

[fromJSON](#fromjson) for deserializing an Err from JSON

##### toString()

> **toString**(`options?`): `string`

Defined in: [types/err.ts:820](../../src/types/err.ts#L820)

Convert to a formatted string for logging/display.

###### Parameters

###### options?

[`ToStringOptions`](#tostringoptions)

Formatting options (optional)

###### Returns

`string`

Formatted error string

##### unwrap()

> **unwrap**(): [`Err`](#err) \| `undefined`

Defined in: [types/err.ts:551](../../src/types/err.ts#L551)

Get the directly wrapped error (one level up).

###### Returns

[`Err`](#err) \| `undefined`

The wrapped Err or undefined

##### withCode()

> **withCode**(`code`): [`Err`](#err)

Defined in: [types/err.ts:370](../../src/types/err.ts#L370)

Create a new Err with a different or added error code.

###### Parameters

###### code

`string`

The error code to set

###### Returns

[`Err`](#err)

New Err instance with the specified code

##### withMetadata()

> **withMetadata**(`metadata`): [`Err`](#err)

Defined in: [types/err.ts:387](../../src/types/err.ts#L387)

Create a new Err with additional metadata.

###### Parameters

###### metadata

`Record`\<`string`, `unknown`\>

Key-value pairs to add to metadata

###### Returns

[`Err`](#err)

New Err instance with merged metadata

##### wrap()

> **wrap**(`message`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:355](../../src/types/err.ts#L355)

Wrap this error with additional context.

###### Parameters

###### message

`string`

Context message explaining what operation failed

###### options?

[`ErrOptions`](#erroptions)

Optional code and metadata for the wrapper

###### Returns

[`Err`](#err)

New Err instance with this error as cause

##### from()

###### Call Signature

> `static` **from**(`message`, `code?`): [`Err`](#err)

Defined in: [types/err.ts:129](../../src/types/err.ts#L129)

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

###### Call Signature

> `static` **from**(`message`, `options`): [`Err`](#err)

Defined in: [types/err.ts:138](../../src/types/err.ts#L138)

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

###### Call Signature

> `static` **from**(`error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:149](../../src/types/err.ts#L149)

Create an Err from a native Error.

Preserves the original error's stack trace, cause chain, and name.

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

###### Call Signature

> `static` **from**(`error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:158](../../src/types/err.ts#L158)

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

###### Call Signature

> `static` **from**(`error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:167](../../src/types/err.ts#L167)

Create an Err from an unknown value (safe for catch blocks).

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

##### fromJSON()

> `static` **fromJSON**(`json`): [`Err`](#err)

Defined in: [types/err.ts:257](../../src/types/err.ts#L257)

Deserialize an Err from JSON representation.

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

##### isErr()

> `static` **isErr**(`value`): `value is Err`

Defined in: [types/err.ts:340](../../src/types/err.ts#L340)

Type guard to check if a value is an Err instance.

Nominal since v0.7.0: a plain object carrying `kind: "Err"` or `isErr: true`
is data, not an error. Reconstruct one with `Err.from(value)`.

###### Parameters

###### value

`unknown`

Any value to check

###### Returns

`value is Err`

`true` if value is an Err instance

## Interfaces

### ErrJSON

Defined in: [types/err.types.ts:28](../../src/types/err.types.ts#L28)

Wire shape of a serialized Err for cross-boundary transport.
Reconstruct via `Err.fromJSON()`.

#### Properties

##### cause?

> `optional` **cause**: [`ErrJSON`](#errjson)

Defined in: [types/err.types.ts:36](../../src/types/err.types.ts#L36)

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:32](../../src/types/err.types.ts#L32)

##### errors

> **errors**: [`ErrJSON`](#errjson)[]

Defined in: [types/err.types.ts:37](../../src/types/err.types.ts#L37)

##### isErr?

> `optional` **isErr**: `boolean`

Defined in: [types/err.types.ts:31](../../src/types/err.types.ts#L31)

##### kind?

> `optional` **kind**: `"Err"`

Defined in: [types/err.types.ts:30](../../src/types/err.types.ts#L30)

##### message

> **message**: `string`

Defined in: [types/err.types.ts:29](../../src/types/err.types.ts#L29)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:33](../../src/types/err.types.ts#L33)

##### stack?

> `optional` **stack**: `string`

Defined in: [types/err.types.ts:35](../../src/types/err.types.ts#L35)

##### timestamp

> **timestamp**: `string`

Defined in: [types/err.types.ts:34](../../src/types/err.types.ts#L34)

***

### ErrJSONOptions

Defined in: [types/err.types.ts:44](../../src/types/err.types.ts#L44)

Controls which fields ErrJSON includes.
Omit sensitive fields at public API boundaries.

#### Properties

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:48](../../src/types/err.types.ts#L48)

Include metadata.

###### Default

```ts
true
```

##### stack?

> `optional` **stack**: `boolean`

Defined in: [types/err.types.ts:46](../../src/types/err.types.ts#L46)

Include stack trace.

###### Default

```ts
true
```

***

### ErrOptions

Defined in: [types/err.types.ts:13](../../src/types/err.types.ts#L13)

Options for creating or modifying an Err instance.

#### Properties

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:15](../../src/types/err.types.ts#L15)

Error code for programmatic handling

##### message?

> `optional` **message**: `string`

Defined in: [types/err.types.ts:17](../../src/types/err.types.ts#L17)

Human-readable error message

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:19](../../src/types/err.types.ts#L19)

Additional contextual data attached to this error level only

***

### ToStringOptions

Defined in: [types/err.types.ts:56](../../src/types/err.types.ts#L56)

Controls `Err.toString()` output for logging and debugging.

#### Properties

##### date?

> `optional` **date**: `boolean`

Defined in: [types/err.types.ts:60](../../src/types/err.types.ts#L60)

ISO 8601 timestamp prefix.

###### Default

```ts
false
```

##### indent?

> `optional` **indent**: `string`

Defined in: [types/err.types.ts:66](../../src/types/err.types.ts#L66)

Indentation per nesting level.

###### Default

```ts
"  "
```

##### maxDepth?

> `optional` **maxDepth**: `number`

Defined in: [types/err.types.ts:64](../../src/types/err.types.ts#L64)

Max cause chain depth before truncation.

###### Default

```ts
undefined (unlimited)
```

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:62](../../src/types/err.types.ts#L62)

Inline metadata object.

###### Default

```ts
false
```

##### stack?

> `optional` **stack**: `number` \| `boolean`

Defined in: [types/err.types.ts:58](../../src/types/err.types.ts#L58)

`true` = full stack, `number` = top N frames.

###### Default

```ts
undefined
```

## Type Aliases

### ErrCode

> **ErrCode** = `string`

Defined in: [types/err.types.ts:8](../../src/types/err.types.ts#L8)

Uppercase snake_case identifier for programmatic error handling.
Supports hierarchical codes for prefix matching: 'AUTH:TOKEN:EXPIRED'.

#### See

[Err.hasCode](#hascode) for prefix-based matching behavior
