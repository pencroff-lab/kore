# dtStamp

Format a `Date` into a filesystem/log-safe timestamp string.

Produces compact, sortable stamps suitable for file names, log prefixes, and anywhere a human-readable but machine-sortable date/time is needed.

## Signature

```typescript
function dtStamp(date?: Date | null, options?: DtStampOptions): string
```

### Parameters

| Parameter | Type               | Default      | Description                                        |
|-----------|--------------------|--------------|----------------------------------------------------|
| `date`    | `Date \| null`     | `new Date()` | Date to format. Defaults to current date when `null` or omitted. |
| `options` | `DtStampOptions`   | `{}`         | Formatting options.                                |

## DtStampOptions

```typescript
interface DtStampOptions {
  delimiter?: string;
  ms?: boolean;
  tz?: "utc" | "local";
  parts?: "datetime" | "date" | "time";
  compact?: boolean;
}
```

| Option      | Type                              | Default      | Description                                                                 |
|-------------|-----------------------------------|--------------|-----------------------------------------------------------------------------|
| `delimiter` | `string`                          | `"_"`        | Character(s) between date/time segments. Ignored when `compact` is `true`. |
| `ms`        | `boolean`                         | `false`      | Include milliseconds in the time portion.                                  |
| `tz`        | `"utc" \| "local"`               | `"utc"`      | Timezone for extracting date/time components.                              |
| `parts`     | `"datetime" \| "date" \| "time"` | `"datetime"` | Which parts of the stamp to include.                                       |
| `compact`   | `boolean`                         | `false`      | When `true`, omits the delimiter entirely (equivalent to `delimiter: ""`). |

### Option Details

#### `delimiter`

Character(s) placed between date and time segments, and between time and milliseconds when `ms` is `true`. Ignored when `compact` is `true`.

#### `ms`

When `true`, appends milliseconds to the time portion, separated by the delimiter.

#### `tz`

- `"utc"` -- uses UTC methods (`getUTCFullYear`, `getUTCMonth`, etc.)
- `"local"` -- uses local-time methods (`getFullYear`, `getMonth`, etc.)

#### `parts`

Controls which parts of the timestamp are included:
- `"datetime"` -- full stamp (date + time): `YYYYMMDD_HHmmss`
- `"date"` -- date only: `YYYYMMDD`
- `"time"` -- time only: `HHmmss` or `HHmmss_SSS` with `ms`

#### `compact`

When `true`, omits the delimiter entirely. Equivalent to setting `delimiter: ""`.

## Examples

All examples use the date `2024-03-15T10:30:45.123Z`.

### Default (UTC datetime with underscore delimiter)

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"));
// "20240315_103045"
```

### Compact with milliseconds

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { compact: true, ms: true });
// "20240315103045123"
```

### Date only

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { parts: "date" });
// "20240315"
```

### Time only with milliseconds

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { parts: "time", ms: true });
// "103045_123"
```

### Custom delimiter

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { delimiter: "-" });
// "20240315-103045"
```

### Current date (default)

```typescript
dtStamp();
// e.g., "20260219_153045"
```

### Null date (defaults to current)

```typescript
dtStamp(null);
// e.g., "20260219_153045"
```

### Local timezone

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { tz: "local" });
// Result depends on system timezone
```

## Output Format Reference

| Options                                | Output              |
|----------------------------------------|---------------------|
| `{}`                                   | `20240315_103045`   |
| `{ ms: true }`                         | `20240315_103045_123` |
| `{ compact: true }`                    | `20240315103045`    |
| `{ compact: true, ms: true }`          | `20240315103045123` |
| `{ parts: "date" }`                    | `20240315`          |
| `{ parts: "time" }`                    | `103045`            |
| `{ parts: "time", ms: true }`          | `103045_123`        |
| `{ delimiter: "-" }`                   | `20240315-103045`   |
| `{ delimiter: "-", ms: true }`         | `20240315-103045-123` |
| `{ parts: "time", compact: true, ms: true }` | `103045123`  |
