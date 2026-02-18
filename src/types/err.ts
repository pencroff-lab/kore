/**
 * @fileoverview Error-as-value implementation for TypeScript applications.
 *
 * This module provides a Go-style error handling approach where errors are
 * passed as values rather than thrown as exceptions. The `Err` class supports
 * both single error wrapping with context and error aggregation.
 *
 * ## Immutability Contract
 *
 * All `Err` instances are immutable. Methods that appear to modify an error
 * (like `wrap`, `withCode`, `withMetadata`, `add`) return new instances.
 * The original error is never mutated. This means:
 *
 * - Safe to pass errors across boundaries without defensive copying
 * - Method chaining always produces new instances
 * - No "spooky action at a distance" bugs
 *
 * @example Basic usage with tuple pattern
 * ```typescript
 * import { Err } from './err';
 *
 * function divide(a: number, b: number): [number, null] | [null, Err] {
 *   if (b === 0) {
 *     return [null, Err.from('Division by zero', 'MATH_ERROR')];
 *   }
 *   return [a / b, null];
 * }
 *
 * const [result, err] = divide(10, 0);
 * if (err) {
 *   console.error(err.toString());
 *   return;
 * }
 * console.log(result); // result is number here
 * ```
 *
 * @example Error wrapping with context
 * ```typescript
 * function readConfig(path: string): [Config, null] | [null, Err] {
 *   const [content, readErr] = readFile(path);
 *   if (readErr) {
 *     return [null, readErr.wrap(`Failed to read config from ${path}`)];
 *   }
 *
 *   const [parsed, parseErr] = parseJSON(content);
 *   if (parseErr) {
 *     return [null, parseErr
 *       .wrap('Invalid config format')
 *       .withCode('CONFIG_ERROR')
 *       .withMetadata({ path })];
 *   }
 *
 *   return [parsed as Config, null];
 * }
 * ```
 *
 * @example Static wrap for catching native errors
 * ```typescript
 * function parseData(raw: string): [Data, null] | [null, Err] {
 *   try {
 *     return [JSON.parse(raw), null];
 *   } catch (e) {
 *     return [null, Err.wrap('Failed to parse data', e as Error)];
 *   }
 * }
 * ```
 *
 * @example Aggregating multiple errors
 * ```typescript
 * function validateUser(input: UserInput): [User, null] | [null, Err] {
 *   let errors = Err.aggregate('Validation failed');
 *
 *   if (!input.name?.trim()) {
 *     errors = errors.add('Name is required');
 *   }
 *   if (!input.email?.includes('@')) {
 *     errors = errors.add(Err.from('Invalid email', 'INVALID_EMAIL'));
 *   }
 *   if (input.age !== undefined && input.age < 0) {
 *     errors = errors.add('Age cannot be negative');
 *   }
 *
 *   if (errors.count > 0) {
 *     return [null, errors.withCode('VALIDATION_ERROR')];
 *   }
 *
 *   return [input as User, null];
 * }
 * ```
 *
 * @example Serialization for service-to-service communication
 * ```typescript
 * // Backend: serialize error for API response
 * const err = Err.from('User not found', 'NOT_FOUND');
 * res.status(404).json({ error: err.toJSON() });
 *
 * // Frontend: deserialize error from API response
 * const response = await fetch('/api/user/123');
 * if (!response.ok) {
 *   const { error } = await response.json();
 *   const err = Err.fromJSON(error);
 *   console.log(err.code); // 'NOT_FOUND'
 * }
 *
 * // Public API: omit stack traces
 * res.json({ error: err.toJSON({ stack: false }) });
 * ```
 *
 * @module err
 */

/**
 * Error code type - typically uppercase snake_case identifiers.
 *
 * @example
 * ```typescript
 * const codes: ErrCode[] = [
 *   'NOT_FOUND',
 *   'VALIDATION_ERROR',
 *   'DB_CONNECTION_FAILED',
 *   'AUTH_EXPIRED',
 * ];
 * ```
 */
