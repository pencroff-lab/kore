[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / err

# err

Immutable, value-based error type with wrapping and aggregation.

## See

err.examples.test.ts for usage patterns

## Classes

### Err

Defined in: [types/err.ts:23](../../src/types/err.ts#L23)

A value-based error type that supports wrapping, aggregation, and serialization.

All instances are immutable - methods return new instances rather than mutating.

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [types/err.ts:40](../../src/types/err.ts#L40)

Error code for programmatic handling

##### isErr

> `readonly` **isErr**: `true`

Defined in: [types/err.ts:34](../../src/types/err.ts#L34)

Discriminator property for type narrowing.
Always `true` for Err instances.

##### kind

> `readonly` **kind**: `"Err"` = `"Err"`

Defined in: [types/err.ts:28](../../src/types/err.ts#L28)

Discriminator property for type narrowing.
Always "Err" for Err instances.

##### message

> `readonly` **message**: `string`

Defined in: [types/err.ts:37](../../src/types/err.ts#L37)

Human-readable error message

##### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.ts:43](../../src/types/err.ts#L43)

Additional contextual data

##### timestamp

> `readonly` **timestamp**: `string`

Defined in: [types/err.ts:50](../../src/types/err.ts#L50)

Timestamp when the error was created (ISO 8601 string).

Stored as string for easy serialization and comparison.

#### Accessors

##### count

###### Get Signature

> **get** **count**(): `number`

Defined in: [types/err.ts:538](../../src/types/err.ts#L538)

Total count of errors (including nested aggregates).

###### Returns

`number`

##### errors

###### Get Signature

> **get** **errors**(): readonly [`Err`](#err)[]

Defined in: [types/err.ts:548](../../src/types/err.ts#L548)

Direct child errors (for aggregates).

###### Returns

readonly [`Err`](#err)[]

##### isAggregate

###### Get Signature

> **get** **isAggregate**(): `boolean`

Defined in: [types/err.ts:531](../../src/types/err.ts#L531)

Whether this error is an aggregate containing multiple errors.

###### Returns

`boolean`

##### root

###### Get Signature

> **get** **root**(): [`Err`](#err)

Defined in: [types/err.ts:555](../../src/types/err.ts#L555)

The root/original error in a wrapped error chain.

###### Returns

[`Err`](#err)

##### stack

###### Get Signature

> **get** **stack**(): `string` \| `undefined`

Defined in: [types/err.ts:895](../../src/types/err.ts#L895)

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

Defined in: [types/err.ts:501](../../src/types/err.ts#L501)

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

Defined in: [types/err.ts:520](../../src/types/err.ts#L520)

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

Defined in: [types/err.ts:573](../../src/types/err.ts#L573)

Get the full chain of wrapped errors from root to current.

###### Returns

[`Err`](#err)[]

Array of Err instances in causal order

##### filter()

> **filter**(`predicate`): [`Err`](#err)[]

Defined in: [types/err.ts:660](../../src/types/err.ts#L660)

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

Defined in: [types/err.ts:640](../../src/types/err.ts#L640)

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

Defined in: [types/err.ts:588](../../src/types/err.ts#L588)

Flatten all errors into a single array.

###### Returns

[`Err`](#err)[]

Flattened array of all individual errors

##### getMetadata()

###### Call Signature

> **getMetadata**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [types/err.ts:439](../../src/types/err.ts#L439)

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

Defined in: [types/err.ts:440](../../src/types/err.ts#L440)

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

Defined in: [types/err.ts:605](../../src/types/err.ts#L605)

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

Defined in: [types/err.ts:619](../../src/types/err.ts#L619)

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

Defined in: [types/err.ts:413](../../src/types/err.ts#L413)

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

Defined in: [types/err.ts:459](../../src/types/err.ts#L459)

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

Defined in: [types/err.ts:870](../../src/types/err.ts#L870)

Convert to a native Error for interop with throw-based APIs.

###### Returns

`Error`

Native Error instance

##### toJSON()

> **toJSON**(`options?`): [`ErrJSON`](#errjson)

Defined in: [types/err.ts:684](../../src/types/err.ts#L684)

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

Defined in: [types/err.ts:792](../../src/types/err.ts#L792)

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

Defined in: [types/err.ts:564](../../src/types/err.ts#L564)

Get the directly wrapped error (one level up).

###### Returns

[`Err`](#err) \| `undefined`

The wrapped Err or undefined

##### withCode()

> **withCode**(`code`): [`Err`](#err)

Defined in: [types/err.ts:373](../../src/types/err.ts#L373)

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

Defined in: [types/err.ts:390](../../src/types/err.ts#L390)

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

Defined in: [types/err.ts:357](../../src/types/err.ts#L357)

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

Defined in: [types/err.ts:235](../../src/types/err.ts#L235)

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

Defined in: [types/err.ts:109](../../src/types/err.ts#L109)

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

Defined in: [types/err.ts:118](../../src/types/err.ts#L118)

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

Defined in: [types/err.ts:129](../../src/types/err.ts#L129)

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

Defined in: [types/err.ts:138](../../src/types/err.ts#L138)

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

Defined in: [types/err.ts:147](../../src/types/err.ts#L147)

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

Defined in: [types/err.ts:334](../../src/types/err.ts#L334)

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

Defined in: [types/err.ts:214](../../src/types/err.ts#L214)

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

Defined in: [types/err.types.ts:35](../../src/types/err.types.ts#L35)

Wire shape of a serialized Err for cross-boundary transport.
Reconstruct via `Err.fromJSON()`.

#### Properties

##### cause?

> `optional` **cause**: [`ErrJSON`](#errjson)

Defined in: [types/err.types.ts:43](../../src/types/err.types.ts#L43)

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:39](../../src/types/err.types.ts#L39)

##### errors

> **errors**: [`ErrJSON`](#errjson)[]

Defined in: [types/err.types.ts:44](../../src/types/err.types.ts#L44)

##### isErr?

> `optional` **isErr**: `boolean`

Defined in: [types/err.types.ts:38](../../src/types/err.types.ts#L38)

##### kind?

> `optional` **kind**: `"Err"`

Defined in: [types/err.types.ts:37](../../src/types/err.types.ts#L37)

##### message

> **message**: `string`

Defined in: [types/err.types.ts:36](../../src/types/err.types.ts#L36)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:40](../../src/types/err.types.ts#L40)

##### stack?

> `optional` **stack**: `string`

Defined in: [types/err.types.ts:42](../../src/types/err.types.ts#L42)

##### timestamp

> **timestamp**: `string`

Defined in: [types/err.types.ts:41](../../src/types/err.types.ts#L41)

***

### ErrJSONOptions

Defined in: [types/err.types.ts:51](../../src/types/err.types.ts#L51)

Controls which fields ErrJSON includes.
Omit sensitive fields at public API boundaries.

#### Properties

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:55](../../src/types/err.types.ts#L55)

Include metadata.

###### Default

```ts
true
```

##### stack?

> `optional` **stack**: `boolean`

Defined in: [types/err.types.ts:53](../../src/types/err.types.ts#L53)

Include stack trace.

###### Default

```ts
true
```

***

### ErrOptions

Defined in: [types/err.types.ts:20](../../src/types/err.types.ts#L20)

Options for creating or modifying an Err instance.

#### Properties

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:22](../../src/types/err.types.ts#L22)

Error code for programmatic handling

##### message?

> `optional` **message**: `string`

Defined in: [types/err.types.ts:24](../../src/types/err.types.ts#L24)

Human-readable error message

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:26](../../src/types/err.types.ts#L26)

Additional contextual data attached to this error level only

***

### ToStringOptions

Defined in: [types/err.types.ts:63](../../src/types/err.types.ts#L63)

Controls `Err.toString()` output for logging and debugging.

#### Properties

##### date?

> `optional` **date**: `boolean`

Defined in: [types/err.types.ts:67](../../src/types/err.types.ts#L67)

ISO 8601 timestamp prefix.

###### Default

```ts
false
```

##### indent?

> `optional` **indent**: `string`

Defined in: [types/err.types.ts:73](../../src/types/err.types.ts#L73)

Indentation per nesting level.

###### Default

```ts
"  "
```

##### maxDepth?

> `optional` **maxDepth**: `number`

Defined in: [types/err.types.ts:71](../../src/types/err.types.ts#L71)

Max cause chain depth before truncation.

###### Default

```ts
undefined (unlimited)
```

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:69](../../src/types/err.types.ts#L69)

Inline metadata object.

###### Default

```ts
false
```

##### stack?

> `optional` **stack**: `number` \| `boolean`

Defined in: [types/err.types.ts:65](../../src/types/err.types.ts#L65)

`true` = full stack, `number` = top N frames.

###### Default

```ts
undefined
```

## Type Aliases

### ErrCode

> **ErrCode** = `string`

Defined in: [types/err.types.ts:15](../../src/types/err.types.ts#L15)

Uppercase snake_case identifier for programmatic error handling.
Supports hierarchical codes for prefix matching: 'AUTH:TOKEN:EXPIRED'.

#### See

[Err.hasCode](#hascode) for prefix-based matching behavior
