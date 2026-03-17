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
- **Hierarchical codes** — colon-separated segments (`AUTH:TOKEN:EXPIRED`) enable prefix matching.
- **Cause chains** — `wrap()` links errors into a chain queryable via `root`, `chain()`, and `unwrap()`.
- **Aggregation** — `aggregate()` / `add()` collect multiple independent errors under one parent.

## See

[err.examples.test.ts](../../src/types/err.examples.test.ts) for usage patterns

## Classes

### Err

Defined in: [types/err.ts:34](../../src/types/err.ts#L34)

A value-based error type that supports wrapping, aggregation, and serialization.

All instances are immutable - methods return new instances rather than mutating.

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [types/err.ts:51](../../src/types/err.ts#L51)

Error code for programmatic handling

##### isErr

> `readonly` **isErr**: `true`

Defined in: [types/err.ts:45](../../src/types/err.ts#L45)

Discriminator property for type narrowing.
Always `true` for Err instances.

##### kind

> `readonly` **kind**: `"Err"` = `"Err"`

Defined in: [types/err.ts:39](../../src/types/err.ts#L39)

Discriminator property for type narrowing.
Always "Err" for Err instances.

##### message

> `readonly` **message**: `string`

Defined in: [types/err.ts:48](../../src/types/err.ts#L48)

Human-readable error message

##### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.ts:54](../../src/types/err.ts#L54)

Additional contextual data

##### timestamp

> `readonly` **timestamp**: `string`

Defined in: [types/err.ts:61](../../src/types/err.ts#L61)

Timestamp when the error was created (ISO 8601 string).

Stored as string for easy serialization and comparison.

#### Accessors

##### count

###### Get Signature

> **get** **count**(): `number`

Defined in: [types/err.ts:549](../../src/types/err.ts#L549)

Total count of errors (including nested aggregates).

###### Returns

`number`

##### errors

###### Get Signature

> **get** **errors**(): readonly [`Err`](#err)[]

Defined in: [types/err.ts:559](../../src/types/err.ts#L559)

Direct child errors (for aggregates).

###### Returns

readonly [`Err`](#err)[]

##### isAggregate

###### Get Signature

> **get** **isAggregate**(): `boolean`

Defined in: [types/err.ts:542](../../src/types/err.ts#L542)

Whether this error is an aggregate containing multiple errors.

###### Returns

`boolean`

##### root

###### Get Signature

> **get** **root**(): [`Err`](#err)

Defined in: [types/err.ts:566](../../src/types/err.ts#L566)

The root/original error in a wrapped error chain.

###### Returns

[`Err`](#err)

##### stack

###### Get Signature

> **get** **stack**(): `string` \| `undefined`

Defined in: [types/err.ts:906](../../src/types/err.ts#L906)

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

Defined in: [types/err.ts:512](../../src/types/err.ts#L512)

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

Defined in: [types/err.ts:531](../../src/types/err.ts#L531)

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

Defined in: [types/err.ts:584](../../src/types/err.ts#L584)

Get the full chain of wrapped errors from root to current.

###### Returns

[`Err`](#err)[]

Array of Err instances in causal order

##### filter()

> **filter**(`predicate`): [`Err`](#err)[]

Defined in: [types/err.ts:671](../../src/types/err.ts#L671)

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

Defined in: [types/err.ts:651](../../src/types/err.ts#L651)

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

Defined in: [types/err.ts:599](../../src/types/err.ts#L599)

Flatten all errors into a single array.

###### Returns

[`Err`](#err)[]

Flattened array of all individual errors

##### getMetadata()

###### Call Signature

> **getMetadata**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [types/err.ts:450](../../src/types/err.ts#L450)

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

Defined in: [types/err.ts:451](../../src/types/err.ts#L451)

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

> **hasCode**(`code`): `boolean`

Defined in: [types/err.ts:616](../../src/types/err.ts#L616)

Check if this error or any error in its chain/aggregate has a specific code.

###### Parameters

###### code

`string`

The error code to search for

###### Returns

`boolean`

`true` if the code is found anywhere in the error tree

##### hasCodePrefix()

> **hasCodePrefix**(`prefix`, `boundary?`): `boolean`

Defined in: [types/err.ts:630](../../src/types/err.ts#L630)

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

Defined in: [types/err.ts:424](../../src/types/err.ts#L424)

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

Defined in: [types/err.ts:470](../../src/types/err.ts#L470)

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

Defined in: [types/err.ts:881](../../src/types/err.ts#L881)

Convert to a native Error for interop with throw-based APIs.

###### Returns

`Error`

Native Error instance

##### toJSON()

> **toJSON**(`options?`): [`ErrJSON`](#errjson)

Defined in: [types/err.ts:695](../../src/types/err.ts#L695)

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

Defined in: [types/err.ts:803](../../src/types/err.ts#L803)

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

Defined in: [types/err.ts:575](../../src/types/err.ts#L575)

Get the directly wrapped error (one level up).

###### Returns

[`Err`](#err) \| `undefined`

The wrapped Err or undefined

##### withCode()

> **withCode**(`code`): [`Err`](#err)

Defined in: [types/err.ts:384](../../src/types/err.ts#L384)

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

Defined in: [types/err.ts:401](../../src/types/err.ts#L401)

Create a new Err with additional metadata.

###### Parameters

###### metadata

`Record`\<`string`, `unknown`\>

Key-value pairs to add to metadata

###### Returns

[`Err`](#err)

New Err instance with merged metadata

##### wrap()

> **wrap**(`context`): [`Err`](#err)

Defined in: [types/err.ts:368](../../src/types/err.ts#L368)

Wrap this error with additional context.

###### Parameters

###### context

Either a message string or full options object

`string` | [`ErrOptions`](#erroptions)

###### Returns

[`Err`](#err)

New Err instance with this error as cause

###### See

[Err.wrap](#wrap-1) for the static version (useful in catch blocks)

##### aggregate()

> `static` **aggregate**(`message`, `errors?`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:246](../../src/types/err.ts#L246)

Create an aggregate error for collecting multiple errors.

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

##### from()

###### Call Signature

> `static` **from**(`message`, `code?`): [`Err`](#err)

Defined in: [types/err.ts:120](../../src/types/err.ts#L120)

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

Defined in: [types/err.ts:129](../../src/types/err.ts#L129)

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

Defined in: [types/err.ts:140](../../src/types/err.ts#L140)

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

Defined in: [types/err.ts:149](../../src/types/err.ts#L149)

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

Defined in: [types/err.ts:158](../../src/types/err.ts#L158)

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

Defined in: [types/err.ts:268](../../src/types/err.ts#L268)

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

Defined in: [types/err.ts:345](../../src/types/err.ts#L345)

Type guard to check if a value is an Err instance.

###### Parameters

###### value

`unknown`

Any value to check

###### Returns

`value is Err`

`true` if value is an Err instance

##### wrap()

> `static` **wrap**(`message`, `error`, `options?`): [`Err`](#err)

Defined in: [types/err.ts:225](../../src/types/err.ts#L225)

Static convenience method to wrap an error with a context message.

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

## Interfaces

### ErrJSON

Defined in: [types/err.types.ts:33](../../src/types/err.types.ts#L33)

Wire shape of a serialized Err for cross-boundary transport.
Reconstruct via `Err.fromJSON()`.

#### Properties

##### cause?

> `optional` **cause**: [`ErrJSON`](#errjson)

Defined in: [types/err.types.ts:41](../../src/types/err.types.ts#L41)

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:37](../../src/types/err.types.ts#L37)

##### errors

> **errors**: [`ErrJSON`](#errjson)[]

Defined in: [types/err.types.ts:42](../../src/types/err.types.ts#L42)

##### isErr?

> `optional` **isErr**: `boolean`

Defined in: [types/err.types.ts:36](../../src/types/err.types.ts#L36)

##### kind?

> `optional` **kind**: `"Err"`

Defined in: [types/err.types.ts:35](../../src/types/err.types.ts#L35)

##### message

> **message**: `string`

Defined in: [types/err.types.ts:34](../../src/types/err.types.ts#L34)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:38](../../src/types/err.types.ts#L38)

##### stack?

> `optional` **stack**: `string`

Defined in: [types/err.types.ts:40](../../src/types/err.types.ts#L40)

##### timestamp

> **timestamp**: `string`

Defined in: [types/err.types.ts:39](../../src/types/err.types.ts#L39)

***

### ErrJSONOptions

Defined in: [types/err.types.ts:49](../../src/types/err.types.ts#L49)

Controls which fields ErrJSON includes.
Omit sensitive fields at public API boundaries.

#### Properties

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:53](../../src/types/err.types.ts#L53)

Include metadata.

###### Default

```ts
true
```

##### stack?

> `optional` **stack**: `boolean`

Defined in: [types/err.types.ts:51](../../src/types/err.types.ts#L51)

Include stack trace.

###### Default

```ts
true
```

***

### ErrOptions

Defined in: [types/err.types.ts:18](../../src/types/err.types.ts#L18)

Options for creating or modifying an Err instance.

#### Properties

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:20](../../src/types/err.types.ts#L20)

Error code for programmatic handling

##### message?

> `optional` **message**: `string`

Defined in: [types/err.types.ts:22](../../src/types/err.types.ts#L22)

Human-readable error message

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:24](../../src/types/err.types.ts#L24)

Additional contextual data attached to this error level only

***

### ToStringOptions

Defined in: [types/err.types.ts:61](../../src/types/err.types.ts#L61)

Controls `Err.toString()` output for logging and debugging.

#### Properties

##### date?

> `optional` **date**: `boolean`

Defined in: [types/err.types.ts:65](../../src/types/err.types.ts#L65)

ISO 8601 timestamp prefix.

###### Default

```ts
false
```

##### indent?

> `optional` **indent**: `string`

Defined in: [types/err.types.ts:71](../../src/types/err.types.ts#L71)

Indentation per nesting level.

###### Default

```ts
"  "
```

##### maxDepth?

> `optional` **maxDepth**: `number`

Defined in: [types/err.types.ts:69](../../src/types/err.types.ts#L69)

Max cause chain depth before truncation.

###### Default

```ts
undefined (unlimited)
```

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:67](../../src/types/err.types.ts#L67)

Inline metadata object.

###### Default

```ts
false
```

##### stack?

> `optional` **stack**: `number` \| `boolean`

Defined in: [types/err.types.ts:63](../../src/types/err.types.ts#L63)

`true` = full stack, `number` = top N frames.

###### Default

```ts
undefined
```

## Type Aliases

### ErrCode

> **ErrCode** = `string`

Defined in: [types/err.types.ts:13](../../src/types/err.types.ts#L13)

Uppercase snake_case identifier for programmatic error handling.
Supports hierarchical codes for prefix matching: 'AUTH:TOKEN:EXPIRED'.

#### See

[Err.hasCode](#hascode) for prefix-based matching behavior
