import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import sinon from "sinon";
import { dtStamp } from "./format_dt";

describe("dtStamp", () => {
	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	test("uses current date when called with no arguments", () => {
		const fixedDate = new Date("2024-02-18T14:30:52.000Z");
		sandbox.useFakeTimers(fixedDate.getTime());

		expect(dtStamp()).toBe("20240218_143052");
	});

	test("treats null date same as no date", () => {
		const fixedDate = new Date("2024-02-18T14:30:52.000Z");
		sandbox.useFakeTimers(fixedDate.getTime());

		expect(dtStamp(null)).toBe("20240218_143052");
	});

	test("defaults to UTC", () => {
		// 2024-02-18T23:30:00Z — in UTC it's the 18th, in UTC+2 it would be the 19th
		const date = new Date("2024-02-18T23:30:00.000Z");

		expect(dtStamp(date)).toBe("20240218_233000");
	});

	test.each([
		{
			scenario: "default options (local tz)",
			date: new Date(2024, 1, 18, 14, 30, 52, 0),
			options: { tz: "local" as const },
			expected: "20240218_143052",
		},
		{
			scenario: "custom delimiter",
			date: new Date(2024, 1, 18, 14, 30, 52, 0),
			options: { delimiter: "-", tz: "local" as const },
			expected: "20240218-143052",
		},
		{
			scenario: "ms enabled",
			date: new Date(2024, 1, 18, 14, 30, 52, 789),
			options: { ms: true, tz: "local" as const },
			expected: "20240218_143052_789",
		},
		{
			scenario: "ms with custom delimiter",
			date: new Date(2024, 1, 18, 14, 30, 52, 789),
			options: { delimiter: "-", ms: true, tz: "local" as const },
			expected: "20240218-143052-789",
		},
		{
			scenario: "zero-pads month, day, time parts",
			date: new Date(2024, 0, 5, 9, 8, 7, 0),
			options: { tz: "local" as const },
			expected: "20240105_090807",
		},
		{
			scenario: "zero-pads milliseconds",
			date: new Date(2024, 0, 1, 0, 0, 0, 42),
			options: { ms: true, tz: "local" as const },
			expected: "20240101_000000_042",
		},
	])("$scenario", ({ date, options, expected }) => {
		expect(dtStamp(date, options)).toBe(expected);
	});

	describe("tz option", () => {
		test("tz: utc uses UTC getters", () => {
			const date = new Date("2024-07-04T03:15:42.500Z");

			expect(dtStamp(date, { tz: "utc" })).toBe("20240704_031542");
		});

		test("tz: local uses local getters", () => {
			const date = new Date(2024, 6, 4, 3, 15, 42, 500);

			expect(dtStamp(date, { tz: "local" })).toBe("20240704_031542");
		});
	});

	describe("parts option", () => {
		test("parts: date returns date only", () => {
			const date = new Date("2024-02-18T14:30:52.000Z");

			expect(dtStamp(date, { parts: "date" })).toBe("20240218");
		});

		test("parts: time returns time only", () => {
			const date = new Date("2024-02-18T14:30:52.000Z");

			expect(dtStamp(date, { parts: "time" })).toBe("143052");
		});

		test("parts: time with ms", () => {
			const date = new Date("2024-02-18T14:30:52.789Z");

			expect(dtStamp(date, { parts: "time", ms: true })).toBe("143052_789");
		});

		test("parts: datetime returns full stamp (default)", () => {
			const date = new Date("2024-02-18T14:30:52.000Z");

			expect(dtStamp(date, { parts: "datetime" })).toBe("20240218_143052");
		});
	});

	describe("compact option", () => {
		test("compact removes all delimiters", () => {
			const date = new Date("2024-02-18T14:30:52.000Z");

			expect(dtStamp(date, { compact: true })).toBe("20240218143052");
		});

		test("compact with ms", () => {
			const date = new Date("2024-02-18T14:30:52.789Z");

			expect(dtStamp(date, { compact: true, ms: true })).toBe(
				"20240218143052789",
			);
		});

		test("compact overrides explicit delimiter", () => {
			const date = new Date("2024-02-18T14:30:52.000Z");

			expect(dtStamp(date, { compact: true, delimiter: "-" })).toBe(
				"20240218143052",
			);
		});

		test("compact with parts: time and ms", () => {
			const date = new Date("2024-02-18T14:30:52.789Z");

			expect(dtStamp(date, { compact: true, parts: "time", ms: true })).toBe(
				"143052789",
			);
		});
	});
});
