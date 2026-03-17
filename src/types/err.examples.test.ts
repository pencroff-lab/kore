import { describe, expect, test } from "bun:test";
import type { ErrJSON } from "./err";
import { Err } from "./err";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Basic usage
// ══════════════════════════════════════════════════════════════════════════════

describe("Basic usage", () => {
	test("tuple pattern with Err.from and code", () => {
		function divide(a: number, b: number): [number, null] | [null, Err] {
			if (b === 0) {
				return [null, Err.from("Division by zero", "MATH_ERROR")];
			}
			return [a / b, null];
		}

		const [result, err] = divide(10, 0);
		expect(err).not.toBeNull();
		expect(Err.isErr(err)).toBe(true);
		expect(err?.message).toBe("Division by zero");
		expect(err?.code).toBe("MATH_ERROR");
		expect(result).toBeNull();

		const [result2, err2] = divide(10, 2);
		expect(err2).toBeNull();
		expect(result2).toBe(5);
	});

	test("creating error from string with code", () => {
		const err = Err.from("User not found", "NOT_FOUND");
		expect(err.message).toBe("User not found");
		expect(err.code).toBe("NOT_FOUND");
	});

	test("creating error from string with full options", () => {
		const err = Err.from("Connection timeout", {
			code: "TIMEOUT",
			metadata: { host: "api.example.com", timeoutMs: 5000 },
		});
		expect(err.message).toBe("Connection timeout");
		expect(err.code).toBe("TIMEOUT");
		expect(err.metadata).toEqual({
			host: "api.example.com",
			timeoutMs: 5000,
		});
	});

	test("creating error from native Error", () => {
		const nativeErr = new TypeError("Cannot read property");
		const err = Err.from(nativeErr).withCode("OPERATION_FAILED");
		expect(err.message).toBe("Cannot read property");
		expect(err.code).toBe("OPERATION_FAILED");
		expect(err.metadata?.originalName).toBe("TypeError");
	});

	test("creating error from native Error with options", () => {
		try {
			JSON.parse("{invalid");
		} catch (e) {
			const err = Err.from(e as Error, { code: "PARSE_ERROR" });
			expect(err.code).toBe("PARSE_ERROR");
			expect(err.message).toBeTruthy();
		}
	});

	test("creating error from unknown value", () => {
		const err = Err.from(42);
		expect(err.message).toBe("Unknown error");
		expect(err.code).toBe("UNKNOWN");
		expect(err.metadata?.originalValue).toBe(42);
	});

	test("cloning Err with overrides", () => {
		const original = Err.from("Original error");
		const modified = Err.from(original, { code: "NEW_CODE" });
		expect(modified.message).toBe("Original error");
		expect(modified.code).toBe("NEW_CODE");
		expect(original.code).toBeUndefined();
	});

	test("isErr discriminator property", () => {
		const err = Err.from("test");
		expect(err.isErr).toBe(true);
		expect(err.kind).toBe("Err");
	});

	test("Err.isErr type guard", () => {
		const err = Err.from("test");
		expect(Err.isErr(err)).toBe(true);
		expect(Err.isErr("not an error")).toBe(false);
		expect(Err.isErr(null)).toBe(false);
		expect(Err.isErr({ isErr: true })).toBe(true);
		expect(Err.isErr({ kind: "Err" })).toBe(true);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Error wrapping
// ══════════════════════════════════════════════════════════════════════════════

describe("Error wrapping", () => {
	test("wrapping with context message", () => {
		const readErr = Err.from("File not found");
		const configErr = readErr.wrap("Failed to read config from /etc/app.json");

		expect(configErr.message).toBe("Failed to read config from /etc/app.json");
		expect(configErr.unwrap()?.message).toBe("File not found");
	});

	test("wrapping with code and metadata via chaining", () => {
		const parseErr = Err.from("Unexpected token");
		const configErr = parseErr
			.wrap("Invalid config format")
			.withCode("CONFIG_ERROR")
			.withMetadata({ path: "/etc/app.json" });

		expect(configErr.message).toBe("Invalid config format");
		expect(configErr.code).toBe("CONFIG_ERROR");
		expect(configErr.metadata?.path).toBe("/etc/app.json");
	});

	test("wrapping with full options object", () => {
		const originalErr = Err.from("Original error");
		const wrapped = originalErr.wrap({
			message: "Service unavailable",
			code: "SERVICE_ERROR",
			metadata: { service: "user-service", retryAfter: 30 },
		});

		expect(wrapped.message).toBe("Service unavailable");
		expect(wrapped.code).toBe("SERVICE_ERROR");
		expect(wrapped.metadata).toEqual({
			service: "user-service",
			retryAfter: 30,
		});
		expect(wrapped.unwrap()?.message).toBe("Original error");
	});

	test("accessing root through multiple wraps", () => {
		const root = Err.from("Original error");
		const wrapped = root.wrap("Added context").wrap("More context");

		expect(wrapped.message).toBe("More context");
		expect(wrapped.root.message).toBe("Original error");
	});

	test("chain returns errors from root to current", () => {
		const chain = Err.from("Network timeout")
			.wrap("API request failed")
			.wrap("Could not refresh token")
			.wrap("Authentication failed")
			.chain();

		expect(chain.map((e) => e.message)).toEqual([
			"Network timeout",
			"API request failed",
			"Could not refresh token",
			"Authentication failed",
		]);
	});

	test("unwrap returns immediate cause or undefined", () => {
		const inner = Err.from("DB connection failed");
		const outer = inner.wrap("Could not save user");

		expect(outer.unwrap()?.message).toBe("DB connection failed");
		expect(inner.unwrap()).toBeUndefined();
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Catching native errors
// ══════════════════════════════════════════════════════════════════════════════

describe("Catching native errors", () => {
	test("Err.wrap in catch block", () => {
		function parseData(raw: string): [unknown, null] | [null, Err] {
			try {
				return [JSON.parse(raw), null];
			} catch (e) {
				return [null, Err.wrap("Failed to parse data", e as Error)];
			}
		}

		const [result, err] = parseData("{invalid}");
		expect(result).toBeNull();
		expect(err).not.toBeNull();
		expect(err?.message).toBe("Failed to parse data");
		expect(err?.unwrap()).not.toBeUndefined();
	});

	test("Err.wrap with code and metadata", () => {
		function fetchUser(id: string): [null, Err] {
			const cause = new Error("Connection refused");
			return [
				null,
				Err.wrap("Failed to fetch user", cause, {
					code: "USER_FETCH_ERROR",
					metadata: { userId: id },
				}),
			];
		}

		const [, err] = fetchUser("user-42");
		expect(err.message).toBe("Failed to fetch user");
		expect(err.code).toBe("USER_FETCH_ERROR");
		expect(err.metadata?.userId).toBe("user-42");
		expect(err.unwrap()?.message).toBe("Connection refused");
	});

	test("Err.from unknown value in catch block", () => {
		function riskyOp(): [null, Err] {
			try {
				throw "string error";
			} catch (e) {
				return [null, Err.from(e).wrap("Operation failed")];
			}
		}

		const [, err] = riskyOp();
		expect(err.message).toBe("Operation failed");
		expect(err.unwrap()?.message).toBe("string error");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Error aggregation
// ══════════════════════════════════════════════════════════════════════════════

describe("Error aggregation", () => {
	test("aggregate with add for validation", () => {
		interface UserInput {
			name?: string;
			email?: string;
			age?: number;
		}

		function validateUser(input: UserInput): [UserInput, null] | [null, Err] {
			let errors = Err.aggregate("Validation failed");

			if (!input.name?.trim()) {
				errors = errors.add("Name is required");
			}
			if (!input.email?.includes("@")) {
				errors = errors.add(Err.from("Invalid email", "INVALID_EMAIL"));
			}
			if (input.age !== undefined && input.age < 0) {
				errors = errors.add("Age cannot be negative");
			}

			if (errors.count > 0) {
				return [null, errors.withCode("VALIDATION_ERROR")];
			}

			return [input, null];
		}

		const [, err] = validateUser({ name: "", email: "bad", age: -1 });
		expect(err).not.toBeNull();
		expect(err?.code).toBe("VALIDATION_ERROR");
		expect(err?.count).toBe(3);
	});

	test("aggregate with chained adds", () => {
		const errors = Err.aggregate("Multiple operations failed")
			.add(Err.from("Database write failed"))
			.add(Err.from("Cache invalidation failed"))
			.add("Notification send failed");

		expect(errors.count).toBe(3);
		expect(errors.flatten()).toHaveLength(3);
	});

	test("addAll adds multiple errors at once", () => {
		const validationErrors: Array<Err | Error | string> = [
			"Name too short",
			Err.from("Invalid email format").withCode("INVALID_EMAIL"),
			new Error("Age must be positive"),
		];

		const aggregate =
			Err.aggregate("Validation failed").addAll(validationErrors);
		expect(aggregate.count).toBe(3);
	});

	test("isAggregate distinguishes single from multiple errors", () => {
		const single = Err.from("Single error");
		const multi = Err.aggregate("Multiple").add("One").add("Two");

		expect(single.isAggregate).toBe(false);
		expect(multi.isAggregate).toBe(true);
	});

	test("count recursively counts nested aggregates", () => {
		const nested = Err.aggregate("Parent")
			.add("Error 1")
			.add(Err.aggregate("Child").add("Error 2").add("Error 3"));

		expect(nested.count).toBe(3);
	});

	test("errors returns direct child errors", () => {
		const aggregate = Err.aggregate("Batch failed")
			.add("Task 1 failed")
			.add("Task 2 failed");

		const messages = aggregate.errors.map((e) => e.message);
		expect(messages).toEqual(["Task 1 failed", "Task 2 failed"]);
	});

	test("flatten recursively collects all leaf errors", () => {
		const nested = Err.aggregate("All errors")
			.add("Error A")
			.add(Err.aggregate("Group B").add("Error B1").add("Error B2"))
			.add("Error C");

		const flat = nested.flatten();
		expect(flat.map((e) => e.message)).toEqual([
			"Error A",
			"Error B1",
			"Error B2",
			"Error C",
		]);
	});

	test("aggregate validation with count check", () => {
		function validate(data: {
			email?: string;
			name?: string;
		}): [typeof data, null] | [null, Err] {
			let errors = Err.aggregate("Validation failed");

			if (!data.email) errors = errors.add("Email is required");
			if (!data.name) errors = errors.add("Name is required");

			if (errors.isAggregate) {
				return [null, errors.withCode("VALIDATION_ERROR")];
			}
			return [data, null];
		}

		const [, err] = validate({});
		expect(err).not.toBeNull();
		expect(err?.code).toBe("VALIDATION_ERROR");
		expect(err?.count).toBe(2);

		const [result, err2] = validate({ email: "a@b.com", name: "Test" });
		expect(err2).toBeNull();
		expect(result).toEqual({ email: "a@b.com", name: "Test" });
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. JSON serialization
// ══════════════════════════════════════════════════════════════════════════════

describe("JSON serialization", () => {
	test("toJSON produces serializable object", () => {
		const err = Err.from("Not found", {
			code: "NOT_FOUND",
			metadata: { userId: "123" },
		});

		const json = err.toJSON();
		expect(json.message).toBe("Not found");
		expect(json.code).toBe("NOT_FOUND");
		expect(json.metadata).toEqual({ userId: "123" });
		expect(json.timestamp).toBeTruthy();
		expect(json.kind).toBe("Err");
		expect(json.isErr).toBe(true);
	});

	test("toJSON without stack for public APIs", () => {
		const err = Err.from("Not found", "NOT_FOUND");
		const json = err.toJSON({ stack: false });
		expect(json.stack).toBeUndefined();
		expect(json.message).toBe("Not found");
	});

	test("toJSON minimal payload (no stack, no metadata)", () => {
		const err = Err.from("Error", {
			code: "TEST",
			metadata: { secret: "hidden" },
		});
		const json = err.toJSON({ stack: false, metadata: false });
		expect(json.stack).toBeUndefined();
		expect(json.metadata).toBeUndefined();
		expect(json.message).toBe("Error");
		expect(json.code).toBe("TEST");
	});

	test("fromJSON round-trip preserves error structure", () => {
		const original = Err.from("User not found", "NOT_FOUND");
		const json = original.toJSON();
		const restored = Err.fromJSON(json);

		expect(restored.message).toBe("User not found");
		expect(restored.code).toBe("NOT_FOUND");
		expect(Err.isErr(restored)).toBe(true);
	});

	test("fromJSON reconstructs cause chain", () => {
		const original = Err.from("DB error")
			.wrap("Repository failed")
			.wrap("Service error");
		const json = original.toJSON();
		const restored = Err.fromJSON(json);

		expect(restored.message).toBe("Service error");
		expect(restored.unwrap()?.message).toBe("Repository failed");
		expect(restored.root.message).toBe("DB error");
	});

	test("fromJSON reconstructs aggregated errors", () => {
		const original = Err.aggregate("Validation failed")
			.add("Name required")
			.add("Email invalid");
		const json = original.toJSON();
		const restored = Err.fromJSON(json);

		expect(restored.message).toBe("Validation failed");
		expect(restored.errors).toHaveLength(2);
		expect(restored.errors[0]?.message).toBe("Name required");
		expect(restored.errors[1]?.message).toBe("Email invalid");
	});

	test("fromJSON with hasCode check", () => {
		const json: ErrJSON = {
			message: "Not found",
			code: "NOT_FOUND",
			kind: "Err",
			isErr: true,
			timestamp: new Date().toISOString(),
			errors: [],
		};
		const err = Err.fromJSON(json);
		expect(err.hasCode("NOT_FOUND")).toBe(true);
	});

	test("fromJSON throws on invalid input", () => {
		expect(() => Err.fromJSON(null)).toThrow();
		expect(() => Err.fromJSON("string")).toThrow();
		expect(() => Err.fromJSON({})).toThrow(
			"Invalid ErrJSON: message must be a string",
		);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Metadata
// ══════════════════════════════════════════════════════════════════════════════

describe("Metadata", () => {
	test("withMetadata merges metadata", () => {
		const err = Err.from("Request failed")
			.withMetadata({ url: "/api/users" })
			.withMetadata({ statusCode: 500, retryable: true });

		expect(err.metadata).toEqual({
			url: "/api/users",
			statusCode: 500,
			retryable: true,
		});
	});

	test("withMetadata does not mutate original", () => {
		const original = Err.from("Error").withMetadata({ a: 1 });
		const modified = original.withMetadata({ b: 2 });

		expect(original.metadata).toEqual({ a: 1 });
		expect(modified.metadata).toEqual({ a: 1, b: 2 });
	});

	test("hasMetadata checks value existence by default", () => {
		const err = Err.from("Test").withMetadata({
			url: "/api",
			status: null,
		});

		expect(err.hasMetadata("url")).toBe(true);
		expect(err.hasMetadata("status")).toBe(false);
		expect(err.hasMetadata("status", { keyCheck: true })).toBe(true);
		expect(err.hasMetadata("missing")).toBe(false);
	});

	test("getMetadata retrieves typed values", () => {
		const err = Err.from("Test").withMetadata({
			url: "/api/users",
			count: 42,
			tags: ["important", "retry"],
		});

		expect(err.getMetadata<string>("url")).toBe("/api/users");
		expect(err.getMetadata<number>("count")).toBe(42);
		expect(err.getMetadata("missing")).toBeUndefined();
		expect(err.getMetadata("missing", "default")).toBe("default");
	});

	test("omitMetadata removes single key", () => {
		const err = Err.from("Test", {
			metadata: { url: "/api", token: "secret", retryable: true },
		});

		const sanitized = err.omitMetadata("token");
		expect(sanitized.metadata).toEqual({ url: "/api", retryable: true });
	});

	test("omitMetadata removes multiple keys", () => {
		const err = Err.from("Test", {
			metadata: { url: "/api", token: "secret", retryable: true },
		});

		const minimal = err.omitMetadata(["url", "retryable"]);
		expect(minimal.metadata).toEqual({ token: "secret" });
	});

	test("omitMetadata returns undefined metadata when all keys removed", () => {
		const err = Err.from("Test", {
			metadata: { url: "/api", token: "secret", retryable: true },
		});

		const empty = err.omitMetadata(["url", "token", "retryable"]);
		expect(empty.metadata).toBeUndefined();
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Error codes
// ══════════════════════════════════════════════════════════════════════════════

describe("Error codes", () => {
	test("withCode sets error code", () => {
		const err = Err.from("Record not found").withCode("NOT_FOUND");
		expect(err.code).toBe("NOT_FOUND");
	});

	test("withCode does not mutate original", () => {
		const original = Err.from("Error");
		const withCode = original.withCode("CODE");
		expect(original.code).toBeUndefined();
		expect(withCode.code).toBe("CODE");
	});

	test("hasCode searches cause chain", () => {
		const err = Err.from("DB error", "DB_ERROR")
			.wrap("Repository failed")
			.wrap("Service unavailable");

		expect(err.hasCode("DB_ERROR")).toBe(true);
		expect(err.hasCode("NETWORK_ERROR")).toBe(false);
	});

	test("hasCodePrefix matches hierarchical codes", () => {
		const err = Err.from("Token expired", {
			code: "AUTH:TOKEN:EXPIRED",
		});

		expect(err.hasCodePrefix("AUTH")).toBe(true);
		expect(err.hasCodePrefix("AUTH:TOKEN")).toBe(true);
		expect(err.hasCodePrefix("AUTHORIZATION")).toBe(false);
	});

	test("hasCodePrefix with custom boundary", () => {
		const err = Err.from("Not found", {
			code: "HTTP.404.NOT_FOUND",
		});

		expect(err.hasCodePrefix("HTTP", ".")).toBe(true);
		expect(err.hasCodePrefix("HTTP.404", ".")).toBe(true);
		expect(err.hasCodePrefix("HTTP", ":")).toBe(false);
	});

	test("hasCodePrefix searches error tree", () => {
		const err = Err.from("DB error", { code: "DB:CONNECTION" }).wrap({
			message: "Service failed",
			code: "SERVICE:UNAVAILABLE",
		});

		expect(err.hasCodePrefix("DB")).toBe(true);
		expect(err.hasCodePrefix("SERVICE")).toBe(true);
	});

	test("find locates first error matching predicate", () => {
		const err = Err.aggregate("Multiple failures")
			.add(Err.from("Not found", "NOT_FOUND"))
			.add(Err.from("Timeout", "TIMEOUT"));

		const timeout = err.find((e) => e.code === "TIMEOUT");
		expect(timeout?.message).toBe("Timeout");
	});

	test("filter finds all errors matching predicate", () => {
		const err = Err.aggregate("Validation failed")
			.add(Err.from("Name required", "REQUIRED"))
			.add(Err.from("Invalid email", "INVALID"))
			.add(Err.from("Age required", "REQUIRED"));

		const required = err.filter((e) => e.code === "REQUIRED");
		expect(required.length).toBe(2);
	});

	test("toString formats error with cause chain", () => {
		const err = Err.from("DB error")
			.wrap("Repository failed")
			.wrap("Service unavailable");

		const str = err.toString();
		expect(str).toContain("[ERROR] Service unavailable");
		expect(str).toContain("Caused by: [ERROR] Repository failed");
		expect(str).toContain("Caused by: [ERROR] DB error");
	});

	test("toString with date and metadata options", () => {
		const err = Err.from("Connection failed", {
			code: "DB:CONNECTION",
			metadata: { host: "localhost", port: 5432 },
		});

		const str = err.toString({ date: true, metadata: true });
		expect(str).toContain(`[${err.timestamp}]`);
		expect(str).toContain("[DB:CONNECTION]");
		expect(str).toContain("Connection failed");
		expect(str).toContain("metadata:");
		expect(str).toContain('"host":"localhost"');
	});

	test("toString formats aggregate errors", () => {
		const err = Err.aggregate("Validation failed", [], {
			code: "VALIDATION",
		})
			.add("Name required")
			.add("Email invalid");

		const str = err.toString();
		expect(str).toContain("[VALIDATION] Validation failed");
		expect(str).toContain("Errors (2):");
		expect(str).toContain("- [ERROR] Name required");
		expect(str).toContain("- [ERROR] Email invalid");
	});

	test("toString with maxDepth limit", () => {
		const deep = Err.from("Root")
			.wrap("Level 1")
			.wrap("Level 2")
			.wrap("Level 3");

		const str = deep.toString({ maxDepth: 2 });
		expect(str).toContain("[ERROR] Level 3");
		expect(str).toContain("Caused by: [ERROR] Level 2");
		expect(str).toContain("... (1 more cause)");
	});

	test("toError converts to native Error", () => {
		const err = Err.from("Something failed", "MY_ERROR");
		const nativeErr = err.toError();

		expect(nativeErr).toBeInstanceOf(Error);
		expect(nativeErr.message).toBe("Something failed");
		expect(nativeErr.name).toBe("MY_ERROR");
	});

	test("toError preserves cause chain", () => {
		const err = Err.from("Inner").wrap("Outer");
		const nativeErr = err.toError();

		expect(nativeErr.message).toBe("Outer");
		expect(nativeErr.cause).toBeInstanceOf(Error);
		expect((nativeErr.cause as Error).message).toBe("Inner");
	});
});
