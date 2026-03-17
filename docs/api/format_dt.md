[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / format\_dt

# format\_dt

## Interfaces

### DtStampOptions

Defined in: [utils/format\_dt.ts:8](https://github.com/pencroff-lab/kore/blob/9484b3bcf14be42bbc7c63d69c6d16723409591e/src/utils/format_dt.ts#L8)

Options for configuring `dtStamp()` output format.

#### Properties

##### delimiter?

> `optional` **delimiter**: `string`

Defined in: [utils/format\_dt.ts:13](https://github.com/pencroff-lab/kore/blob/9484b3bcf14be42bbc7c63d69c6d16723409591e/src/utils/format_dt.ts#L13)

Character(s) between date/time segments.

###### Default

```ts
"_"
```

##### ms?

> `optional` **ms**: `boolean`

Defined in: [utils/format\_dt.ts:18](https://github.com/pencroff-lab/kore/blob/9484b3bcf14be42bbc7c63d69c6d16723409591e/src/utils/format_dt.ts#L18)

Include milliseconds in the time portion.

###### Default

```ts
false
```

##### parts?

> `optional` **parts**: `"date"` \| `"datetime"` \| `"time"`

Defined in: [utils/format\_dt.ts:33](https://github.com/pencroff-lab/kore/blob/9484b3bcf14be42bbc7c63d69c6d16723409591e/src/utils/format_dt.ts#L33)

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

Defined in: [utils/format\_dt.ts:40](https://github.com/pencroff-lab/kore/blob/9484b3bcf14be42bbc7c63d69c6d16723409591e/src/utils/format_dt.ts#L40)

When `true`, formats with human-readable separators:
dashes in date (`YYYY-MM-DD`), colons in time (`HH:MM:SS`),
and `.` before milliseconds in time-only mode (`HH:MM:SS.mmm`).

###### Default

```ts
false
```

##### tz?

> `optional` **tz**: `"utc"` \| `"local"`

Defined in: [utils/format\_dt.ts:25](https://github.com/pencroff-lab/kore/blob/9484b3bcf14be42bbc7c63d69c6d16723409591e/src/utils/format_dt.ts#L25)

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

Defined in: [utils/format\_dt.ts:54](https://github.com/pencroff-lab/kore/blob/9484b3bcf14be42bbc7c63d69c6d16723409591e/src/utils/format_dt.ts#L54)

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
