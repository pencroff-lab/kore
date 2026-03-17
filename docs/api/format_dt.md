[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / format\_dt

# format\_dt

Compact, sortable date/time stamps for file names, log prefixes, and IDs.

`dtStamp()` produces strings like `20260317_143012` (default) or
`2026-03-17_14:30:12` (readable mode). Supports UTC/local timezone,
date-only/time-only parts, optional milliseconds, and a configurable
delimiter — all controlled via a single `DtStampOptions` object.

## See

[format_dt.examples.test.ts](../../src/utils/format_dt.examples.test.ts) for usage patterns

## Interfaces

### DtStampOptions

Defined in: [utils/format\_dt.ts:16](../../src/utils/format_dt.ts#L16)

Options for configuring `dtStamp()` output format.

#### Properties

##### delimiter?

> `optional` **delimiter**: `string`

Defined in: [utils/format\_dt.ts:21](../../src/utils/format_dt.ts#L21)

Character(s) between date/time segments.

###### Default

```ts
"_"
```

##### ms?

> `optional` **ms**: `boolean`

Defined in: [utils/format\_dt.ts:26](../../src/utils/format_dt.ts#L26)

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

Defined in: [utils/format\_dt.ts:38](../../src/utils/format_dt.ts#L38)

Use human-readable separators (dashes, colons).

###### Default

```ts
false
```

##### tz?

> `optional` **tz**: `"utc"` \| `"local"`

Defined in: [utils/format\_dt.ts:28](../../src/utils/format_dt.ts#L28)

Timezone for date/time components.

###### Default

```ts
"utc"
```

## Functions

### dtStamp()

> **dtStamp**(`date?`, `options?`): `string`

Defined in: [utils/format\_dt.ts:51](../../src/utils/format_dt.ts#L51)

Format a `Date` into a filesystem/log-safe timestamp string.

Produces compact, sortable stamps suitable for file names, log prefixes,
and anywhere a human-readable but machine-sortable date/time is needed.

#### Parameters

##### date?

Date, Unix ms timestamp, or null (defaults to now)

`number` | `Date` | `null`

##### options?

[`DtStampOptions`](#dtstampoptions)

Formatting options

#### Returns

`string`

Formatted timestamp string
