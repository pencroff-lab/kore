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

Defined in: [utils/logger.ts:40](../../src/utils/logger.ts#L40)

A single structured log entry passed to transports.

#### Properties

##### context

> **context**: `Record`\<`string`, `unknown`\>

Defined in: [utils/logger.ts:48](../../src/utils/logger.ts#L48)

Merged bindings + call-site context

##### level

> **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:42](../../src/utils/logger.ts#L42)

Log level

##### message

> **message**: `string`

Defined in: [utils/logger.ts:46](../../src/utils/logger.ts#L46)

Log message

##### modules

> **modules**: `string`[]

Defined in: [utils/logger.ts:50](../../src/utils/logger.ts#L50)

Module chain accumulated by child() calls

##### timestamp

> **timestamp**: `number`

Defined in: [utils/logger.ts:44](../../src/utils/logger.ts#L44)

Unix timestamp in milliseconds (Date.now())

***

### Logger()

Defined in: [utils/logger.ts:99](../../src/utils/logger.ts#L99)

Callable logger interface — both a function and an object with level
constants and a `child` method.

#### Call Signature

> **Logger**(`message`): `void`

Defined in: [utils/logger.ts:108](../../src/utils/logger.ts#L108)

Log a message at INFO level.

##### Parameters

###### message

`string`

##### Returns

`void`

#### Call Signature

> **Logger**(`message`, `context`): `void`

Defined in: [utils/logger.ts:110](../../src/utils/logger.ts#L110)

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

Defined in: [utils/logger.ts:112](../../src/utils/logger.ts#L112)

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

Defined in: [utils/logger.ts:114](../../src/utils/logger.ts#L114)

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

Defined in: [utils/logger.ts:116](../../src/utils/logger.ts#L116)

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

Defined in: [utils/logger.ts:101](../../src/utils/logger.ts#L101)

##### ERROR

> `readonly` **ERROR**: `"error"`

Defined in: [utils/logger.ts:104](../../src/utils/logger.ts#L104)

##### FATAL

> `readonly` **FATAL**: `"fatal"`

Defined in: [utils/logger.ts:105](../../src/utils/logger.ts#L105)

##### INFO

> `readonly` **INFO**: `"info"`

Defined in: [utils/logger.ts:102](../../src/utils/logger.ts#L102)

##### TRACE

> `readonly` **TRACE**: `"trace"`

Defined in: [utils/logger.ts:100](../../src/utils/logger.ts#L100)

##### WARN

> `readonly` **WARN**: `"warn"`

Defined in: [utils/logger.ts:103](../../src/utils/logger.ts#L103)

#### Methods

##### child()

> **child**(`module`, `bindings?`): [`Logger`](#logger)

Defined in: [utils/logger.ts:125](../../src/utils/logger.ts#L125)

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

Defined in: [utils/logger.ts:88](../../src/utils/logger.ts#L88)

Options for `createLogger`.

#### Properties

##### level?

> `optional` **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:90](../../src/utils/logger.ts#L90)

Minimum log level. Default: from `LOG_LEVEL` env or `'info'`

##### transports?

> `optional` **transports**: [`LogTransport`](#logtransport)[]

Defined in: [utils/logger.ts:92](../../src/utils/logger.ts#L92)

Transports to write entries to. Default: `[prettyTransport()]`

***

### LogTransport

Defined in: [utils/logger.ts:57](../../src/utils/logger.ts#L57)

Transport interface — receives a `LogEntry` for each log call that passes
the level filter. Implement this to integrate any logging backend.

#### Methods

##### write()

> **write**(`entry`): `void`

Defined in: [utils/logger.ts:58](../../src/utils/logger.ts#L58)

###### Parameters

###### entry

[`LogEntry`](#logentry)

###### Returns

`void`

***

### PrettyOptions

Defined in: [utils/logger.ts:64](../../src/utils/logger.ts#L64)

Options for the built-in pretty console transport.

#### Properties

##### colors?

> `optional` **colors**: `boolean` \| `"auto"`

Defined in: [utils/logger.ts:73](../../src/utils/logger.ts#L73)

Enable ANSI colors.
- `'auto'` (default): enable when output is a TTY
- `true`: always enable
- `false`: always disable

##### levelColors?

> `optional` **levelColors**: `Partial`\<`Record`\<[`LevelValue`](#levelvalue), `string`\>\>

Defined in: [utils/logger.ts:75](../../src/utils/logger.ts#L75)

Override default level colors (ANSI escape sequences)

##### output?

> `optional` **output**: `object`

Defined in: [utils/logger.ts:66](../../src/utils/logger.ts#L66)

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

Defined in: [utils/logger.ts:82](../../src/utils/logger.ts#L82)

Timestamp format.
- `'short'` (default): `HH:MM:SS.mmm` local time
- `'iso'`: ISO 8601 string
- Custom function receiving `Date.now()` timestamp

## Type Aliases

### LevelValue

> **LevelValue** = *typeof* [`lvl`](#lvl)\[keyof *typeof* [`lvl`](#lvl)\]

Defined in: [utils/logger.ts:35](../../src/utils/logger.ts#L35)

Type representing valid log level values.

## Variables

### log

> `const` **log**: [`Logger`](#logger)

Defined in: [utils/logger.ts:383](../../src/utils/logger.ts#L383)

Default logger instance for application-wide logging.

***

### lvl

> `const` **lvl**: `object`

Defined in: [utils/logger.ts:23](../../src/utils/logger.ts#L23)

Log level constants (TRACE < DEBUG < INFO < WARN < ERROR < FATAL).

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

Defined in: [utils/logger.ts:373](../../src/utils/logger.ts#L373)

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

Defined in: [utils/logger.ts:249](../../src/utils/logger.ts#L249)

Create a built-in pretty console transport.

Err instances in context are rendered via `Err.toString()` on their own
indented line below the main line.

#### Parameters

##### options?

[`PrettyOptions`](#prettyoptions)

Optional configuration

#### Returns

[`LogTransport`](#logtransport)
