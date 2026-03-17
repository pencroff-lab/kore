[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / format\_dt

# format\_dt

Date formatting utility for filesystem/log-safe timestamps.

## See

format_dt.examples.test.ts for usage patterns

## Interfaces

### DtStampOptions

Defined in: [utils/format\_dt.ts:11](../../src/utils/format_dt.ts#L11)

Options for configuring `dtStamp()` output format.

#### Properties

##### delimiter?

> `optional` **delimiter**: `string`

Defined in: [utils/format\_dt.ts:16](../../src/utils/format_dt.ts#L16)

Character(s) between date/time segments.

###### Default

```ts
"_"
```

##### ms?

> `optional` **ms**: `boolean`

Defined in: [utils/format\_dt.ts:21](../../src/utils/format_dt.ts#L21)

Include milliseconds in the time portion.

###### Default

```ts
false
```

##### parts?

> `optional` **parts**: `"date"` \| `"datetime"` \| `"time"`

Defined in: [utils/format\_dt.ts:36](../../src/utils/format_dt.ts#L36)

Which parts of the stamp to include.
- `"datetime"` -- full stamp (date + time)
- `"date"` -- date only
- `"time"` -- time only

###### Default

```ts
"datetime"
```

##### readable?

> `optional` **readable**: `boolean`

Defined in: [utils/format\_dt.ts:43](../../src/utils/format_dt.ts#L43)

When `true`, formats with human-readable separators:
dashes in date (`YYYY-MM-DD`), colons in time (`HH:MM:SS`),
and `.` before milliseconds in time-only mode (`HH:MM:SS.mmm`).

###### Default

```ts
false
```

##### tz?

> `optional` **tz**: `"utc"` \| `"local"`

Defined in: [utils/format\_dt.ts:28](../../src/utils/format_dt.ts#L28)

Timezone to use for extracting date/time components.
- `"utc"` -- use UTC methods (`getUTCFullYear`, etc.)
- `"local"` -- use local-time methods (`getFullYear`, etc.)

###### Default

```ts
"utc"
```

## Functions

### dtStamp()

> **dtStamp**(`date?`, `options?`): `string`

Defined in: [utils/format\_dt.ts:57](../../src/utils/format_dt.ts#L57)

Format a `Date` into a filesystem/log-safe timestamp string.

Produces compact, sortable stamps suitable for file names, log prefixes,
and anywhere a human-readable but machine-sortable date/time is needed.

#### Parameters

##### date?

Date to format. Accepts a `Date`, a Unix timestamp in milliseconds
  (number), or `null`/omitted (defaults to `new Date()`).

`number` | `Date` | `null`

##### options?

[`DtStampOptions`](#dtstampoptions)

Formatting options (delimiter, milliseconds, timezone, parts, readable)

#### Returns

`string`

Formatted timestamp string
