[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / logger

# logger

Structured logging utility with transport DI and Err integration.

This module provides a flexible, callable logger with a transport abstraction,
built-in pretty console transport, and zero external runtime dependencies
beyond `fast-safe-stringify`.

## Design Philosophy

The logger is designed as a callable function with overloaded signatures.
Transports are injectable, making the logger testable without streams or
process-level side effects. The built-in pretty transport renders to stderr
with ANSI colors and automatic Err formatting.

## Basic Usage

## Examples

```typescript
import { log } from './utils/logger';

log('Application started');                           // INFO level by default
log(log.WARN, 'Connection slow');                     // Explicit level
log(log.ERROR, 'Failed to save', { userId: '123' });  // With context
```

```typescript
import { Err } from './types/err';
import { log } from './utils/logger';

const [data, err] = fetchData();
if (err) {
  log(log.ERROR, 'Data fetch failed', err);
  return;
}
```

```typescript
const dbLogger = log.child('database', { version: '1.0' });
dbLogger('Connected to postgres');
// Output: [database] Connected to postgres

const userLogger = dbLogger.child('users');
userLogger('User created');
// Output: [database] [users] User created
```

```typescript
import { createLogger, lvl } from './utils/logger';
import type { LogEntry, LogTransport } from './utils/logger';

const entries: LogEntry[] = [];
const spy: LogTransport = { write(e) { entries.push(e); } };
const testLogger = createLogger('test', { transports: [spy], level: lvl.TRACE });
```

## Configuration

The logger reads configuration from environment variables:
- `LOG_LEVEL`: Minimum level to log (trace|debug|info|warn|error|fatal). Default: 'info'

## Interfaces

### LogEntry

Defined in: [utils/logger.ts:98](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L98)

A single structured log entry passed to transports.

#### Properties

##### context

> **context**: `Record`\<`string`, `unknown`\>

Defined in: [utils/logger.ts:106](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L106)

Merged bindings + call-site context

##### level

> **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:100](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L100)

Log level

##### message

> **message**: `string`

Defined in: [utils/logger.ts:104](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L104)

Log message

##### modules

> **modules**: `string`[]

Defined in: [utils/logger.ts:108](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L108)

Module chain accumulated by child() calls

##### timestamp

> **timestamp**: `number`

Defined in: [utils/logger.ts:102](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L102)

Unix timestamp in milliseconds (Date.now())

***

### Logger()

Defined in: [utils/logger.ts:180](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L180)

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

Defined in: [utils/logger.ts:195](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L195)

Log a message at INFO level.

##### Parameters

###### message

`string`

##### Returns

`void`

#### Call Signature

> **Logger**(`message`, `context`): `void`

Defined in: [utils/logger.ts:197](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L197)

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

Defined in: [utils/logger.ts:199](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L199)

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

Defined in: [utils/logger.ts:201](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L201)

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

Defined in: [utils/logger.ts:203](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L203)

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

Defined in: [utils/logger.ts:184](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L184)

Debug level constant

##### ERROR

> `readonly` **ERROR**: `"error"`

Defined in: [utils/logger.ts:190](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L190)

Error level constant

##### FATAL

> `readonly` **FATAL**: `"fatal"`

Defined in: [utils/logger.ts:192](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L192)

Fatal level constant

##### INFO

> `readonly` **INFO**: `"info"`

Defined in: [utils/logger.ts:186](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L186)

Info level constant

##### TRACE

> `readonly` **TRACE**: `"trace"`

Defined in: [utils/logger.ts:182](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L182)

Trace level constant

##### WARN

> `readonly` **WARN**: `"warn"`

Defined in: [utils/logger.ts:188](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L188)

Warning level constant

#### Methods

##### child()

> **child**(`module`, `bindings?`): [`Logger`](#logger)

Defined in: [utils/logger.ts:212](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L212)

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

Defined in: [utils/logger.ts:160](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L160)

Options for `createLogger`.

#### Properties

##### level?

> `optional` **level**: [`LevelValue`](#levelvalue)

Defined in: [utils/logger.ts:162](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L162)

Minimum log level. Default: from `LOG_LEVEL` env or `'info'`

##### transports?

> `optional` **transports**: [`LogTransport`](#logtransport)[]

Defined in: [utils/logger.ts:164](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L164)

Transports to write entries to. Default: `[prettyTransport()]`

***

### LogTransport

Defined in: [utils/logger.ts:129](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L129)

Transport interface — receives a `LogEntry` for each log call that passes
the level filter. Implement this to integrate any logging backend.

#### Example

```typescript
import pino from 'pino';
import type { LogTransport, LogEntry } from '@pencroff-lab/kore';

const pinoInstance = pino();
const pinoTransport: LogTransport = {
  write(entry: LogEntry) {
    const prefix = entry.modules.map(m => `[${m}] `).join('');
    pinoInstance[entry.level](entry.context, prefix + entry.message);
  }
};
```

#### Methods

##### write()

> **write**(`entry`): `void`

Defined in: [utils/logger.ts:130](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L130)

###### Parameters

###### entry

[`LogEntry`](#logentry)

###### Returns

`void`

***

### PrettyOptions

Defined in: [utils/logger.ts:136](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L136)

Options for the built-in pretty console transport.

#### Properties

##### colors?

> `optional` **colors**: `boolean` \| `"auto"`

Defined in: [utils/logger.ts:145](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L145)

Enable ANSI colors.
- `'auto'` (default): enable when output is a TTY
- `true`: always enable
- `false`: always disable

##### levelColors?

> `optional` **levelColors**: `Partial`\<`Record`\<[`LevelValue`](#levelvalue), `string`\>\>

Defined in: [utils/logger.ts:147](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L147)

Override default level colors (ANSI escape sequences)

##### output?

> `optional` **output**: `object`

Defined in: [utils/logger.ts:138](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L138)

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

Defined in: [utils/logger.ts:154](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L154)

Timestamp format.
- `'short'` (default): `HH:MM:SS.mmm` local time
- `'iso'`: ISO 8601 string
- Custom function receiving `Date.now()` timestamp

## Type Aliases

### LevelValue

> **LevelValue** = *typeof* [`lvl`](#lvl)\[keyof *typeof* [`lvl`](#lvl)\]

Defined in: [utils/logger.ts:93](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L93)

Type representing valid log level values.

## Variables

### log

> `const` **log**: [`Logger`](#logger)

Defined in: [utils/logger.ts:573](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L573)

Default logger instance for application-wide logging.

#### Examples

```typescript
import { log } from './utils/logger';

log('Application started');
log(log.INFO, 'Server listening', { port: 3000 });
log(log.ERROR, 'Startup failed', err);
```

```typescript
const dbLogger = log.child('database');
dbLogger('Connection pool initialized');
```

***

### lvl

> `const` **lvl**: `object`

Defined in: [utils/logger.ts:81](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L81)

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

Defined in: [utils/logger.ts:548](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L548)

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

#### Examples

```typescript
const logger = createLogger();
logger('Application ready');
```

```typescript
const dbLogger = createLogger('database');
dbLogger('Connected');
```

```typescript
import type { LogEntry, LogTransport } from './utils/logger';

const entries: LogEntry[] = [];
const spy: LogTransport = { write(e) { entries.push(e); } };
const testLogger = createLogger('test', { transports: [spy], level: lvl.TRACE });
```

***

### prettyTransport()

> **prettyTransport**(`options?`): [`LogTransport`](#logtransport)

Defined in: [utils/logger.ts:382](https://github.com/pencroff-lab/kore/blob/e0541df57b6410063b5a6ed549d1617d3ec50053/src/utils/logger.ts#L382)

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
