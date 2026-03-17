/**
 * Immutable, value-based error type with wrapping and aggregation.
 *
 * @see err.examples.test.ts for usage patterns
 * @module err
 */

import type {
	ErrCode,
	ErrJSON,
	ErrJSONOptions,
	ErrOptions,
	ToStringOptions,
} from "./err.types";

export type { ErrCode, ErrJSON, ErrJSONOptions, ErrOptions, ToStringOptions };

/**
 * A value-based error type that supports wrapping, aggregation, and serialization.
 *
 * All instances are immutable - methods return new instances rather than mutating.
 */
export class Err {
	/**
	 * Discriminator property for type narrowing.
	 * Always "Err" for Err instances.
	 */
	readonly kind: "Err" = "Err";

	/**
	 * Discriminator property for type narrowing.
	 * Always `true` for Err instances.
	 */
	readonly isErr = true as const;

	/** Human-readable error message */
	readonly message: string;

	/** Error code for programmatic handling */
	readonly code?: ErrCode;

	/** Additional contextual data */
	readonly metadata?: Record<string, unknown>;

	/**
	 * Timestamp when the error was created (ISO 8601 string).
	 *
	 * Stored as string for easy serialization and comparison.
	 */
	readonly timestamp: string;

	/** The wrapped/caused error (for error chains) */
	private readonly _cause?: Err;

	/** List of aggregated errors */
	private readonly _errors: Err[];

	/**
	 * Stack trace - either from original Error or captured at creation.
	 *
	 * When wrapping a native Error, this preserves the original stack
	 * for better debugging (points to actual error location).
	 */
	private readonly _stack?: string;

