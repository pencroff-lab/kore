import { describe, expect, test } from "bun:test";
import { dtStamp } from "./format_dt";

describe("Default formatting", () => {
	test("formats UTC datetime with underscore delimiter", () => {
		const result = dtStamp(new Date("2024-03-15T10:30:45.123Z"));
		expect(result).toBe("20240315_103045");
	});

	test("accepts Unix timestamp as number", () => {
		const date = new Date("2024-03-15T10:30:45.123Z");
		const result = dtStamp(date.getTime());
		expect(result).toBe("20240315_103045");
	});
});

describe("Options combinations", () => {
	test("readable datetime with milliseconds", () => {
		const result = dtStamp(new Date("2024-03-15T10:30:45.123Z"), {
			readable: true,
			ms: true,
		});
		expect(result).toBe("2024-03-15_10:30:45_123");
	});

	test("readable date only", () => {
		const result = dtStamp(new Date("2024-03-15T10:30:45.123Z"), {
			readable: true,
			parts: "date",
		});
		expect(result).toBe("2024-03-15");
	});

	test("readable time with milliseconds", () => {
		const result = dtStamp(new Date("2024-03-15T10:30:45.123Z"), {
			readable: true,
			parts: "time",
			ms: true,
		});
		expect(result).toBe("10:30:45.123");
	});

	test("custom delimiter", () => {
		const result = dtStamp(new Date("2024-03-15T10:30:45.123Z"), {
			delimiter: "-",
		});
		expect(result).toBe("20240315-103045");
	});
});
