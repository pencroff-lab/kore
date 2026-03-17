/**
 * Value-based error handling inspired by Go's explicit error returns.
 *
 * `Err` replaces thrown exceptions with immutable error values that carry
 * context (codes, metadata, timestamps) and compose via wrapping and
 * aggregation. Because every `Err` is a plain value, errors flow through
 * the type system — no `try/catch` needed.
 *
 * **Key concepts:**
 * - **Immutability** — every mutating method (`wrap`, `withCode`, `add`) returns a new instance.
 * - **Hierarchical codes** — colon-separated segments (`AUTH:TOKEN:EXPIRED`) enable prefix matching.
 * - **Cause chains** — `wrap()` links errors into a chain queryable via `root`, `chain()`, and `unwrap()`.
 * - **Aggregation** — `aggregate()` / `add()` collect multiple independent errors under one parent.
 *
 * @example
 * const e = Err.from("timeout", "NET:TIMEOUT");
 * const wrapped = e.wrap("fetch failed");
 *
 * @see [err.examples.test.ts](../../src/types/err.examples.test.ts) for usage patterns
 * @module err
 */

// ─── Group: Creation ─────────────────────────────────────────────────────────

/**
 * Uppercase snake_case identifier for programmatic error handling.
 * Supports hierarchical codes for prefix matching: 'AUTH:TOKEN:EXPIRED'.
 * @see {@link Err.hasCode} for prefix-based matching behavior
 */
export type ErrCode = string;

/**
 * Options for creating or modifying an Err instance.
 */
export interface ErrOptions {
	/** Error code for programmatic handling */
	code?: ErrCode;
	/** Human-readable error message */
	message?: string;
	/** Additional contextual data attached to this error level only */
	metadata?: Record<string, unknown>;
}

// ─── Group: Serialization ─────────────────────────────────────────────────────

/**
 * Wire shape of a serialized Err for cross-boundary transport.
 * Reconstruct via `Err.fromJSON()`.
 */
export interface ErrJSON {
	message: string;
	kind?: "Err";
	isErr?: boolean;
	code?: ErrCode;
	metadata?: Record<string, unknown>;
	timestamp: string;
	stack?: string;
	cause?: ErrJSON;
	errors: ErrJSON[];
}

/**
 * Controls which fields ErrJSON includes.
 * Omit sensitive fields at public API boundaries.
 */
export interface ErrJSONOptions {
	/** Include stack trace. @default true */
	stack?: boolean;
	/** Include metadata. @default true */
	metadata?: boolean;
}

// ─── Group: Formatting ───────────────────────────────────────────────────────

/**
 * Controls `Err.toString()` output for logging and debugging.
 */
export interface ToStringOptions {
	/** `true` = full stack, `number` = top N frames. @default undefined */
	stack?: boolean | number;
	/** ISO 8601 timestamp prefix. @default false */
	date?: boolean;
	/** Inline metadata object. @default false */
	metadata?: boolean;
	/** Max cause chain depth before truncation. @default undefined (unlimited) */
	maxDepth?: number;
	/** Indentation per nesting level. @default "  " */
	indent?: string;
}
