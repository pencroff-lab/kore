/**
 * Core types for value-based error handling.
 * Implementation lives in err.ts which imports from here.
 *
 * @module err.types
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
