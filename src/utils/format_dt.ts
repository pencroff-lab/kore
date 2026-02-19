/**
 * Options for configuring `dtStamp()` output format.
 */
export interface DtStampOptions {
	/**
	 * Character(s) between date/time segments.
	 * Ignored when `compact` is `true`.
	 * @default "_"
	 */
	delimiter?: string;
	/**
	 * Include milliseconds in the time portion.
	 * @default false
	 */
	ms?: boolean;
	/**
	 * Timezone to use for extracting date/time components.
	 * - `"utc"` -- use UTC methods (`getUTCFullYear`, etc.)
	 * - `"local"` -- use local-time methods (`getFullYear`, etc.)
	 * @default "utc"
	 */
	tz?: "utc" | "local";
	/**
	 * Which parts of the stamp to include.
	 * - `"datetime"` -- full stamp (date + time)
	 * - `"date"` -- date only (`YYYYMMDD`)
	 * - `"time"` -- time only (`HHmmss` or `HHmmss_SSS` with `ms`)
	 * @default "datetime"
	 */
	parts?: "datetime" | "date" | "time";
	/**
	 * When `true`, omits the delimiter entirely (equivalent to `delimiter: ""`).
	 * @default false
	 */
	compact?: boolean;
}

/**
 * Format a `Date` into a filesystem/log-safe timestamp string.
 *
 * Produces compact, sortable stamps suitable for file names, log prefixes,
 * and anywhere a human-readable but machine-sortable date/time is needed.
 *
 * @param date - Date to format. Defaults to `new Date()` when `null` or omitted.
 * @param options - Formatting options (delimiter, milliseconds, timezone, parts, compact)
 * @returns Formatted timestamp string
 *
 * @example Default (UTC datetime with underscore delimiter)
 * ```typescript
 * dtStamp(new Date("2024-03-15T10:30:45.123Z"));
 * // "20240315_103045"
 * ```
 *
 * @example Compact with milliseconds
 * ```typescript
 * dtStamp(new Date("2024-03-15T10:30:45.123Z"), { compact: true, ms: true });
 * // "20240315103045123"
 * ```
 *
 * @example Date only
 * ```typescript
 * dtStamp(new Date("2024-03-15T10:30:45.123Z"), { parts: "date" });
 * // "20240315"
 * ```
 *
 * @example Time only with milliseconds
 * ```typescript
 * dtStamp(new Date("2024-03-15T10:30:45.123Z"), { parts: "time", ms: true });
 * // "103045_123"
 * ```
 *
 * @example Custom delimiter
 * ```typescript
 * dtStamp(new Date("2024-03-15T10:30:45.123Z"), { delimiter: "-" });
 * // "20240315-103045"
 * ```
 */
export function dtStamp(date?: Date | null, options?: DtStampOptions): string {
	const d = date ?? new Date();
	const {
		delimiter = "_",
		ms = false,
		tz = "utc",
		parts = "datetime",
		compact = false,
	} = options ?? {};

	const sep = compact ? "" : delimiter;
	const utc = tz === "utc";

	const year = utc ? d.getUTCFullYear() : d.getFullYear();
	const month = String((utc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(
		2,
		"0",
	);
	const day = String(utc ? d.getUTCDate() : d.getDate()).padStart(2, "0");
	const hours = String(utc ? d.getUTCHours() : d.getHours()).padStart(2, "0");
	const minutes = String(utc ? d.getUTCMinutes() : d.getMinutes()).padStart(
		2,
		"0",
	);
	const seconds = String(utc ? d.getUTCSeconds() : d.getSeconds()).padStart(
		2,
		"0",
	);

	const datePart = `${year}${month}${day}`;
	let timePart = `${hours}${minutes}${seconds}`;

	if (ms) {
		const millis = String(
			utc ? d.getUTCMilliseconds() : d.getMilliseconds(),
		).padStart(3, "0");
		timePart = `${timePart}${sep}${millis}`;
	}

	if (parts === "date") {
		return datePart;
	}
	if (parts === "time") {
		return timePart;
	}
	return `${datePart}${sep}${timePart}`;
}