export type ErrCode = string;

/**
 * Options for creating or modifying an Err instance.
 */
export interface ErrOptions {
	/** Error code for programmatic error handling */
	code?: ErrCode;
	/** Human-readable error message */
	message?: string;
	/** Additional contextual data */
	metadata?: Record<string, unknown>;
}

/**
 * Options for JSON serialization.
 */
export interface ErrJSONOptions {
	/**
	 * Include stack trace in output.
	 * Set to `false` for public API responses.
	 * @default true
	 */
	stack?: boolean;
	/**
	 * Include metadata in output.
	 * Set to `false` to omit potentially sensitive data.
	 * @default true
	 */
	metadata?: boolean;
}

/**
 * Options for toString() output formatting.
 */
export interface ToStringOptions {
	/**
	 * Include stack trace in output.
	 * - `true`: Include full stack trace
	 * - `number`: Include only top N frames (default: 3 when number)
	 * @default undefined (no stack)
	 */
	stack?: boolean | number;
	/**
	 * Include timestamp in output (ISO 8601 format).
	 * @default false
	 */
	date?: boolean;
	/**
	 * Include metadata object in output.
	 * @default false
	 */
	metadata?: boolean;
	/**
	 * Maximum depth for cause chain traversal.
	 * When exceeded, shows "... (N more causes)".
	 * @default undefined (unlimited)
	 */
	maxDepth?: number;
	/**
	 * Indentation string for nested output.
	 * @default "  " (two spaces)
	 */
	indent?: string;
}

