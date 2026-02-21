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
  readable?: boolean;
}
```

| Option      | Type                              | Default      | Description                                                                 |
|-------------|-----------------------------------|--------------|-----------------------------------------------------------------------------|
| `delimiter` | `string`                          | `"_"`        | Character(s) between date/time segments.                                   |
| `ms`        | `boolean`                         | `false`      | Include milliseconds in the time portion.                                  |
| `tz`        | `"utc" \| "local"`               | `"utc"`      | Timezone for extracting date/time components.                              |
| `parts`     | `"datetime" \| "date" \| "time"` | `"datetime"` | Which parts of the stamp to include.                                       |
| `readable`  | `boolean`                         | `false`      | When `true`, formats with human-readable separators.                       |

### Option Details

#### `delimiter`

Character(s) placed between date and time segments, and between time and milliseconds when `ms` is `true`.

#### `ms`

When `true`, appends milliseconds to the time portion, separated by the delimiter (or `.` in readable time-only mode).

#### `tz`

- `"utc"` -- uses UTC methods (`getUTCFullYear`, `getUTCMonth`, etc.)
- `"local"` -- uses local-time methods (`getFullYear`, `getMonth`, etc.)

#### `parts`

Controls which parts of the timestamp are included:
- `"datetime"` -- full stamp (date + time): `YYYYMMDD_HHmmss`
- `"date"` -- date only: `YYYYMMDD`
- `"time"` -- time only: `HHmmss` or `HHmmss_SSS` with `ms`

#### `readable`

When `true`, formats with human-readable separators:
- Dashes in date: `YYYY-MM-DD`
- Colons in time: `HH:MM:SS`
- `.` before milliseconds in time-only mode: `HH:MM:SS.mmm`
- Delimiter still used between date/time and between time/milliseconds in datetime mode

## Examples

All examples use the date `2024-03-15T10:30:45.123Z`.

### Default (UTC datetime with underscore delimiter)

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"));
// "20240315_103045"
```

### Readable datetime with milliseconds

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { readable: true, ms: true });
// "2024-03-15_10:30:45_123"
```

### Readable date only

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { readable: true, parts: "date" });
// "2024-03-15"
```

### Readable time with milliseconds

```typescript
dtStamp(new Date("2024-03-15T10:30:45.123Z"), { readable: true, parts: "time", ms: true });
// "10:30:45.123"
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

| Options                                             | Output                  |
|-----------------------------------------------------|-------------------------|
| `{}`                                                | `20240315_103045`       |
| `{ ms: true }`                                      | `20240315_103045_123`   |
| `{ parts: "date" }`                                 | `20240315`              |
| `{ parts: "time" }`                                 | `103045`                |
| `{ parts: "time", ms: true }`                       | `103045_123`            |
| `{ delimiter: "-" }`                                | `20240315-103045`       |
| `{ delimiter: "-", ms: true }`                      | `20240315-103045-123`   |
| `{ readable: true }`                                | `2024-03-15_10:30:45`   |
| `{ readable: true, ms: true }`                      | `2024-03-15_10:30:45_123` |
| `{ readable: true, parts: "date" }`                 | `2024-03-15`            |
| `{ readable: true, parts: "time" }`                 | `10:30:45`              |
| `{ readable: true, parts: "time", ms: true }`       | `10:30:45.123`          |
