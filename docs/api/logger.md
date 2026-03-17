[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / logger

# logger

Structured logging utility with transport DI and Err integration.

## See

logger.examples.test.ts for usage patterns

## Interfaces

### LogEntry

Defined in: [utils/logger.ts:39](../../src/utils/logger.ts#L39)

A single structured log entry passed to transports.

#### Properties

##### context

> **context**: `Record`\<`string`, `unknown`\>

Defined in: [utils/logger.ts:47](../../src/utils/logger.ts#L47)

Merged bindings + call-site context

##### level

> **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:41](../../src/utils/logger.ts#L41)

Log level

##### message

> **message**: `string`

Defined in: [utils/logger.ts:45](../../src/utils/logger.ts#L45)

Log message

##### modules

> **modules**: `string`[]

Defined in: [utils/logger.ts:49](../../src/utils/logger.ts#L49)

Module chain accumulated by child() calls

##### timestamp

> **timestamp**: `number`

Defined in: [utils/logger.ts:43](../../src/utils/logger.ts#L43)

Unix timestamp in milliseconds (Date.now())

***

### Logger()

Defined in: [utils/logger.ts:107](../../src/utils/logger.ts#L107)

Callable logger interface with overloaded signatures.

The Logger is both a function (for logging) and an object (with level
constants and the `child` method).

## Call Signatures
1. `log(message)` - Log at INFO level
2. `log(message, context)` - Log at INFO level with context object or Err
3. `log(message, detail)` - Log at INFO level with detail string
4. `log(level, message)` - Log at specific level
5. `log(level, message, context)` - Log at specific level with context

#### Call Signature

> **Logger**(`message`): `void`

Defined in: [utils/logger.ts:122](../../src/utils/logger.ts#L122)

Log a message at INFO level.

##### Parameters

###### message

`string`

##### Returns

`void`

#### Call Signature

> **Logger**(`message`, `context`): `void`

Defined in: [utils/logger.ts:124](../../src/utils/logger.ts#L124)

Log a message at INFO level with context.

##### Parameters

###### message

`string`

###### context

`object` | [`Err`](err.md#err)

##### Returns

`void`

#### Call Signature

> **Logger**(`message`, `detail`): `void`

Defined in: [utils/logger.ts:126](../../src/utils/logger.ts#L126)

Log a message at INFO level with detail string.

##### Parameters

###### message

`string`

###### detail

`string`

##### Returns

`void`

#### Call Signature

> **Logger**(`level`, `message`): `void`

Defined in: [utils/logger.ts:128](../../src/utils/logger.ts#L128)

Log a message at a specific level.

##### Parameters

###### level

[`LevelValue`](#levelvalue)

###### message

`string`

##### Returns

`void`

#### Call Signature

> **Logger**(`level`, `message`, `context`): `void`

Defined in: [utils/logger.ts:130](../../src/utils/logger.ts#L130)

Log a message at a specific level with context.

##### Parameters

###### level

[`LevelValue`](#levelvalue)

###### message

`string`

###### context

`object` | [`Err`](err.md#err)

##### Returns

`void`

#### Properties

##### DEBUG

> `readonly` **DEBUG**: `"debug"`

Defined in: [utils/logger.ts:111](../../src/utils/logger.ts#L111)

Debug level constant

##### ERROR

> `readonly` **ERROR**: `"error"`

Defined in: [utils/logger.ts:117](../../src/utils/logger.ts#L117)

Error level constant

##### FATAL

> `readonly` **FATAL**: `"fatal"`

Defined in: [utils/logger.ts:119](../../src/utils/logger.ts#L119)

Fatal level constant

##### INFO

> `readonly` **INFO**: `"info"`

Defined in: [utils/logger.ts:113](../../src/utils/logger.ts#L113)

Info level constant

##### TRACE

> `readonly` **TRACE**: `"trace"`

Defined in: [utils/logger.ts:109](../../src/utils/logger.ts#L109)

Trace level constant

##### WARN

> `readonly` **WARN**: `"warn"`

Defined in: [utils/logger.ts:115](../../src/utils/logger.ts#L115)

Warning level constant

#### Methods

##### child()

> **child**(`module`, `bindings?`): [`Logger`](#logger)

Defined in: [utils/logger.ts:139](../../src/utils/logger.ts#L139)

Create a child logger with module-specific context.

###### Parameters

###### module

`string`

Module name added to the modules array

###### bindings?

`object`

Optional bindings merged into every log entry's context

###### Returns

[`Logger`](#logger)

New Logger instance

***

### LoggerOptions

Defined in: [utils/logger.ts:87](../../src/utils/logger.ts#L87)

Options for `createLogger`.

#### Properties

##### level?

> `optional` **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:89](../../src/utils/logger.ts#L89)

Minimum log level. Default: from `LOG_LEVEL` env or `'info'`

##### transports?

> `optional` **transports**: [`LogTransport`](#logtransport)[]

Defined in: [utils/logger.ts:91](../../src/utils/logger.ts#L91)

Transports to write entries to. Default: `[prettyTransport()]`

***

### LogTransport

Defined in: [utils/logger.ts:56](../../src/utils/logger.ts#L56)

Transport interface — receives a `LogEntry` for each log call that passes
the level filter. Implement this to integrate any logging backend.

#### Methods

##### write()

> **write**(`entry`): `void`

Defined in: [utils/logger.ts:57](../../src/utils/logger.ts#L57)

###### Parameters

###### entry

[`LogEntry`](#logentry)

###### Returns

`void`

***

### PrettyOptions

Defined in: [utils/logger.ts:63](../../src/utils/logger.ts#L63)

Options for the built-in pretty console transport.

#### Properties

##### colors?

> `optional` **colors**: `boolean` \| `"auto"`

Defined in: [utils/logger.ts:72](../../src/utils/logger.ts#L72)

Enable ANSI colors.
- `'auto'` (default): enable when output is a TTY
- `true`: always enable
- `false`: always disable

##### levelColors?

> `optional` **levelColors**: `Partial`\<`Record`\<[`LevelValue`](#levelvalue), `string`\>\>

Defined in: [utils/logger.ts:74](../../src/utils/logger.ts#L74)

Override default level colors (ANSI escape sequences)

##### output?

> `optional` **output**: `object`

Defined in: [utils/logger.ts:65](../../src/utils/logger.ts#L65)

Output stream. Default: `process.stderr`

###### write()

> **write**(`data`): `void`

###### Parameters

###### data

`string`

###### Returns

`void`

##### timestamp?

> `optional` **timestamp**: `"short"` \| `"iso"` \| (`ts`) => `string`

Defined in: [utils/logger.ts:81](../../src/utils/logger.ts#L81)

Timestamp format.
- `'short'` (default): `HH:MM:SS.mmm` local time
- `'iso'`: ISO 8601 string
- Custom function receiving `Date.now()` timestamp

## Type Aliases

### LevelValue

> **LevelValue** = *typeof* [`lvl`](#lvl)\[keyof *typeof* [`lvl`](#lvl)\]

Defined in: [utils/logger.ts:34](../../src/utils/logger.ts#L34)

Type representing valid log level values.

## Variables

### log

> `const` **log**: [`Logger`](#logger)

Defined in: [utils/logger.ts:464](../../src/utils/logger.ts#L464)

Default logger instance for application-wide logging.

***

### lvl

> `const` **lvl**: `object`

Defined in: [utils/logger.ts:22](../../src/utils/logger.ts#L22)

Log level constants for type-safe level specification.

**Level Hierarchy** (lowest to highest):
- `TRACE`: Detailed debugging information
- `DEBUG`: Debugging information
- `INFO`: General informational messages
- `WARN`: Warning messages
- `ERROR`: Error messages for failures
- `FATAL`: Fatal errors causing termination

#### Type Declaration

##### DEBUG

> `readonly` **DEBUG**: `"debug"` = `"debug"`

##### ERROR

> `readonly` **ERROR**: `"error"` = `"error"`

##### FATAL

> `readonly` **FATAL**: `"fatal"` = `"fatal"`

##### INFO

> `readonly` **INFO**: `"info"` = `"info"`

##### TRACE

> `readonly` **TRACE**: `"trace"` = `"trace"`

##### WARN

> `readonly` **WARN**: `"warn"` = `"warn"`

## Functions

### createLogger()

> **createLogger**(`module?`, `options?`): [`Logger`](#logger)

Defined in: [utils/logger.ts:454](../../src/utils/logger.ts#L454)

Create a logger instance with optional module name and configuration.

#### Parameters

##### module?

`string`

Optional module name added as the first entry in `modules`

##### options?

[`LoggerOptions`](#loggeroptions)

Optional configuration

#### Returns

[`Logger`](#logger)

New Logger instance

***

### prettyTransport()

> **prettyTransport**(`options?`): [`LogTransport`](#logtransport)

Defined in: [utils/logger.ts:309](../../src/utils/logger.ts#L309)

Create a built-in pretty console transport.

Renders log entries to a human-readable format with optional ANSI colors.

Output format:
```
{dim timestamp} {colored TAG} {[mod] [mod]} {message} {dim context}
```

Err instances in context are rendered via `Err.toString()` on their own
indented line below the main line.

#### Parameters

##### options?

[`PrettyOptions`](#prettyoptions)

Optional configuration

#### Returns

[`LogTransport`](#logtransport)