/**
 * JSON representation of an Err for serialization.
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
 * A value-based error type that supports wrapping and aggregation.
 *
 * `Err` is designed to be returned from functions instead of throwing exceptions,
 * following the Go-style error handling pattern. It supports:
 *
 * - **Single errors**: Created via `Err.from()` with optional code and metadata
 * - **Error wrapping**: Adding context to errors as they propagate up the call stack
 * - **Error aggregation**: Collecting multiple errors under a single parent (e.g., validation)
 * - **Serialization**: Convert to/from JSON for service-to-service communication
 *
 * All instances are immutable - methods return new instances rather than mutating.
 *
 * @example Creating errors
 * ```typescript
 * // From string with code (most common)
 * const err1 = Err.from('User not found', 'NOT_FOUND');
 *
 * // From string with full options
 * const err2 = Err.from('Connection timeout', {
 *   code: 'TIMEOUT',
 *   metadata: { host: 'api.example.com' }
 * });
 *
 * // From native Error (preserves original stack and cause chain)
 * try {
 *   riskyOperation();
 * } catch (e) {
 *   const err = Err.from(e).withCode('OPERATION_FAILED');
 *   return [null, err];
 * }
 *
 * // From unknown (safe for catch blocks)
 * const err3 = Err.from(unknownValue);
 * ```
 *
 * @example Wrapping errors with static method
 * ```typescript
 * try {
 *   await db.query(sql);
 * } catch (e) {
 *   return [null, Err.wrap('Database query failed', e as Error)];
 * }
 * ```
 *
 * @example Aggregating errors
 * ```typescript
 * let errors = Err.aggregate('Multiple operations failed')
 *   .add(Err.from('Database write failed'))
 *   .add(Err.from('Cache invalidation failed'))
 *   .add('Notification send failed'); // strings are auto-wrapped
 *
 * console.log(errors.count); // 3
 * console.log(errors.flatten()); // Array of all individual errors
 * ```
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
	 *
	 * Useful when checking values from external sources (API responses,
	 * message queues) where `instanceof` may not work.
	 *
	 * @example
	 * ```typescript
	 * // Checking unknown values from API
	 * const data = await response.json();
	 * if (data.error?.isErr) {
	 *   // Likely an Err-like object
	 * }
	 *
	 * // For type narrowing, prefer Err.isErr()
	 * if (Err.isErr(value)) {
	 *   console.error(value.message);
	 * }
	 * ```
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
	 *
	 * @example
	 * ```typescript
	 * const err = Err.from('User not found', 'NOT_FOUND');
	 * ```
	 */
	static from(message: string, code?: ErrCode): Err;

	/**
	 * Create an Err from a string message with full options.
	 *
	 * @param message - Error message
	 * @param options - Code and metadata options
	 * @returns New Err instance
	 *
	 * @example
	 * ```typescript
	 * const err = Err.from('Connection timeout', {
	 *   code: 'TIMEOUT',
	 *   metadata: { host: 'api.example.com', timeoutMs: 5000 }
	 * });
	 * ```
	 */
	static from(message: string, options: ErrOptions): Err;

	/**
	 * Create an Err from a native Error.
	 *
	 * Preserves the original error's:
	 * - Stack trace (as primary stack for debugging)
	 * - Cause chain (if `error.cause` is Error or string)
	 * - Name (in metadata as `originalName`)
	 *
	 * @param error - Native Error instance
	 * @param options - Optional overrides for message, code, and metadata
	 * @returns New Err instance
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   JSON.parse(invalidJson);
	 * } catch (e) {
	 *   return Err.from(e as Error, { code: 'PARSE_ERROR' });
	 * }
	 * ```
	 */
	static from(error: Error, options?: ErrOptions): Err;

	/**
	 * Create an Err from another Err instance (clone with optional overrides).
	 *
	 * @param error - Existing Err instance
	 * @param options - Optional overrides
	 * @returns New Err instance with merged properties
	 *
	 * @example
	 * ```typescript
	 * const original = Err.from('Original error');
	 * const modified = Err.from(original, { code: 'NEW_CODE' });
	 * ```
	 */
	static from(error: Err, options?: ErrOptions): Err;

	/**
	 * Create an Err from an unknown value (safe for catch blocks).
	 *
	 * Handles any value that might be thrown, including non-Error objects,
	 * strings, numbers, null, and undefined.
	 *
	 * @param error - Any value
	 * @param options - Optional code and metadata
	 * @returns New Err instance
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   await riskyAsyncOperation();
	 * } catch (e) {
	 *   // Safe - handles any thrown value
	 *   return Err.from(e).wrap('Operation failed');
	 * }
	 * ```
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
	 * Creates a new Err with the provided message, having the original
	 * error as its cause. This is the recommended pattern for catch blocks.
	 *
	 * @param message - Context message explaining what operation failed
	 * @param error - The original error (Err, Error, or string)
	 * @param options - Optional code and metadata for the wrapper
	 * @returns New Err instance with the original as cause
	 *
	 * @see {@link Err.prototype.wrap} for the instance method
	 *
	 * @example Basic usage in catch block
	 * ```typescript
	 * try {
	 *   await db.query(sql);
	 * } catch (e) {
	 *   return Err.wrap('Database query failed', e as Error);
	 * }
	 * ```
	 *
	 * @example With code and metadata
	 * ```typescript
	 * try {
	 *   const user = await fetchUser(id);
	 * } catch (e) {
	 *   return Err.wrap('Failed to fetch user', e as Error, {
	 *     code: 'USER_FETCH_ERROR',
	 *     metadata: { userId: id }
	 *   });
	 * }
	 * ```
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
	 * Useful for validation, batch operations, or any scenario where
	 * multiple errors should be collected and reported together.
	 *
	 * @param message - Parent error message describing the aggregate
	 * @param errors - Optional initial list of errors
	 * @param options - Optional code and metadata for the aggregate
	 * @returns New aggregate Err instance
	 *
	 * @example Validation
	 * ```typescript
	 * function validate(data: Input): [Valid, null] | [null, Err] {
	 *   let errors = Err.aggregate('Validation failed');
	 *
	 *   if (!data.email) errors = errors.add('Email is required');
	 *   if (!data.name) errors = errors.add('Name is required');
	 *
	 *   if (errors.count > 0) {
	 *     return [null, errors.withCode('VALIDATION_ERROR')];
	 *   }
	 *   return [data as Valid, null];
	 * }
	 * ```
	 *
	 * @example Batch operations
	 * ```typescript
	 * async function processAll(items: Item[]): [null, Err] | [void, null] {
	 *   let errors = Err.aggregate('Batch processing failed');
	 *
	 *   for (const item of items) {
	 *     const [, err] = await processItem(item);
	 *     if (err) {
	 *       errors = errors.add(err.withMetadata({ itemId: item.id }));
	 *     }
	 *   }
	 *
	 *   if (errors.count > 0) return [null, errors];
	 *   return [undefined, null];
	 * }
	 * ```
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
	 * Reconstructs an Err instance from its JSON form, including
	 * cause chains and aggregated errors. Validates the input structure.
	 *
	 * @param json - JSON object matching ErrJSON structure
	 * @returns Reconstructed Err instance
	 * @throws Error if json is invalid or missing required fields
	 *
	 * @see {@link toJSON} for serializing an Err to JSON
	 *
	 * @example API response handling
	 * ```typescript
	 * const response = await fetch('/api/users/123');
	 * if (!response.ok) {
	 *   const body = await response.json();
	 *   if (body.error) {
	 *     const err = Err.fromJSON(body.error);
	 *     if (err.hasCode('NOT_FOUND')) {
	 *       return showNotFound();
	 *     }
	 *     return showError(err);
	 *   }
	 * }
	 * ```
	 *
	 * @example Message queue processing
	 * ```typescript
	 * queue.on('error', (message) => {
	 *   const err = Err.fromJSON(message.payload);
	 *   logger.error('Task failed', { error: err.toJSON() });
	 * });
	 * ```
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
	 * Useful for checking values from external sources where
	 * `instanceof` may not work (different realms, serialization).
	 *
	 * @param value - Any value to check
	 * @returns `true` if value is an Err instance
	 *
	 * @example Checking external/unknown values
	 * ```typescript
	 * // Useful for values from external sources
	 * function handleApiResponse(data: unknown): void {
	 *   if (Err.isErr(data)) {
	 *     console.error('Received error:', data.message);
	 *     return;
	 *   }
	 *   // Process data...
	 * }
	 * ```
	 *
	 * @example With tuple pattern (preferred for known types)
	 * ```typescript
	 * function getUser(id: string): [User, null] | [null, Err] {
	 *   // ...
	 * }
	 *
	 * const [user, err] = getUser('123');
	 * if (err) {
	 *   console.error(err.message);
	 *   return;
	 * }
	 * console.log(user.name);
	 * ```
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
	 * Creates a new error that has this error as its cause. The original error
	 * is preserved and accessible via `unwrap()` or `chain()`.
	 *
	 * ## Stack Trace Behavior
	 *
	 * The new wrapper captures a fresh stack trace pointing to where `wrap()`
	 * was called. This is intentional - it shows the propagation path. The
	 * original error's stack is preserved and accessible via:
	 * - `err.unwrap()?.stack` - immediate cause's stack
	 * - `err.root.stack` - original error's stack
	 *
	 * @param context - Either a message string or full options object
	 * @returns New Err instance with this error as cause
	 *
	 * @see {@link Err.wrap} for the static version (useful in catch blocks)
	 *
	 * @example Simple wrapping
	 * ```typescript
	 * const dbErr = queryDatabase();
	 * if (Err.isErr(dbErr)) {
	 *   return dbErr.wrap('Failed to fetch user');
	 * }
	 * ```
	 *
	 * @example Wrapping with full options
	 * ```typescript
	 * return originalErr.wrap({
	 *   message: 'Service unavailable',
	 *   code: 'SERVICE_ERROR',
	 *   metadata: { service: 'user-service', retryAfter: 30 }
	 * });
	 * ```
	 *
	 * @example Accessing original stack
	 * ```typescript
	 * const wrapped = original.wrap('Context 1').wrap('Context 2');
	 * console.log(wrapped.stack);       // Points to second wrap() call
	 * console.log(wrapped.root.stack);  // Points to original error location
	 * ```
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
	 * Preserves the original stack trace and timestamp.
	 *
	 * @param code - The error code to set
	 * @returns New Err instance with the specified code
	 *
	 * @example
	 * ```typescript
	 * const err = Err.from('Record not found').withCode('NOT_FOUND');
	 *
	 * if (err.code === 'NOT_FOUND') {
	 *   return res.status(404).json(err.toJSON());
	 * }
	 * ```
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
	 * New metadata is merged with existing metadata. Preserves the original
	 * stack trace and timestamp.
	 *
	 * @param metadata - Key-value pairs to add to metadata
	 * @returns New Err instance with merged metadata
	 *
	 * @example
	 * ```typescript
	 * const err = Err.from('Request failed')
	 *   .withMetadata({ url: '/api/users' })
	 *   .withMetadata({ statusCode: 500, retryable: true });
	 *
	 * console.log(err.metadata);
	 * // { url: '/api/users', statusCode: 500, retryable: true }
	 * ```
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
	// Aggregate Operations
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Add an error to this aggregate.
	 *
	 * Returns a new Err with the error added to the list (immutable).
	 * If this is not an aggregate error, it will be treated as one with
	 * the added error as the first child.
	 *
	 * @param error - Error to add (Err, Error, or string)
	 * @returns New Err instance with the error added
	 *
	 * @example
	 * ```typescript
	 * let errors = Err.aggregate('Form validation failed');
	 *
	 * if (!email) {
	 *   errors = errors.add('Email is required');
	 * }
	 * if (!password) {
	 *   errors = errors.add(Err.from('Password is required').withCode('MISSING_PASSWORD'));
	 * }
	 * ```
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
	 * Returns a new Err with all errors added (immutable).
	 *
	 * @param errors - Array of errors to add
	 * @returns New Err instance with all errors added
	 *
	 * @example
	 * ```typescript
	 * const validationErrors = [
	 *   'Name too short',
	 *   Err.from('Invalid email format').withCode('INVALID_EMAIL'),
	 *   new Error('Age must be positive'),
	 * ];
	 *
	 * const aggregate = Err.aggregate('Validation failed').addAll(validationErrors);
	 * ```
	 */
	addAll(errors: Array<Err | Error | string>): Err {
		return errors.reduce<Err>((acc, err) => acc.add(err), this);
	}

	// ══════════════════════════════════════════════════════════════════════════
	// Inspection
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * Whether this error is an aggregate containing multiple errors.
	 *
	 * @example
	 * ```typescript
	 * const single = Err.from('Single error');
	 * const multi = Err.aggregate('Multiple').add('One').add('Two');
	 *
	 * console.log(single.isAggregate); // false
	 * console.log(multi.isAggregate);  // true
	 * ```
	 */
	get isAggregate(): boolean {
		return this._errors.length > 0;
	}

	/**
	 * Total count of errors (including nested aggregates).
	 *
	 * For single errors, returns 1.
	 * For aggregates, recursively counts all child errors.
	 *
	 * @example
	 * ```typescript
	 * const single = Err.from('One error');
	 * console.log(single.count); // 1
	 *
	 * const nested = Err.aggregate('Parent')
	 *   .add('Error 1')
	 *   .add(Err.aggregate('Child').add('Error 2').add('Error 3'));
	 *
	 * console.log(nested.count); // 3
	 * ```
	 */
	get count(): number {
		if (this.isAggregate) {
			return this._errors.reduce((sum, e) => sum + e.count, 0);
		}
		return 1;
	}

	/**
	 * Direct child errors (for aggregates).
	 *
	 * Returns an empty array for non-aggregate errors.
	 *
	 * @example
	 * ```typescript
	 * const aggregate = Err.aggregate('Batch failed')
	 *   .add('Task 1 failed')
	 *   .add('Task 2 failed');
	 *
	 * for (const err of aggregate.errors) {
	 *   console.log(err.message);
	 * }
	 * // "Task 1 failed"
	 * // "Task 2 failed"
	 * ```
	 */
	get errors(): ReadonlyArray<Err> {
		return this._errors;
	}

	/**
	 * The root/original error in a wrapped error chain.
	 *
	 * Follows the cause chain to find the deepest error.
	 * Returns `this` if there is no cause.
	 *
	 * @example
	 * ```typescript
	 * const root = Err.from('Original error');
	 * const wrapped = root
	 *   .wrap('Added context')
	 *   .wrap('More context');
	 *
	 * console.log(wrapped.message);      // "More context"
	 * console.log(wrapped.root.message); // "Original error"
	 * console.log(wrapped.root.stack);   // Stack pointing to original error
	 * ```
	 */
	get root(): Err {
		return this._cause?.root ?? this;
	}

	/**
	 * Get the directly wrapped error (one level up).
	 *
	 * Returns `undefined` if this error has no cause.
	 *
	 * @returns The wrapped Err or undefined
	 *
	 * @example
	 * ```typescript
	 * const inner = Err.from('DB connection failed');
	 * const outer = inner.wrap('Could not save user');
	 *
	 * const unwrapped = outer.unwrap();
	 * console.log(unwrapped?.message); // "DB connection failed"
	 * console.log(inner.unwrap());     // undefined
	 * ```
	 */
	unwrap(): Err | undefined {
		return this._cause;
	}

	/**
	 * Get the full chain of wrapped errors from root to current.
	 *
	 * The first element is the root/original error, the last is `this`.
	 *
	 * @returns Array of Err instances in causal order
	 *
	 * @remarks
	 * Time complexity: O(n) where n is the depth of the cause chain.
	 *
	 * @example
	 * ```typescript
	 * const chain = Err.from('Network timeout')
	 *   .wrap('API request failed')
	 *   .wrap('Could not refresh token')
	 *   .wrap('Authentication failed')
	 *   .chain();
	 *
	 * console.log(chain.map(e => e.message));
	 * // [
	 * //   "Network timeout",
	 * //   "API request failed",
	 * //   "Could not refresh token",
	 * //   "Authentication failed"
	 * // ]
	 * ```
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
	 * For aggregates, recursively collects all leaf errors.
	 * For single errors, returns an array containing just this error.
	 *
	 * @returns Flattened array of all individual errors
	 *
	 * @remarks
	 * Time complexity: O(n) where n is the total number of errors in all nested aggregates.
	 * Recursively traverses the error tree.
	 *
	 * @example
	 * ```typescript
	 * const nested = Err.aggregate('All errors')
	 *   .add('Error A')
	 *   .add(Err.aggregate('Group B')
	 *     .add('Error B1')
	 *     .add('Error B2'))
	 *   .add('Error C');
	 *
	 * const flat = nested.flatten();
	 * console.log(flat.map(e => e.message));
	 * // ["Error A", "Error B1", "Error B2", "Error C"]
	 * ```
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
	 * Searches the cause chain and all aggregated errors.
	 *
	 * @param code - The error code to search for
	 * @returns `true` if the code is found anywhere in the error tree
	 *
	 * @example
	 * ```typescript
	 * const err = Err.from('DB error', 'DB_ERROR')
	 *   .wrap('Repository failed')
	 *   .wrap('Service unavailable');
	 *
	 * console.log(err.hasCode('DB_ERROR'));      // true
	 * console.log(err.hasCode('NETWORK_ERROR')); // false
	 * ```
	 */
	hasCode(code: ErrCode): boolean {
		// if (this.code === code) return true;
		// if (this._cause?.hasCode(code)) return true;
		// return this._errors.some((e) => e.hasCode(code));
		return this._searchCode((c) => c === code);
	}

	/**
	 * Check if this error or any error in its chain/aggregate has a code
	 * matching the given prefix with boundary awareness.
	 *
	 * This enables hierarchical error code patterns like `AUTH:TOKEN:EXPIRED`
	 * where libraries define base codes and consumers extend with subcodes.
	 *
	 * Matches if:
	 * - Code equals prefix exactly (e.g., `"AUTH"` matches `"AUTH"`)
	 * - Code starts with prefix + boundary (e.g., `"AUTH"` matches `"AUTH:EXPIRED"`)
	 *
	 * Does NOT match partial strings (e.g., `"AUTH"` does NOT match `"AUTHORIZATION"`).
	 *
	 * @param prefix - The code prefix to search for
	 * @param boundary - Separator character/string between code segments (default: ":")
	 * @returns `true` if a matching code is found anywhere in the error tree
	 *
	 * @example Basic hierarchical codes
	 * ```typescript
	 * const err = Err.from('Token expired', { code: 'AUTH:TOKEN:EXPIRED' });
	 *
	 * err.hasCodePrefix('AUTH');           // true (matches AUTH:*)
	 * err.hasCodePrefix('AUTH:TOKEN');     // true (matches AUTH:TOKEN:*)
	 * err.hasCodePrefix('AUTHORIZATION');  // false (no boundary match)
	 * ```
	 *
	 * @example Custom boundary
	 * ```typescript
	 * const err = Err.from('Not found', { code: 'HTTP.404.NOT_FOUND' });
	 *
	 * err.hasCodePrefix('HTTP', '.');      // true
	 * err.hasCodePrefix('HTTP.404', '.');  // true
	 * err.hasCodePrefix('HTTP', ':');      // false (wrong boundary)
	 * ```
	 *
	 * @example Search in error tree
	 * ```typescript
	 * const err = Err.from('DB error', { code: 'DB:CONNECTION' })
	 *   .wrap('Service failed', { code: 'SERVICE:UNAVAILABLE' });
	 *
	 * err.hasCodePrefix('DB');       // true (found in cause)
	 * err.hasCodePrefix('SERVICE');  // true (found in current)
	 * ```
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
	 * Searches this error, its cause chain, and all aggregated errors.
	 *
	 * @param predicate - Function to test each error
	 * @returns The first matching Err or undefined
	 *
	 * @example
	 * ```typescript
	 * const err = Err.aggregate('Multiple failures')
	 *   .add(Err.from('Not found', 'NOT_FOUND'))
	 *   .add(Err.from('Timeout', 'TIMEOUT'));
	 *
	 * const timeout = err.find(e => e.code === 'TIMEOUT');
	 * console.log(timeout?.message); // "Timeout"
	 * ```
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
	 * Searches this error, its cause chain, and all aggregated errors.
	 *
	 * @param predicate - Function to test each error
	 * @returns Array of all matching Err instances
	 *
	 * @example
	 * ```typescript
	 * const err = Err.aggregate('Validation failed')
	 *   .add(Err.from('Name required', 'REQUIRED'))
	 *   .add(Err.from('Invalid email', 'INVALID'))
	 *   .add(Err.from('Age required', 'REQUIRED'));
	 *
	 * const required = err.filter(e => e.code === 'REQUIRED');
	 * console.log(required.length); // 2
	 * ```
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
	 * Useful for logging, API responses, and serialization.
	 * Use options to control what's included (e.g., omit stack for public APIs).
	 *
	 * @param options - Control what fields are included
	 * @returns Plain object representation
	 *
	 * @see {@link fromJSON} for deserializing an Err from JSON
	 *
	 * @example Full serialization (default)
	 * ```typescript
	 * const err = Err.from('Not found', {
	 *   code: 'NOT_FOUND',
	 *   metadata: { userId: '123' }
	 * });
	 *
	 * console.log(JSON.stringify(err.toJSON(), null, 2));
	 * // {
	 * //   "message": "Not found",
	 * //   "code": "NOT_FOUND",
	 * //   "metadata": { "userId": "123" },
	 * //   "timestamp": "2024-01-15T10:30:00.000Z",
	 * //   "stack": "Error: ...",
	 * //   "errors": []
	 * // }
	 * ```
	 *
	 * @example Public API response (no stack)
	 * ```typescript
	 * app.get('/user/:id', (req, res) => {
	 *   const result = getUser(req.params.id);
	 *   if (Err.isErr(result)) {
	 *     const status = result.code === 'NOT_FOUND' ? 404 : 500;
	 *     return res.status(status).json({
	 *       error: result.toJSON({ stack: false })
	 *     });
	 *   }
	 *   res.json(result);
	 * });
	 * ```
	 *
	 * @example Minimal payload
	 * ```typescript
	 * err.toJSON({ stack: false, metadata: false });
	 * // Only includes: message, code, timestamp, cause, errors
	 * ```
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
	 * Includes cause chain and aggregated errors with indentation.
	 * When called with options, can include additional details like
	 * stack traces, timestamps, and metadata.
	 *
	 * @param options - Formatting options (optional)
	 * @returns Formatted error string
	 *
	 * @example Basic usage (no options - backward compatible)
	 * ```typescript
	 * const err = Err.from('DB error')
	 *   .wrap('Repository failed')
	 *   .wrap('Service unavailable');
	 *
	 * console.log(err.toString());
	 * // [ERROR] Service unavailable
	 * //   Caused by: [ERROR] Repository failed
	 * //     Caused by: [ERROR] DB error
	 * ```
	 *
	 * @example With options
	 * ```typescript
	 * const err = Err.from('Connection failed', {
	 *   code: 'DB:CONNECTION',
	 *   metadata: { host: 'localhost', port: 5432 }
	 * });
	 *
	 * console.log(err.toString({ date: true, metadata: true, stack: 3 }));
	 * // [2024-01-15T10:30:00.000Z] [DB:CONNECTION] Connection failed
	 * //   metadata: {"host":"localhost","port":5432}
	 * //   stack:
	 * //     at Database.connect (src/db.ts:45)
	 * //     at Repository.init (src/repo.ts:23)
	 * //     at Service.start (src/service.ts:12)
	 * ```
	 *
	 * @example Aggregate
	 * ```typescript
	 * const err = Err.aggregate('Validation failed', [], { code: 'VALIDATION' })
	 *   .add('Name required')
	 *   .add('Email invalid');
	 *
	 * console.log(err.toString());
	 * // [VALIDATION] Validation failed
	 * //   Errors (2):
	 * //     - [ERROR] Name required
	 * //     - [ERROR] Email invalid
	 * ```
	 *
	 * @example With maxDepth limit
	 * ```typescript
	 * const deep = Err.from('Root')
	 *   .wrap('Level 1')
	 *   .wrap('Level 2')
	 *   .wrap('Level 3');
	 *
	 * console.log(deep.toString({ maxDepth: 2 }));
	 * // [ERROR] Level 3
	 * //   Caused by: [ERROR] Level 2
	 * //     ... (2 more causes)
	 * ```
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
	 * Creates an Error with:
	 * - `message`: This error's message
	 * - `name`: This error's code (or "Err")
	 * - `stack`: This error's original stack trace
	 * - `cause`: Converted cause chain (native Error)
	 *
	 * Note: Metadata is not included on the native Error.
	 *
	 * @returns Native Error instance
	 *
	 * @example
	 * ```typescript
	 * const err = Err.from('Something failed', 'MY_ERROR');
	 *
	 * // If you need to throw for some API
	 * throw err.toError();
	 *
	 * // The thrown error will have:
	 * // - error.message === "Something failed"
	 * // - error.name === "MY_ERROR"
	 * // - error.stack === (original stack trace)
	 * // - error.cause === (if wrapped)
	 * ```
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