	/**
	 * Private constructor - use static factory methods instead.
	 * @internal
	 */
	private constructor(
		message: string,
		options: {
			code?: ErrCode;
			cause?: Err;
			errors?: Err[];
			metadata?: Record<string, unknown>;
			stack?: string;
			timestamp?: string;
		} = {},
	) {
		this.message = message;
		this.code = options.code;
		this.metadata = options.metadata;
		this.timestamp = options.timestamp ?? new Date().toISOString();
		this._cause = options.cause;
		this._errors = options.errors ?? [];

		// Use provided stack (e.g., from native Error) or capture new one
		// When capturing new stack, filter out internal Err class frames
		if (options.stack) {
			this._stack = options.stack;
		} else {
			const rawStack = new Error().stack;
			this._stack = rawStack ? Err._filterInternalFrames(rawStack) : undefined;
		}
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Static Constructors
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Create an Err from a string message with optional code.
	 *
	 * @param message - Error message
	 * @param code - Optional error code
	 * @returns New Err instance
	 */
	static from(message: string, code?: ErrCode): Err;

	/**
	 * Create an Err from a string message with full options.
	 *
	 * @param message - Error message
	 * @param options - Code and metadata options
	 * @returns New Err instance
	 */
	static from(message: string, options: ErrOptions): Err;

	/**
	 * Create an Err from a native Error.
	 *
	 * Preserves the original error's stack trace, cause chain, and name.
	 *
	 * @param error - Native Error instance
	 * @param options - Optional overrides for message, code, and metadata
	 * @returns New Err instance
	 */
	static from(error: Error, options?: ErrOptions): Err;

	/**
	 * Create an Err from another Err instance (clone with optional overrides).
	 *
	 * @param error - Existing Err instance
	 * @param options - Optional overrides
	 * @returns New Err instance with merged properties
	 */
	static from(error: Err, options?: ErrOptions): Err;

	/**
	 * Create an Err from an unknown value (safe for catch blocks).
	 *
	 * @param error - Any value
	 * @param options - Optional code and metadata
	 * @returns New Err instance
	 */
	static from(error: unknown, options?: ErrOptions): Err;

	static from(input: unknown, optionsOrCode?: ErrOptions | ErrCode): Err {
		// Normalize options
		const options: ErrOptions =
			typeof optionsOrCode === "string"
				? { code: optionsOrCode }
				: (optionsOrCode ?? {});

		// Already an Err - clone with optional overrides
		if (Err.isErr(input)) {
			return new Err(options.message ?? input.message, {
				code: options.code ?? input.code,
				cause: input._cause,
				errors: [...input._errors],
				metadata: { ...input.metadata, ...options.metadata },
				stack: input._stack,
				timestamp: input.timestamp,
			});
		}

		// Native Error - preserve original stack and cause chain
		if (input instanceof Error) {
			// Convert error.cause to Err if it's an Error or string
			let cause: Err | undefined;
			if (input.cause instanceof Error) {
				cause = Err.from(input.cause);
			} else if (typeof input.cause === "string") {
				cause = Err.from(input.cause);
			}

			return new Err(options.message ?? input.message, {
				code: options.code,
				cause,
				metadata: {
					originalName: input.name,
					...options.metadata,
				},
				stack: input.stack, // Use original stack for better debugging
			});
		}

		// String message
		if (typeof input === "string") {
			return new Err(input, {
				code: options.code,
				metadata: options.metadata,
			});
		}

		// Unknown value - create generic error with original value in metadata
		return new Err(options.message ?? "Unknown error", {
			code: options.code ?? "UNKNOWN",
			metadata: { originalValue: input, ...options.metadata },
		});
	}

	/**
	 * Static convenience method to wrap an error with a context message.
	 *
	 * @param message - Context message explaining what operation failed
	 * @param error - The original error (Err, Error, or string)
	 * @param options - Optional code and metadata for the wrapper
	 * @returns New Err instance with the original as cause
	 *
	 * @see {@link Err.prototype.wrap} for the instance method
	 */
	static wrap(
		message: string,
		error: Err | Error | string,
		options?: ErrOptions,
	): Err {
		const cause = Err.isErr(error) ? error : Err.from(error);
		return new Err(message, {
			code: options?.code,
			cause,
			metadata: options?.metadata,
		});
	}

	/**
	 * Create an aggregate error for collecting multiple errors.
	 *
	 * @param message - Parent error message describing the aggregate
	 * @param errors - Optional initial list of errors
	 * @param options - Optional code and metadata for the aggregate
	 * @returns New aggregate Err instance
	 */
	static aggregate(
		message: string,
		errors: Array<Err | Error | string> = [],
		options?: ErrOptions,
	): Err {
		const wrapped = errors.map((e) => (Err.isErr(e) ? e : Err.from(e)));
		return new Err(message, {
			code: options?.code ?? "AGGREGATE",
			errors: wrapped,
			metadata: options?.metadata,
		});
	}

	/**
	 * Deserialize an Err from JSON representation.
	 *
	 * @param json - JSON object matching ErrJSON structure
	 * @returns Reconstructed Err instance
	 * @throws Error if json is invalid or missing required fields
	 *
	 * @see {@link toJSON} for serializing an Err to JSON
	 */
	static fromJSON(json: unknown): Err {
		// Validate input is an object
		if (!json || typeof json !== "object") {
			throw new Error("Invalid ErrJSON: expected object");
		}

		const obj = json as Record<string, unknown>;

		// Validate required message field
		if (typeof obj.message !== "string") {
			throw new Error("Invalid ErrJSON: message must be a string");
		}

		// Validate optional fields
		if (obj.code !== undefined && typeof obj.code !== "string") {
			throw new Error("Invalid ErrJSON: code must be a string");
		}

		if (obj.timestamp !== undefined && typeof obj.timestamp !== "string") {
			throw new Error("Invalid ErrJSON: timestamp must be a string");
		}

		if (obj.stack !== undefined && typeof obj.stack !== "string") {
			throw new Error("Invalid ErrJSON: stack must be a string");
		}

		if (obj.metadata !== undefined && typeof obj.metadata !== "object") {
			throw new Error("Invalid ErrJSON: metadata must be an object");
		}

		if (obj.errors !== undefined && !Array.isArray(obj.errors)) {
			throw new Error("Invalid ErrJSON: errors must be an array");
		}

		if (
			obj.cause !== undefined &&
			obj.cause !== null &&
			typeof obj.cause !== "object"
		) {
			throw new Error("Invalid ErrJSON: cause must be an object");
		}

		// Recursively parse cause and errors
		let cause: Err | undefined;
		if (obj.cause) {
			cause = Err.fromJSON(obj.cause);
		} else if (obj._cause && typeof obj._cause === "object") {
			cause = Err.fromJSON(obj._cause);
		}

		const errors: Err[] = [];
		if (Array.isArray(obj.errors)) {
			for (const e of obj.errors) {
				errors.push(Err.fromJSON(e));
			}
		} else if (Array.isArray(obj._errors)) {
			for (const e of obj._errors) {
				errors.push(Err.fromJSON(e));
			}
		}

		return new Err(obj.message, {
			code: obj.code as ErrCode | undefined,
			metadata: obj.metadata as Record<string, unknown> | undefined,
			timestamp: obj.timestamp as string | undefined,
			stack: obj.stack as string | undefined,
			cause,
			errors,
		});
	}

	/**
	 * Type guard to check if a value is an Err instance.
	 *
	 * @param value - Any value to check
	 * @returns `true` if value is an Err instance
	 */
	static isErr(value: unknown): value is Err {
		return (
			value instanceof Err ||
			(!!value &&
				typeof value === "object" &&
				// biome-ignore lint/suspicious/noExplicitAny: value can be any in this check
				((value as any).isErr === true || (value as any).kind === "Err"))
		);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Wrapping & Context
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Wrap this error with additional context.
	 *
	 * @param context - Either a message string or full options object
	 * @returns New Err instance with this error as cause
	 *
	 * @see {@link Err.wrap} for the static version (useful in catch blocks)
	 */
	// biome-ignore lint/suspicious/useAdjacentOverloadSignatures: bug, notice static and non-static signatures as of 31/12/2025
	wrap(context: string | ErrOptions): Err {
		const opts = typeof context === "string" ? { message: context } : context;
		return new Err(opts.message ?? this.message, {
			code: opts.code,
			cause: this,
			metadata: opts.metadata,
			// New stack captured - intentional, shows wrap location
		});
	}

	/**
	 * Create a new Err with a different or added error code.
	 *
	 * @param code - The error code to set
	 * @returns New Err instance with the specified code
	 */
	withCode(code: ErrCode): Err {
		return new Err(this.message, {
			code,
			cause: this._cause,
			errors: [...this._errors],
			metadata: this.metadata,
			stack: this._stack,
			timestamp: this.timestamp,
		});
	}

	/**
	 * Create a new Err with additional metadata.
	 *
	 * @param metadata - Key-value pairs to add to metadata
	 * @returns New Err instance with merged metadata
	 */
	withMetadata(metadata: Record<string, unknown>): Err {
		return new Err(this.message, {
			code: this.code,
			cause: this._cause,
			errors: [...this._errors],
			metadata: { ...this.metadata, ...metadata },
			stack: this._stack,
			timestamp: this.timestamp,
		});
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Metadata Access
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Check if metadata exists for a given key.
	 *
	 * @param key - The metadata key to check
	 * @param options - Optional configuration
	 * @param options.keyCheck - If true, only checks key existence (default: false)
	 * @returns true if metadata exists according to the selected mode
	 */
	hasMetadata(key: string, options?: { keyCheck?: boolean }): boolean {
		if (this.metadata === undefined) {
			return false;
		}

		const keyExists = key in this.metadata;
		if (!keyExists) {
			return false;
		}

		if (options?.keyCheck === true) {
			return true;
		}

		const value = this.metadata[key];
		return value !== null && value !== undefined;
	}

	/**
	 * Get metadata value for a given key.
	 *
	 * @template T - The expected type of the metadata value
	 * @param key - The metadata key to retrieve
	 * @param defaultValue - Optional default value if key is missing
	 * @returns The metadata value or default, cast to type T
	 */
	getMetadata<T = unknown>(key: string): T | undefined;
	getMetadata<T = unknown>(key: string, defaultValue: T): T;
	getMetadata<T = unknown>(key: string, defaultValue?: T): T | undefined {
		if (this.metadata === undefined) {
			return defaultValue ?? undefined;
		}

		if (!(key in this.metadata)) {
			return defaultValue ?? undefined;
		}

		return this.metadata[key] as T;
	}

	/**
	 * Create a new Err instance with specified metadata keys removed.
	 *
	 * @param key - Single key or array of keys to remove
	 * @returns New Err instance with keys omitted
	 */
	omitMetadata(key: string | string[]): Err {
		const keysToRemove = Array.isArray(key) ? key : [key];

		if (this.metadata === undefined) {
			return new Err(this.message, {
				code: this.code,
				cause: this._cause,
				errors: [...this._errors],
				metadata: undefined,
				stack: this._stack,
				timestamp: this.timestamp,
			});
		}

		const newMetadata = { ...this.metadata };
		for (const k of keysToRemove) {
			delete newMetadata[k];
		}

		const finalMetadata =
			Object.keys(newMetadata).length === 0 ? undefined : newMetadata;

		return new Err(this.message, {
			code: this.code,
			cause: this._cause,
			errors: [...this._errors],
			metadata: finalMetadata,
			stack: this._stack,
			timestamp: this.timestamp,
		});
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Aggregate Operations
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Add an error to this aggregate.
	 *
	 * @param error - Error to add (Err, Error, or string)
	 * @returns New Err instance with the error added
	 */
	add(error: Err | Error | string): Err {
		const wrapped = Err.isErr(error) ? error : Err.from(error);

		return new Err(this.message, {
			code: this.code,
			cause: this._cause,
			errors: [...this._errors, wrapped],
			metadata: this.metadata,
			stack: this._stack,
			timestamp: this.timestamp,
		});
	}

	/**
	 * Add multiple errors to this aggregate at once.
	 *
	 * @param errors - Array of errors to add
	 * @returns New Err instance with all errors added
	 */
	addAll(errors: Array<Err | Error | string>): Err {
		return errors.reduce<Err>((acc, err) => acc.add(err), this);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Inspection
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Whether this error is an aggregate containing multiple errors.
	 */
	get isAggregate(): boolean {
		return this._errors.length > 0;
	}

	/**
	 * Total count of errors (including nested aggregates).
	 */
	get count(): number {
		if (this.isAggregate) {
			return this._errors.reduce((sum, e) => sum + e.count, 0);
		}
		return 1;
	}

	/**
	 * Direct child errors (for aggregates).
	 */
	get errors(): ReadonlyArray<Err> {
		return this._errors;
	}

	/**
	 * The root/original error in a wrapped error chain.
	 */
	get root(): Err {
		return this._cause?.root ?? this;
	}

	/**
	 * Get the directly wrapped error (one level up).
	 *
	 * @returns The wrapped Err or undefined
	 */
	unwrap(): Err | undefined {
		return this._cause;
	}

	/**
	 * Get the full chain of wrapped errors from root to current.
	 *
	 * @returns Array of Err instances in causal order
	 */
	chain(): Err[] {
		const result: Err[] = [];
		let current: Err | undefined = this;
		while (current) {
			result.unshift(current);
			current = current._cause;
		}
		return result;
	}

	/**
	 * Flatten all errors into a single array.
	 *
	 * @returns Flattened array of all individual errors
	 */
	flatten(): Err[] {
		if (!this.isAggregate) {
			return [this];
		}
		return this._errors.flatMap((e) => e.flatten());
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Matching & Filtering
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Check if this error or any error in its chain/aggregate has a specific code.
	 *
	 * @param code - The error code to search for
	 * @returns `true` if the code is found anywhere in the error tree
	 */
	hasCode(code: ErrCode): boolean {
		// if (this.code === code) return true;
		// if (this._cause?.hasCode(code)) return true;
		// return this._errors.some((e) => e.hasCode(code));
		return this._searchCode((c) => c === code);
	}

	/**
	 * Check if this error or any error in its chain/aggregate has a code matching the given prefix.
	 *
	 * @param prefix - The code prefix to search for
	 * @param boundary - Separator character/string between code segments (default: ":")
	 * @returns `true` if a matching code is found anywhere in the error tree
	 */
	hasCodePrefix(prefix: string, boundary: string = ":"): boolean {
		// // Check current error's code
		// if (this.code !== undefined) {
		// 	if (this.code === prefix) return true;
		// 	if (this.code.startsWith(prefix + boundary)) return true;
		// }
		// // Search cause chain
		// if (this._cause?.hasCodePrefix(prefix, boundary)) return true;
		// // Search aggregated errors
		// return this._errors.some((e) => e.hasCodePrefix(prefix, boundary));
		return this._searchCode(
			(c) => c === prefix || c.startsWith(prefix + boundary),
		);
	}

	/**
	 * Find the first error matching a predicate.
	 *
	 * @param predicate - Function to test each error
	 * @returns The first matching Err or undefined
	 */
	find(predicate: (e: Err) => boolean): Err | undefined {
		if (predicate(this)) return this;

		const inCause = this._cause?.find(predicate);
		if (inCause) return inCause;

		for (const err of this._errors) {
			const found = err.find(predicate);
			if (found) return found;
		}

		return undefined;
	}

	/**
	 * Find all errors matching a predicate.
	 *
	 * @param predicate - Function to test each error
	 * @returns Array of all matching Err instances
	 */
	filter(predicate: (e: Err) => boolean): Err[] {
		const results: Err[] = [];

		if (predicate(this)) results.push(this);
		if (this._cause) results.push(...this._cause.filter(predicate));
		for (const err of this._errors) {
			results.push(...err.filter(predicate));
		}

		return results;
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Conversion
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Convert to a JSON-serializable object.
	 *
	 * @param options - Control what fields are included
	 * @returns Plain object representation
	 *
	 * @see {@link fromJSON} for deserializing an Err from JSON
	 */
	toJSON(options: ErrJSONOptions = {}): ErrJSON {
		const { stack = true, metadata = true } = options;

		return {
			message: this.message,
			kind: "Err",
			isErr: true,
			code: this.code,
			metadata: metadata ? this.metadata : undefined,
			timestamp: this.timestamp,
			stack: stack ? this._stack : undefined,
			cause: this._cause?.toJSON(options),
			errors: this._errors.map((e) => e.toJSON(options)),
		};
	}

	/**
	 * Recursive code search helper.
	 * @param matcher
	 * @private
	 */
	private _searchCode(matcher: (code: ErrCode) => boolean): boolean {
		if (this.code !== undefined && matcher(this.code)) return true;
		if (this._cause?._searchCode(matcher)) return true;
		return this._errors.some((e) => e._searchCode(matcher));
	}

	/**
	 * Pattern to identify internal Err class frames to filter out.
	 * Matches frames from err.ts file (handles both "at Err.from" and "at from" patterns).
	 * @internal
	 */
	private static readonly INTERNAL_FRAME_PATTERN = /\/err\.ts:\d+:\d+\)?$/;

	/**
	 * Filter out internal Err class frames from stack trace.
	 * This makes stack traces more useful by starting at user code.
	 *
	 * @param stack - Raw stack trace string
	 * @returns Stack with internal frames removed
	 * @internal
	 */
	private static _filterInternalFrames(stack: string): string {
		const lines = stack.split("\n");
		const firstLine = lines[0]; // Error message line
		const frames = lines.slice(1);

		// Find the first frame that's NOT an internal Err frame
		const firstUserFrameIndex = frames.findIndex(
			(line) => !Err.INTERNAL_FRAME_PATTERN.test(line),
		);

		if (firstUserFrameIndex <= 0) {
			// No internal frames found or already starts at user code
			return stack;
		}

		// Reconstruct stack without internal frames
		const userFrames = frames.slice(firstUserFrameIndex);
		return [firstLine, ...userFrames].join("\n");
	}

	/**
	 * Parse and extract stack frames from the stack trace.
	 *
	 * @param limit - Maximum number of frames to return (undefined = all)
	 * @returns Array of stack frame strings
	 * @internal
	 */
	private _getStackFrames(limit?: number): string[] {
		if (!this._stack) return [];

		const lines = this._stack.split("\n");
		// Skip the first line (error message) and filter to "at ..." lines
		const frames = lines
			.slice(1)
			.map((line) => line.trim())
			.filter((line) => line.startsWith("at "));

		if (limit !== undefined && limit > 0) {
			return frames.slice(0, limit);
		}
		return frames;
	}

	/**
	 * Count remaining causes in the chain from a given error.
	 *
	 * @param err - Starting error
	 * @returns Number of causes remaining
	 * @internal
	 */
	private _countRemainingCauses(err: Err | undefined): number {
		let count = 0;
		let current = err;
		while (current) {
			count++;
			current = current._cause;
		}
		return count;
	}

	/**
	 * Convert to a formatted string for logging/display.
	 *
	 * @param options - Formatting options (optional)
	 * @returns Formatted error string
	 */
	toString(options?: ToStringOptions): string {
		return this._toStringInternal(options, 0);
	}

	/**
	 * Internal toString implementation with depth tracking.
	 * @internal
	 */
	private _toStringInternal(
		options: ToStringOptions | undefined,
		currentDepth: number,
	): string {
		const indent = options?.indent ?? "  ";

		// Build the main error line
		let result = "";

		// Add timestamp if requested
		if (options?.date) {
			result += `[${this.timestamp}] `;
		}

		// Add code and message
		result += `[${this.code ?? "ERROR"}] ${this.message}`;

		// Add metadata if requested
		if (options?.metadata && this.metadata) {
			result += `\n${indent}metadata: ${JSON.stringify(this.metadata)}`;
		}

		// Add stack trace if requested
		if (options?.stack) {
			const frameLimit =
				typeof options.stack === "number" ? options.stack : undefined;
			const frames = this._getStackFrames(frameLimit);
			if (frames.length > 0) {
				result += `\n${indent}stack:`;
				for (const frame of frames) {
					result += `\n${indent}${indent}${frame}`;
				}
			}
		}

		// Handle cause chain with depth limiting
		if (this._cause) {
			const maxDepth = options?.maxDepth;
			if (maxDepth !== undefined && currentDepth >= maxDepth) {
				// Depth limit reached - show remaining count
				const remaining = this._countRemainingCauses(this._cause);
				result += `\n${indent}... (${remaining} more cause${remaining > 1 ? "s" : ""})`;
			} else {
				// Recurse into cause
				const causeStr = this._cause._toStringInternal(
					options,
					currentDepth + 1,
				);
				result += `\n${indent}Caused by: ${causeStr.replace(/\n/g, `\n${indent}`)}`;
			}
		}

		// Handle aggregated errors
		if (this._errors.length > 0) {
			result += `\n${indent}Errors (${this._errors.length}):`;
			for (const err of this._errors) {
				// Aggregated errors start at depth 0 for their own chain
				const errStr = err._toStringInternal(options, 0);
				result += `\n${indent}${indent}- ${errStr.replace(/\n/g, `\n${indent}${indent}  `)}`;
			}
		}

		return result;
	}

	/**
	 * Convert to a native Error for interop with throw-based APIs.
	 *
	 * @returns Native Error instance
	 */
	toError(): Error {
		const err = new Error(this.message);
		err.name = this.code ?? "Err";

		// Preserve original stack trace
		if (this._stack) {
			err.stack = this._stack;
		}

		// Preserve cause chain
		if (this._cause) {
			err.cause = this._cause.toError();
		}
		return err;
	}

	/**
	 * Get the captured stack trace.
	 *
	 * For errors created from native Errors, this is the original stack.
	 * For errors created via `Err.from(string)`, this is the stack at creation.
	 * For wrapped errors, use `.root.stack` to get the original location.
	 *
	 * @returns Stack trace string or undefined
	 */
	get stack(): string | undefined {
		return this._stack;
	}
}
