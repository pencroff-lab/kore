export interface DtStampOptions {
	delimiter?: string;
	ms?: boolean;
	tz?: "utc" | "local";
	parts?: "datetime" | "date" | "time";
	compact?: boolean;
}

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
