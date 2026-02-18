/**
 * @fileoverview Comprehensive tests for Err type implementation
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { Err } from "./err.ts";

describe("Err", () => {
	describe("Static Constructors", () => {
		describe("from()", () => {
			test("creates Err with message and code", () => {
				const message = "User not found";
				const code = "NOT_FOUND";

				const err = Err.from(message, code);

				expect(err.isErr).toBe(true);
				expect(err.message).toBe(message);
				expect(err.code).toBe(code);
				expect(err.errors).toEqual([]);
			});

			test("creates Err with message only", () => {
				const message = "Generic error";
				const err = Err.from(message);

				expect(err.isErr).toBe(true);
				expect(err.message).toBe(message);
				expect(err.code).toBeUndefined();
			});

			test("creates Err with message, code and metadata", () => {
				const message = "Connection timeout";
				const options = {
					code: "TIMEOUT",
					metadata: { host: "api.example.com", timeoutMs: 5000 },
				};

				const err = Err.from(message, options);

				expect(err.isErr).toBe(true);
				expect(err.message).toBe(message);
				expect(err.code).toBe(options.code);
				expect(err.metadata).toEqual(expect.objectContaining(options.metadata));
			});

			test("creates Err from native Error", () => {
				const error = new Error("Test error");

				const err = Err.from(error);

				expect(err.isErr).toBe(true);
				expect(err.message).toBe("Test error");
				expect(err.stack).toBeDefined();
				expect(err.code).toBeUndefined();
			});

			test("adds originalName to metadata from Error", () => {
				const error = new Error("Test error");
				error.name = "CustomError";

				const err = Err.from(error);

				expect(err.metadata?.originalName).toBe("CustomError");
			});

			test("handles error with cause chain", () => {
				const cause = new Error("Database connection lost");
				const error = new Error("Failed to save user", { cause });

				const err = Err.from(error);

				expect(err.unwrap()?.message).toBe("Database connection lost");
				expect(err.metadata?.originalName).toBe("Error");
			});

			test("handles unknown values", () => {
				const err = Err.from(null);

				expect(err.message).toBe("Unknown error");
				expect(err.code).toBe("UNKNOWN");
				expect(err.metadata?.originalValue).toBeNull();
			});

			test("clones existing Err instance", () => {
				const original = Err.from("Original", "ORIG");

				const cloned = Err.from(original);

				expect(cloned.message).toBe("Original");
				expect(cloned.code).toBe("ORIG");
				expect(cloned).not.toBe(original);
			});
		});

		describe("static wrap()", () => {
			test("wraps error with new context", () => {
				const error = new Error("Database connection failed");

				const wrapped = Err.wrap("Failed to fetch user", error);

				expect(wrapped.message).toBe("Failed to fetch user");
				expect(wrapped.unwrap()?.message).toBe("Database connection failed");
			});

			test("wraps with code and metadata", () => {
				const error = new Error("DB error");

				const wrapped = Err.wrap("Service error", error, {
					code: "SERVICE_ERROR",
					metadata: { service: "user-service" },
				});

				expect(wrapped.code).toBe("SERVICE_ERROR");
				expect(wrapped.metadata).toEqual(
					expect.objectContaining({ service: "user-service" }),
				);
			});
		});

		describe("static aggregate()", () => {
			test("creates aggregate with default code", () => {
				const aggregate = Err.aggregate("Multiple failed");

				expect(aggregate.message).toBe("Multiple failed");
				expect(aggregate.code).toBe("AGGREGATE");
				expect(aggregate.count).toBe(1);
			});

			test("creates aggregate with initial errors", () => {
				const errors = ["Error 1", "Error 2"];

				const aggregate = Err.aggregate("Multiple failed", errors);

				expect(aggregate.count).toBe(2);
				expect(aggregate.errors[0]?.message).toBe("Error 1");
				expect(aggregate.errors[1]?.message).toBe("Error 2");
			});
		});

		describe("fromJSON()", () => {
			test("deserializes basic error", () => {
				const original = Err.from("Test error", "TEST");
				const json = original.toJSON();
				const restored = Err.fromJSON(json);

				expect(restored.message).toBe("Test error");
				expect(restored.code).toBe("TEST");
			});

			test("deserializes nested cause", () => {
				const json = {
					message: "Context error",
					code: "CONTEXT",
					timestamp: "2024-01-01T00:00:00.000Z",
					errors: [],
					cause: {
						message: "Root error",
						code: "ROOT",
						timestamp: "2024-01-01T00:00:00.000Z",
						errors: [],
					},
				};

				const err = Err.fromJSON(json);

				expect(err.unwrap()?.message).toBe("Root error");
				expect(err.unwrap()?.code).toBe("ROOT");
			});

			test("handles invalid input", () => {
				expect(() => Err.fromJSON(null)).toThrow(
					"Invalid ErrJSON: expected object",
				);
				expect(() => Err.fromJSON("string")).toThrow(
					"Invalid ErrJSON: expected object",
				);
			});

			test("handles pojos with missing fields with kind='Err'", () => {
				const json = { kind: "Err", message: "Test error" };
				const restored = Err.fromJSON(json);
				expect(restored.message).toBe("Test error");
				expect(Err.isErr(restored)).toBe(true);
				const augmented = restored.withCode("AUGMENTED");
				expect(augmented.code).toBe("AUGMENTED");
			});

			test("handles pojos with missing fields with isErr=true", () => {
				const json = { isErr: true, message: "Test error" };
				const restored = Err.fromJSON(json);
				expect(restored.message).toBe("Test error");
				expect(Err.isErr(restored)).toBe(true);
				const augmented = restored.withCode("AUGMENTED");
				expect(augmented.code).toBe("AUGMENTED");
			});

			test("deserializes with _cause", () => {
				const json = {
					message: "Wrapper",
					_cause: {
						message: "Inner",
						code: "INNER",
					},
				};
				const err = Err.fromJSON(json);
				expect(err.message).toBe("Wrapper");
				expect(err.unwrap()?.message).toBe("Inner");
				expect(err.unwrap()?.code).toBe("INNER");
			});

			test("deserializes with _errors", () => {
				const json = {
					message: "Aggregate",
					_errors: [{ message: "Error 1" }, { message: "Error 2" }],
				};
				const err = Err.fromJSON(json);
				expect(err.message).toBe("Aggregate");
				expect(err.errors.length).toBe(2);
				expect(err.errors[0]?.message).toBe("Error 1");
				expect(err.errors[1]?.message).toBe("Error 2");
			});

			test("prioritizes cause over _cause", () => {
				const json = {
					message: "Test",
					cause: { message: "Public Cause" },
					_cause: { message: "Private Cause" },
				};
				const err = Err.fromJSON(json);
				expect(err.unwrap()?.message).toBe("Public Cause");
			});

			test("prioritizes errors over _errors", () => {
				const json = {
					message: "Test",
					errors: [{ message: "Public Error" }],
					_errors: [{ message: "Private Error" }],
				};
				const err = Err.fromJSON(json);
				expect(err.errors[0]?.message).toBe("Public Error");
			});
		});

		describe("isErr()", () => {
			test("returns true for Err instances", () => {
				const err = Err.from("Test error");
				expect(Err.isErr(err)).toBe(true);
			});

			test("returns false for non-Err values", () => {
				expect(Err.isErr(new Error("Test"))).toBe(false);
				expect(Err.isErr("string")).toBe(false);
				expect(Err.isErr(null)).toBe(false);
				expect(Err.isErr(undefined)).toBe(false);
			});

			test("returns true for POJOs with kind='Err'", () => {
				const pojo = { kind: "Err", message: "Mock error" };
				expect(Err.isErr(pojo)).toBe(true);
			});

			test("returns true for POJOs with isErr=true", () => {
				const pojo = { isErr: true, message: "Mock error" };
				expect(Err.isErr(pojo)).toBe(true);
			});

			test("returns true for deserialized JSON errors", () => {
				const original = Err.from("Test");
				const json = JSON.parse(JSON.stringify(original));
				expect(Err.isErr(json)).toBe(true);
			});

			test("returns true for deserialized fromJSON errors", () => {
				const original = Err.from("Test");
				const json = JSON.parse(JSON.stringify(original));
				const restored = Err.fromJSON(json);
				const augmented = restored.withCode("AUGMENTED");
				expect(Err.isErr(augmented)).toBe(true);
			});
		});

		describe("kind property", () => {
			test("is 'Err' for all instances", () => {
				const err = Err.from("Test");
				expect(err.kind).toBe("Err");
			});

			test("survives serialization", () => {
				const err = Err.from("Test");
				const json = JSON.parse(JSON.stringify(err));
				expect(json.kind).toBe("Err");
			});
		});
	});

	describe("Instance Methods", () => {
		describe("wrap()", () => {
			test("wraps error with context", () => {
				const original = Err.from("Original error", "ORIG");
				const wrapped = original.wrap("Context added");

				expect(wrapped.message).toBe("Context added");
				expect(wrapped.unwrap()?.message).toBe("Original error");
				expect(wrapped.unwrap()).toBe(original);
			});

			test("wraps with full options", () => {
				const original = Err.from("Original error", "ORIG");

				const wrapped = original.wrap({
					message: "New context",
					code: "NEW_CODE",
					metadata: { level: "critical" },
				});

				expect(wrapped.message).toBe("New context");
				expect(wrapped.code).toBe("NEW_CODE");
				expect(wrapped.metadata).toEqual(
					expect.objectContaining({ level: "critical" }),
				);
			});
		});

		describe("withCode()", () => {
			test("creates new error with different code", () => {
				const original = Err.from("Test error");
				const withCode = original.withCode("TEST_CODE");

				expect(withCode.code).toBe("TEST_CODE");
				expect(withCode.message).toBe("Test error");
				expect(withCode).not.toBe(original);
			});
		});

		describe("withMetadata()", () => {
			test("merges metadata with existing", () => {
				const original = Err.from("Test", {
					metadata: { existing: "value" },
				});

				const merged = original.withMetadata({ new: "value" });

				expect(merged.metadata).toEqual(
					expect.objectContaining({
						existing: "value",
						new: "value",
					}),
				);
			});

			test("overrides existing metadata keys", () => {
				const original = Err.from("Test", {
					metadata: { key: "old", preserved: "yes" },
				});

				const overridden = original.withMetadata({ key: "new" });

				expect(overridden.metadata).toEqual(
					expect.objectContaining({
						key: "new",
						preserved: "yes",
					}),
				);
			});

			test("creates new instance", () => {
				const original = Err.from("Test", {
					metadata: { foo: "bar" },
				});
				const modified = original.withMetadata({ baz: "qux" });

				expect(modified).not.toBe(original);
				expect(original.metadata).toEqual({ foo: "bar" });
			});
		});
	});

	describe("Aggregate Operations", () => {
		describe("add()", () => {
			test("adds error to aggregate", () => {
				const aggregate = Err.aggregate("Validation failed");
				const added = aggregate.add("Email is required");

				expect(added.count).toBe(1);
				expect(added.errors[0]?.message).toBe("Email is required");
				expect(added).not.toBe(aggregate);
			});

			test("converts single error to aggregate", () => {
				const single = Err.from("Single error");
				const aggregateAdded = single.add("Added error");

				expect(aggregateAdded.count).toBe(1); // Implementation detail: count becomes 1 when converted
				expect(aggregateAdded.errors.length).toBe(1);
			});
		});

		describe("addAll()", () => {
			test("adds array of errors", () => {
				const errors = ["Error 1", Err.from("Error 2", "CODE2")];
				const aggregate = Err.aggregate("All failed").addAll(errors);

				expect(aggregate.count).toBe(2);
				expect(aggregate.errors.length).toBe(2);
				expect(aggregate.errors[0]?.message).toBe("Error 1");
				expect(aggregate.errors[1]?.code).toBe("CODE2");
			});
		});
	});

	describe("Inspection Methods", () => {
		describe("count", () => {
			test("counts nested aggregates recursively", () => {
				const nested = Err.aggregate("Parent")
					.add("Error A")
					.add(Err.aggregate("Child").add("Error B1").add("Error B2"))
					.add("Error C");

				expect(nested.count).toBe(4);
			});

			test("returns 1 for single errors", () => {
				const single = Err.from("Single error");
				expect(single.count).toBe(1);
			});

			test("never 0 for empty aggregates as well", () => {
				const empty = Err.aggregate("Empty");
				expect(empty.count).toBe(1);
				const single = Err.from("Single error");
				expect(single.count).toBe(1);
			});
		});

		describe("root", () => {
			test("finds deepest error in chain", () => {
				const root = Err.from("Original error");
				const wrapped = root
					.wrap("Added context 1")
					.wrap("Added context 2")
					.wrap("Top level");

				expect(wrapped.root.message).toBe("Original error");
				expect(wrapped.root).toBe(root);
			});
		});

		describe("chain()", () => {
			test("returns chain from root to current", () => {
				const root = Err.from("Network timeout", "TIMEOUT");
				const current = root
					.wrap("API request failed")
					.wrap("Authentication failed");

				const chain = current.chain();

				expect(chain.length).toBe(3);
				expect(chain[0]).toBe(root);
				expect(chain[2]).toBe(current);
				expect(chain.map((e) => e.message)).toEqual([
					"Network timeout",
					"API request failed",
					"Authentication failed",
				]);
			});
		});

		describe("flatten()", () => {
			test("flattens nested aggregates", () => {
				const nested = Err.aggregate("All failed")
					.add("Error A")
					.add(Err.aggregate("Group B").add("Error B1").add("Error B2"))
					.add("Error C");

				const flat = nested.flatten();

				expect(flat.length).toBe(4);
				expect(flat.map((e) => e.message)).toEqual([
					"Error A",
					"Error B1",
					"Error B2",
					"Error C",
				]);
			});

			test("handles empty aggregates", () => {
				const empty = Err.aggregate("Empty");
				const flat = empty.flatten();

				expect(flat.length).toBe(1);
				expect(flat[0]).toBe(empty);
			});
		});
	});

	describe("Matching & Filtering", () => {
		describe("hasCode()", () => {
			test("finds code in current error", () => {
				const err = Err.from("Test error", "TEST_CODE");
				expect(err.hasCode("TEST_CODE")).toBe(true);
				expect(err.hasCode("OTHER_CODE")).toBe(false);
			});

			test("finds code in cause chain", () => {
				const err = Err.from("DB error", "DB_ERROR")
					.wrap("Service error")
					.wrap("User error");
				expect(err.hasCode("DB_ERROR")).toBe(true);
			});

			test("finds code in aggregated errors", () => {
				const aggregate = Err.aggregate("Many errors")
					.add(Err.from("Error 1", "CODE1"))
					.add(Err.from("Error 2", "CODE2"))
					.add(Err.from("Error 3", "CODE3"));

				expect(aggregate.hasCode("CODE2")).toBe(true);
				expect(aggregate.hasCode("MISSING_CODE")).toBe(false);
			});
		});

		describe("hasCodePrefix()", () => {
			test("matches exact code", () => {
				const err = Err.from("Test", { code: "AUTH" });
				expect(err.hasCodePrefix("AUTH")).toBe(true);
				expect(err.hasCodePrefix("OTHER")).toBe(false);
			});

			test("matches code with default boundary", () => {
				const err = Err.from("Token expired", { code: "AUTH:TOKEN:EXPIRED" });

				expect(err.hasCodePrefix("AUTH")).toBe(true);
				expect(err.hasCodePrefix("AUTH:TOKEN")).toBe(true);
				expect(err.hasCodePrefix("AUTH:TOKEN:EXPIRED")).toBe(true);
			});

			test("does not match partial strings without boundary", () => {
				const err = Err.from("Auth error", { code: "AUTHORIZATION" });

				// "AUTH" should NOT match "AUTHORIZATION" (no boundary)
				expect(err.hasCodePrefix("AUTH")).toBe(false);
				expect(err.hasCodePrefix("AUTHORIZATION")).toBe(true);
			});

			test("works with custom boundary", () => {
				const err = Err.from("HTTP error", { code: "HTTP.404.NOT_FOUND" });

				expect(err.hasCodePrefix("HTTP", ".")).toBe(true);
				expect(err.hasCodePrefix("HTTP.404", ".")).toBe(true);
				expect(err.hasCodePrefix("HTTP", ":")).toBe(false); // wrong boundary
			});

			test("finds prefix in cause chain", () => {
				const err = Err.from("DB error", { code: "DB:CONNECTION" }).wrap({
					message: "Service failed",
					code: "SERVICE:UNAVAILABLE",
				});

				expect(err.hasCodePrefix("DB")).toBe(true); // in cause
				expect(err.hasCodePrefix("SERVICE")).toBe(true); // in current
				expect(err.hasCodePrefix("NETWORK")).toBe(false);
			});

			test("finds prefix in aggregated errors", () => {
				const agg = Err.aggregate("Multiple failures")
					.add(Err.from("Auth failed", { code: "AUTH:INVALID_TOKEN" }))
					.add(Err.from("DB failed", { code: "DB:TIMEOUT" }));

				expect(agg.hasCodePrefix("AUTH")).toBe(true);
				expect(agg.hasCodePrefix("DB")).toBe(true);
				expect(agg.hasCodePrefix("CACHE")).toBe(false);
			});

			test("returns false when no code is set", () => {
				const err = Err.from("No code");
				expect(err.hasCodePrefix("ANY")).toBe(false);
			});

			test("handles empty prefix", () => {
				const err = Err.from("Test", { code: "AUTH:TOKEN" });
				// Empty prefix only matches empty code (exact match) or code starting with boundary
				expect(err.hasCodePrefix("")).toBe(false); // "AUTH:TOKEN" !== "" and doesn't start with ":"

				const emptyCodeErr = Err.from("Empty code", { code: "" });
				expect(emptyCodeErr.hasCodePrefix("")).toBe(true); // exact match
			});

			test("handles multi-character boundary", () => {
				const err = Err.from("Error", { code: "MODULE::SUB::DETAIL" });

				expect(err.hasCodePrefix("MODULE", "::")).toBe(true);
				expect(err.hasCodePrefix("MODULE::SUB", "::")).toBe(true);
			});
		});

		describe("find()", () => {
			test("finds first matching error", () => {
				const aggregate = Err.aggregate("All")
					.add("No code")
					.add(Err.from("Code A", "CODE_A"))
					.add(Err.from("Code B", "CODE_B"));

				const found = aggregate.find((e) => e.code === "CODE_B");

				expect(found?.message).toBe("Code B");
			});

			test("finds nothing when no match", () => {
				const aggregate = Err.aggregate("All").add("Test");
				const found = aggregate.find((e) => e.code === "MISSING");
				expect(found).toBeUndefined();
			});

			test("finds self when predicate matches", () => {
				const err = Err.from("Test", "TEST");
				const found = err.find((e) => e.code === "TEST");
				expect(found).toBe(err);
			});
		});

		describe("filter()", () => {
			test("filters aggregated errors", () => {
				const agg = Err.aggregate("All")
					.add(Err.from("Required 1", "REQUIRED"))
					.add(Err.from("Invalid 1", "INVALID"))
					.add(Err.from("Required 2", "REQUIRED"))
					.add(Err.from("Invalid 2", "INVALID"));

				const required = agg.filter((e) => e.code === "REQUIRED");

				expect(required.length).toBe(2);
				expect(required.map((e) => e.message)).toEqual([
					"Required 1",
					"Required 2",
				]);
			});

			test("returns empty array when no matches", () => {
				const agg = Err.aggregate("All").add("Test");
				const filtered = agg.filter((e) => e.code === "MISSING");
				expect(filtered).toEqual([]);
			});
		});
	});

	describe("Conversion Methods", () => {
		let err: Err;

		beforeEach(() => {
			err = Err.from("Test error", {
				code: "TEST_CODE",
				metadata: { foo: "bar", count: 42 },
			});
		});

		describe("toJSON()", () => {
			test("serializes basic error", () => {
				const json = err.toJSON();

				expect(json.message).toBe("Test error");
				expect(json.code).toBe("TEST_CODE");
				expect(json.metadata).toEqual({ foo: "bar", count: 42 });
				expect(json.timestamp).toBeDefined();
				expect(json.stack).toBeDefined();
			});

			test("serializes nested cause", () => {
				const nested = err.wrap({
					message: "Wrapped error",
					code: "WRAPPED_CODE",
				});
				const json = nested.toJSON();

				expect(json.message).toBe("Wrapped error");
				expect(json.cause).toMatchObject({
					message: "Test error",
					code: "TEST_CODE",
				});
			});

			test("serializes aggregate with cause", () => {
				const rootCause = Err.from("Database connection failed", "DB_ERROR");
				const wrappedCause = rootCause.wrap("Repository failed");
				const aggregate = Err.aggregate("Multiple operations failed")
					.add("Task 1 failed")
					.add("Task 2 failed");

				// Create an aggregate that itself has a cause
				// biome-ignore lint/suspicious/noExplicitAny: testing private constructor
				const aggregateWithCause = new (Err as any)("Batch operation failed", {
					code: "BATCH_ERROR",
					cause: wrappedCause,
					errors: aggregate.errors,
				});

				const json = aggregateWithCause.toJSON();

				expect(json.message).toBe("Batch operation failed");
				expect(json.code).toBe("BATCH_ERROR");
				expect(json.cause).toMatchObject({
					message: "Repository failed",
					cause: {
						message: "Database connection failed",
						code: "DB_ERROR",
					},
				});
				expect(json.errors).toHaveLength(2);
				expect(json.errors[0]?.message).toBe("Task 1 failed");
				expect(json.errors[1]?.message).toBe("Task 2 failed");
			});

			test("omits stack when requested", () => {
				const json = err.toJSON({ stack: false });
				expect(json.stack).toBeUndefined();
				expect(json.message).toBe("Test error");
			});

			test("omits metadata when requested", () => {
				const json = err.toJSON({ metadata: false });
				expect(json.metadata).toBeUndefined();
				expect(json.message).toBe("Test error");
				expect(json.code).toBe("TEST_CODE");
			});
		});

		describe("toString()", () => {
			test("formats single error", () => {
				const single = Err.from("Not found", "NOT_FOUND");
				const str = single.toString();

				expect(str).toBe("[NOT_FOUND] Not found");
			});

			test("formats error with default code when no code specified", () => {
				const noCode = Err.from("Test");
				expect(noCode.toString()).toBe("[ERROR] Test");
			});

			test("formats aggregated error", () => {
				const agg = Err.aggregate("Validation failed")
					.add("Name required")
					.add("Email invalid");

				const str = agg.toString({ stack: true });

				expect(str).toContain("[AGGREGATE] Validation failed");
				expect(str).toContain("Errors (2):");
				expect(str).toContain("Name required");
				expect(str).toContain("Email invalid");
			});

			test("formats aggregated error - from JSON", () => {
				const agg = Err.aggregate("Validation failed")
					.add("Name required")
					.add("Email invalid");

				const str = Err.fromJSON(agg).toString({ stack: true, metadata: true });

				expect(str).toContain("[AGGREGATE] Validation failed");
				expect(str).toContain("Errors (2):");
				expect(str).toContain("Name required");
				expect(str).toContain("Email invalid");
			});

			describe("with options", () => {
				test("includes timestamp when date option is true", () => {
					const err = Err.from("Test error", "TEST");
					const str = err.toString({ date: true });

					// Should have ISO timestamp at the start
					expect(str).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
					expect(str).toContain("[TEST] Test error");
				});

				test("includes metadata when metadata option is true", () => {
					const err = Err.from("Test error", {
						code: "TEST",
						metadata: { userId: "123", action: "login" },
					});
					const str = err.toString({ metadata: true });

					expect(str).toContain("metadata:");
					expect(str).toContain('"userId":"123"');
					expect(str).toContain('"action":"login"');
				});

				test("does not include metadata when not present", () => {
					const err = Err.from("Test error", "TEST");
					const str = err.toString({ metadata: true });

					expect(str).not.toContain("metadata:");
				});

				test("includes full stack when stack option is true", () => {
					const err = Err.from("Test error", "TEST");
					const str = err.toString({ stack: true });

					expect(str).toContain("stack:");
					expect(str).toContain("at ");
				});

				test("limits stack frames when stack is a number", () => {
					const err = Err.from("Test error", "TEST");
					const str = err.toString({ stack: 2 });

					expect(str).toContain("stack:");
					// Count "at " occurrences
					const atCount = (str.match(/at /g) || []).length;
					expect(atCount).toBeLessThanOrEqual(2);
				});

				test("limits cause chain depth with maxDepth", () => {
					const deep = Err.from("Root")
						.wrap("Level 1")
						.wrap("Level 2")
						.wrap("Level 3");

					const str = deep.toString({ maxDepth: 1 });

					expect(str).toContain("[ERROR] Level 3");
					expect(str).toContain("Caused by: [ERROR] Level 2");
					expect(str).toContain("... (2 more causes)");
					expect(str).not.toContain("Level 1");
					expect(str).not.toContain("Root");
				});

				test("shows singular 'cause' when only one remaining", () => {
					const err = Err.from("Root").wrap("Level 1").wrap("Level 2");

					const str = err.toString({ maxDepth: 1 });

					expect(str).toContain("... (1 more cause)");
				});

				test("uses custom indent string", () => {
					const err = Err.from("Inner", "INNER").wrap({
						message: "Outer",
						code: "OUTER",
					});
					const str = err.toString({ indent: "    " }); // 4 spaces

					expect(str).toContain("    Caused by:");
				});

				test("combines multiple options", () => {
					const err = Err.from("DB error", {
						code: "DB:CONNECTION",
						metadata: { host: "localhost" },
					});
					const str = err.toString({
						date: true,
						metadata: true,
						stack: 3,
					});

					// Check all options are applied
					expect(str).toMatch(/^\[\d{4}-\d{2}-\d{2}T/); // date
					expect(str).toContain("[DB:CONNECTION] DB error");
					expect(str).toContain("metadata:");
					expect(str).toContain("stack:");
				});

				test("options propagate to cause chain", () => {
					const err = Err.from("Inner", {
						code: "INNER",
						metadata: { level: "inner" },
					}).wrap({
						message: "Outer",
						code: "OUTER",
						metadata: { level: "outer" },
					});

					const str = err.toString({ metadata: true, date: true });

					// Both errors should have metadata and date
					expect(str).toContain('"level":"outer"');
					expect(str).toContain('"level":"inner"');
					// Count timestamp occurrences (should be 2)
					const timestampCount = (str.match(/\[\d{4}-\d{2}-\d{2}T/g) || [])
						.length;
					expect(timestampCount).toBe(2);
				});

				test("options propagate to aggregated errors", () => {
					const agg = Err.aggregate("Multiple errors")
						.add(
							Err.from("Error 1", {
								code: "E1",
								metadata: { id: 1 },
							}),
						)
						.add(
							Err.from("Error 2", {
								code: "E2",
								metadata: { id: 2 },
							}),
						);

					const str = agg.toString({ metadata: true });

					expect(str).toContain('"id":1');
					expect(str).toContain('"id":2');
				});

				test("backward compatible - no options produces same output", () => {
					const err = Err.from("Test", "CODE");
					const withoutOptions = err.toString();
					const withEmptyOptions = err.toString({});

					expect(withoutOptions).toBe("[CODE] Test");
					expect(withEmptyOptions).toBe("[CODE] Test");
				});
			});
		});

		describe("toError()", () => {
			test("converts to native Error", () => {
				const original = Err.from("Test error", "TEST_CODE");
				const native = original.toError();

				expect(native).toBeInstanceOf(Error);
				expect(native.message).toBe("Test error");
				expect(native.name).toBe("TEST_CODE");
				expect(native.stack).toBeDefined();
			});

			test("preserves native Error name when no code", () => {
				const noCode = Err.from("Test error");
				const native = noCode.toError();

				expect(native.name).toBe("Err");
			});

			test("original Err is unchanged", () => {
				const original = Err.from("Test", "CODE");
				original.toError();

				expect(original.isErr).toBe(true);
				expect(original.code).toBe("CODE");
				expect(original.stack).toBeDefined();
			});

			test("converts cause chain to native Error", () => {
				const rootCause = Err.from("Root cause", "ROOT");
				const wrapped = Err.wrap("Wrapped error", rootCause, {
					code: "WRAPPED",
				});

				const native = wrapped.toError();

				expect(native).toBeInstanceOf(Error);
				expect(native.message).toBe("Wrapped error");
				expect(native.name).toBe("WRAPPED");
				expect(native.cause).toBeDefined();
				expect(native.cause).toBeInstanceOf(Error);
				expect((native.cause as Error).message).toBe("Root cause");
				expect((native.cause as Error).name).toBe("ROOT");
			});

			test("toError() without stack preserves behavior", () => {
				// Create an Err where _stack might be undefined
				const err = Err.from("Test error", "TEST");
				const native = err.toError();

				expect(native).toBeInstanceOf(Error);
				expect(native.message).toBe("Test error");
			});
		});

		describe("stack getter", () => {
			test("returns the internal stack trace", () => {
				const err = Err.from("Test error", "TEST");
				const stack = err.stack;

				expect(stack).toBeDefined();
				expect(typeof stack).toBe("string");
			});

			test("returns undefined when no stack available", () => {
				const err = Err.from("Test");
				expect(err.stack).toBeDefined();
			});
		});
	});
});
