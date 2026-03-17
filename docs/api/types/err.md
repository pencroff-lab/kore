[**@pencroff-lab/kore**](../README.md)

***

[@pencroff-lab/kore](../README.md) / types/err

# types/err

## Classes

### Err

Defined in: [types/err.ts:22](../../src/types/err.ts#L22)

A value-based error type that supports wrapping, aggregation, and serialization.

All instances are immutable - methods return new instances rather than mutating.

#### Properties

##### code?

> `readonly` `optional` **code**: `string`

Defined in: [types/err.ts:39](../../src/types/err.ts#L39)

Error code for programmatic handling

##### isErr

> `readonly` **isErr**: `true`

Defined in: [types/err.ts:33](../../src/types/err.ts#L33)

Discriminator property for type narrowing.
Always `true` for Err instances.

##### kind

> `readonly` **kind**: `"Err"` = `"Err"`

Defined in: [types/err.ts:27](../../src/types/err.ts#L27)

Discriminator property for type narrowing.
Always "Err" for Err instances.

##### message

> `readonly` **message**: `string`

Defined in: [types/err.ts:36](../../src/types/err.ts#L36)

Human-readable error message

##### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.ts:42](../../src/types/err.ts#L42)

Additional contextual data

##### timestamp

> `readonly` **timestamp**: `string`

Defined in: [types/err.ts:49](../../src/types/err.ts#L49)

Timestamp when the error was created (ISO 8601 string).

Stored as string for easy serialization and comparison.

#### Accessors

##### count

###### Get Signature

> **get** **count**(): `number`

Defined in: [types/err.ts:537](../../src/types/err.ts#L537)

Total count of errors (including nested aggregates).

###### Returns

`number`

##### errors

###### Get Signature

> **get** **errors**(): readonly [`Err`](#err)[]

Defined in: [types/err.ts:547](../../src/types/err.ts#L547)

Direct child errors (for aggregates).

###### Returns

readonly [`Err`](#err)[]

##### isAggregate

###### Get Signature

> **get** **isAggregate**(): `boolean`

Defined in: [types/err.ts:530](../../src/types/err.ts#L530)

Whether this error is an aggregate containing multiple errors.

###### Returns

`boolean`

##### root

###### Get Signature

> **get** **root**(): [`Err`](#err)

Defined in: [types/err.ts:554](../../src/types/err.ts#L554)

The root/original error in a wrapped error chain.

###### Returns

[`Err`](#err)

##### stack

###### Get Signature

> **get** **stack**(): `string` \| `undefined`

Defined in: [types/err.ts:894](../../src/types/err.ts#L894)

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

Defined in: [types/err.ts:500](../../src/types/err.ts#L500)

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

Defined in: [types/err.ts:519](../../src/types/err.ts#L519)

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

Defined in: [types/err.ts:572](../../src/types/err.ts#L572)

Get the full chain of wrapped errors from root to current.

###### Returns

[`Err`](#err)[]

Array of Err instances in causal order

##### filter()

> **filter**(`predicate`): [`Err`](#err)[]

Defined in: [types/err.ts:659](../../src/types/err.ts#L659)

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

Defined in: [types/err.ts:639](../../src/types/err.ts#L639)

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

Defined in: [types/err.ts:587](../../src/types/err.ts#L587)

Flatten all errors into a single array.

###### Returns

[`Err`](#err)[]

Flattened array of all individual errors

##### getMetadata()

###### Call Signature

> **getMetadata**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [types/err.ts:438](../../src/types/err.ts#L438)

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

###### defaultValue

`T`

Optional default value if key is missing

###### Returns

`T`

The metadata value or default, cast to type T

##### hasCode()

> **hasCode**(`code`): `boolean`

Defined in: [types/err.ts:604](../../src/types/err.ts#L604)

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

Defined in: [types/err.ts:618](../../src/types/err.ts#L618)

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

Defined in: [types/err.ts:412](../../src/types/err.ts#L412)

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

Defined in: [types/err.ts:458](../../src/types/err.ts#L458)

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

Defined in: [types/err.ts:869](../../src/types/err.ts#L869)

Convert to a native Error for interop with throw-based APIs.

###### Returns

`Error`

Native Error instance

##### toJSON()

> **toJSON**(`options?`): [`ErrJSON`](#errjson)

Defined in: [types/err.ts:683](../../src/types/err.ts#L683)

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

Defined in: [types/err.ts:791](../../src/types/err.ts#L791)

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

Defined in: [types/err.ts:563](../../src/types/err.ts#L563)

Get the directly wrapped error (one level up).

###### Returns

[`Err`](#err) \| `undefined`

The wrapped Err or undefined

##### withCode()

> **withCode**(`code`): [`Err`](#err)

Defined in: [types/err.ts:372](../../src/types/err.ts#L372)

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

Defined in: [types/err.ts:389](../../src/types/err.ts#L389)

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

Defined in: [types/err.ts:356](../../src/types/err.ts#L356)

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

Defined in: [types/err.ts:234](../../src/types/err.ts#L234)

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

Defined in: [types/err.ts:108](../../src/types/err.ts#L108)

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

Defined in: [types/err.ts:117](../../src/types/err.ts#L117)

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

Defined in: [types/err.ts:128](../../src/types/err.ts#L128)

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

Defined in: [types/err.ts:137](../../src/types/err.ts#L137)

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

Defined in: [types/err.ts:146](../../src/types/err.ts#L146)

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

Defined in: [types/err.ts:256](../../src/types/err.ts#L256)

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

Defined in: [types/err.ts:333](../../src/types/err.ts#L333)

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

Defined in: [types/err.ts:213](../../src/types/err.ts#L213)

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

Defined in: [types/err.types.ts:50](../../src/types/err.types.ts#L50)

Wire shape of a serialized Err for cross-boundary transport.
Reconstruct via `Err.fromJSON()`.

#### Properties

##### cause?

> `optional` **cause**: [`ErrJSON`](#errjson)

Defined in: [types/err.types.ts:58](../../src/types/err.types.ts#L58)

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:54](../../src/types/err.types.ts#L54)

##### errors

> **errors**: [`ErrJSON`](#errjson)[]

Defined in: [types/err.types.ts:59](../../src/types/err.types.ts#L59)

##### isErr?

> `optional` **isErr**: `boolean`

Defined in: [types/err.types.ts:53](../../src/types/err.types.ts#L53)

##### kind?

> `optional` **kind**: `"Err"`

Defined in: [types/err.types.ts:52](../../src/types/err.types.ts#L52)

##### message

> **message**: `string`

Defined in: [types/err.types.ts:51](../../src/types/err.types.ts#L51)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:55](../../src/types/err.types.ts#L55)

##### stack?

> `optional` **stack**: `string`

Defined in: [types/err.types.ts:57](../../src/types/err.types.ts#L57)

##### timestamp

> **timestamp**: `string`

Defined in: [types/err.types.ts:56](../../src/types/err.types.ts#L56)

***

### ErrJSONOptions

Defined in: [types/err.types.ts:66](../../src/types/err.types.ts#L66)

Controls which fields ErrJSON includes.
Omit sensitive fields at public API boundaries.

#### Properties

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:70](../../src/types/err.types.ts#L70)

Include metadata.

###### Default

```ts
true
```

##### stack?

> `optional` **stack**: `boolean`

Defined in: [types/err.types.ts:68](../../src/types/err.types.ts#L68)

Include stack trace.

###### Default

```ts
true
```

***

### ErrOptions

Defined in: [types/err.types.ts:35](../../src/types/err.types.ts#L35)

Options for creating or modifying an Err instance.

#### Properties

##### code?

> `optional` **code**: `string`

Defined in: [types/err.types.ts:37](../../src/types/err.types.ts#L37)

Error code for programmatic handling

##### message?

> `optional` **message**: `string`

Defined in: [types/err.types.ts:39](../../src/types/err.types.ts#L39)

Human-readable error message

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [types/err.types.ts:41](../../src/types/err.types.ts#L41)

Additional contextual data attached to this error level only

***

### ToStringOptions

Defined in: [types/err.types.ts:78](../../src/types/err.types.ts#L78)

Controls `Err.toString()` output for logging and debugging.

#### Properties

##### date?

> `optional` **date**: `boolean`

Defined in: [types/err.types.ts:82](../../src/types/err.types.ts#L82)

ISO 8601 timestamp prefix.

###### Default

```ts
false
```

##### indent?

> `optional` **indent**: `string`

Defined in: [types/err.types.ts:88](../../src/types/err.types.ts#L88)

Indentation per nesting level.

###### Default

```ts
"  "
```

##### maxDepth?

> `optional` **maxDepth**: `number`

Defined in: [types/err.types.ts:86](../../src/types/err.types.ts#L86)

Max cause chain depth before truncation.

###### Default

```ts
undefined (unlimited)
```

##### metadata?

> `optional` **metadata**: `boolean`

Defined in: [types/err.types.ts:84](../../src/types/err.types.ts#L84)

Inline metadata object.

###### Default

```ts
false
```

##### stack?

> `optional` **stack**: `number` \| `boolean`

Defined in: [types/err.types.ts:80](../../src/types/err.types.ts#L80)

`true` = full stack, `number` = top N frames.

###### Default

```ts
undefined
```

## Type Aliases

### ErrCode

> **ErrCode** = `string`

Defined in: [types/err.types.ts:30](../../src/types/err.types.ts#L30)

Uppercase snake_case identifier for programmatic error handling.
Supports hierarchical codes for prefix matching: 'AUTH:TOKEN:EXPIRED'.

#### See

[Err.hasCode](#hascode) for prefix-based matching behavior
