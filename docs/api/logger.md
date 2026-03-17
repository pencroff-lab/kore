[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / logger

# logger

Structured, level-filtered logging with pluggable transports and `Err` integration.

`createLogger()` returns a callable `Logger` that doubles as an object with
level constants and a `child()` factory. Log entries are plain `LogEntry`
objects dispatched to one or more `LogTransport` sinks. The built-in
`prettyTransport()` renders colored, human-readable output to stderr.

**Key concepts:**
- **Callable interface** — `log("msg")` logs at INFO; `log(log.WARN, "msg")` at WARN.
- **Child loggers** — `log.child("mod")` adds a module tag and optional bindings.
- **Err-aware** — passing an `Err` as context renders it with stack + metadata on its own line.
- **Transport DI** — swap the default pretty transport for JSON, file, or test transports.

## See

[logger.examples.test.ts](../../src/utils/logger.examples.test.ts) for usage patterns

## Interfaces

### LogEntry

Defined in: [utils/logger.ts:50](../../src/utils/logger.ts#L50)

A single structured log entry passed to transports.

#### Properties

##### context

> **context**: `Record`\<`string`, `unknown`\>

Defined in: [utils/logger.ts:58](../../src/utils/logger.ts#L58)

Merged bindings + call-site context

##### level

> **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:52](../../src/utils/logger.ts#L52)

Log level

##### message

> **message**: `string`

Defined in: [utils/logger.ts:56](../../src/utils/logger.ts#L56)

Log message

##### modules

> **modules**: `string`[]

Defined in: [utils/logger.ts:60](../../src/utils/logger.ts#L60)

Module chain accumulated by child() calls

##### timestamp

> **timestamp**: `number`

Defined in: [utils/logger.ts:54](../../src/utils/logger.ts#L54)

Unix timestamp in milliseconds (Date.now())

***

### Logger()

Defined in: [utils/logger.ts:118](../../src/utils/logger.ts#L118)

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

Defined in: [utils/logger.ts:133](../../src/utils/logger.ts#L133)

Log a message at INFO level.

##### Parameters

###### message

`string`

##### Returns

`void`

#### Call Signature

> **Logger**(`message`, `context`): `void`

Defined in: [utils/logger.ts:135](../../src/utils/logger.ts#L135)

Log a message at INFO level with context.

##### Parameters

###### message

`string`

###### context

`object` | [`Err`](types/err.md#err)

##### Returns

`void`

#### Call Signature

> **Logger**(`message`, `detail`): `void`

Defined in: [utils/logger.ts:137](../../src/utils/logger.ts#L137)

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

Defined in: [utils/logger.ts:139](../../src/utils/logger.ts#L139)

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

Defined in: [utils/logger.ts:141](../../src/utils/logger.ts#L141)

Log a message at a specific level with context.

##### Parameters

###### level

[`LevelValue`](#levelvalue)

###### message

`string`

###### context

`object` | [`Err`](types/err.md#err)

##### Returns

`void`

#### Properties

##### DEBUG

> `readonly` **DEBUG**: `"debug"`

Defined in: [utils/logger.ts:122](../../src/utils/logger.ts#L122)

Debug level constant

##### ERROR

> `readonly` **ERROR**: `"error"`

Defined in: [utils/logger.ts:128](../../src/utils/logger.ts#L128)

Error level constant

##### FATAL

> `readonly` **FATAL**: `"fatal"`

Defined in: [utils/logger.ts:130](../../src/utils/logger.ts#L130)

Fatal level constant

##### INFO

> `readonly` **INFO**: `"info"`

Defined in: [utils/logger.ts:124](../../src/utils/logger.ts#L124)

Info level constant

##### TRACE

> `readonly` **TRACE**: `"trace"`

Defined in: [utils/logger.ts:120](../../src/utils/logger.ts#L120)

Trace level constant

##### WARN

> `readonly` **WARN**: `"warn"`

Defined in: [utils/logger.ts:126](../../src/utils/logger.ts#L126)

Warning level constant

#### Methods

##### child()

> **child**(`module`, `bindings?`): [`Logger`](#logger)

Defined in: [utils/logger.ts:150](../../src/utils/logger.ts#L150)

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

Defined in: [utils/logger.ts:98](../../src/utils/logger.ts#L98)

Options for `createLogger`.

#### Properties

##### level?

> `optional` **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:100](../../src/utils/logger.ts#L100)

Minimum log level. Default: from `LOG_LEVEL` env or `'info'`

##### transports?

> `optional` **transports**: [`LogTransport`](#logtransport)[]

Defined in: [utils/logger.ts:102](../../src/utils/logger.ts#L102)

Transports to write entries to. Default: `[prettyTransport()]`

***

### LogTransport

Defined in: [utils/logger.ts:67](../../src/utils/logger.ts#L67)

Transport interface — receives a `LogEntry` for each log call that passes
the level filter. Implement this to integrate any logging backend.

#### Methods

##### write()

> **write**(`entry`): `void`

Defined in: [utils/logger.ts:68](../../src/utils/logger.ts#L68)

###### Parameters

###### entry

[`LogEntry`](#logentry)

###### Returns

`void`

***

### PrettyOptions

Defined in: [utils/logger.ts:74](../../src/utils/logger.ts#L74)

Options for the built-in pretty console transport.

#### Properties

##### colors?

> `optional` **colors**: `boolean` \| `"auto"`

Defined in: [utils/logger.ts:83](../../src/utils/logger.ts#L83)

Enable ANSI colors.
- `'auto'` (default): enable when output is a TTY
- `true`: always enable
- `false`: always disable

##### levelColors?

> `optional` **levelColors**: `Partial`\<`Record`\<[`LevelValue`](#levelvalue), `string`\>\>

Defined in: [utils/logger.ts:85](../../src/utils/logger.ts#L85)

Override default level colors (ANSI escape sequences)

##### output?

> `optional` **output**: `object`

Defined in: [utils/logger.ts:76](../../src/utils/logger.ts#L76)

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

Defined in: [utils/logger.ts:92](../../src/utils/logger.ts#L92)

Timestamp format.
- `'short'` (default): `HH:MM:SS.mmm` local time
- `'iso'`: ISO 8601 string
- Custom function receiving `Date.now()` timestamp

## Type Aliases

### LevelValue

> **LevelValue** = *typeof* [`lvl`](#lvl)\[keyof *typeof* [`lvl`](#lvl)\]

Defined in: [utils/logger.ts:45](../../src/utils/logger.ts#L45)

Type representing valid log level values.

## Variables

### log

> `const` **log**: [`Logger`](#logger)

Defined in: [utils/logger.ts:475](../../src/utils/logger.ts#L475)

Default logger instance for application-wide logging.

***

### lvl

> `const` **lvl**: `object`

Defined in: [utils/logger.ts:33](../../src/utils/logger.ts#L33)

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

Defined in: [utils/logger.ts:465](../../src/utils/logger.ts#L465)

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

Defined in: [utils/logger.ts:320](../../src/utils/logger.ts#L320)

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
