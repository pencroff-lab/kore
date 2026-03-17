import { resolve } from "node:path";
import { Glob } from "bun";

const root = resolve(import.meta.dir, "..");

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileResult {
	path: string;
	isTypes: boolean;
	docRatio: number;
	exampleBlocks: { line: number; lineCount: number }[];
	totalNonBlank: number;
	docLines: number;
	moduleBlockLines: number;
}

// ─── JSDoc parsing ───────────────────────────────────────────────────────────

function analyzeFile(filePath: string, content: string): FileResult {
	const relPath = filePath.replace(`${root}/`, "");
	const isTypes = relPath.endsWith(".types.ts");
	const lines = content.split("\n");

	let docLines = 0;
	let totalNonBlank = 0;
	let inJSDoc = false;
	let inExample = false;
	let currentExampleStart = 0;
	let currentExampleLines = 0;
	const exampleBlocks: { line: number; lineCount: number }[] = [];

	// Track @module block for exclusion
	let moduleBlockLines = 0;
	let currentBlockLines = 0;
	let currentBlockHasModule = false;
	let moduleBlockFound = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		const trimmed = line.trim();

		if (trimmed.length === 0) continue;
		totalNonBlank++;

		// Detect JSDoc start
		if (!inJSDoc && trimmed.startsWith("/**")) {
			inJSDoc = true;
			docLines++;
			currentBlockLines = 1;
			currentBlockHasModule = false;

			// Single-line JSDoc: /** ... */
			if (trimmed.endsWith("*/") && trimmed.length > 4) {
				inJSDoc = false;
				if (trimmed.includes("@module") && !moduleBlockFound) {
					moduleBlockLines = 1;
					moduleBlockFound = true;
				}
				if (trimmed.includes("@example")) {
					exampleBlocks.push({ line: i + 1, lineCount: 1 });
				}
			}
			continue;
		}

		if (inJSDoc) {
			docLines++;
			currentBlockLines++;

			// Detect @module tag
			if (trimmed.includes("@module")) {
				currentBlockHasModule = true;
			}

			// Detect @example start
			if (trimmed.includes("@example")) {
				if (inExample) {
					// Close previous example block
					exampleBlocks.push({
						line: currentExampleStart,
						lineCount: currentExampleLines,
					});
				}
				inExample = true;
				currentExampleStart = i + 1;
				currentExampleLines = 1;
			} else if (inExample) {
				// Check if new tag starts (ends example)
				if (trimmed.startsWith("* @") && !trimmed.startsWith("* @example")) {
					exampleBlocks.push({
						line: currentExampleStart,
						lineCount: currentExampleLines,
					});
					inExample = false;
				} else {
					currentExampleLines++;
				}
			}

			// Detect JSDoc end
			if (trimmed.endsWith("*/")) {
				if (inExample) {
					exampleBlocks.push({
						line: currentExampleStart,
						lineCount: currentExampleLines,
					});
					inExample = false;
				}
				if (currentBlockHasModule && !moduleBlockFound) {
					moduleBlockLines = currentBlockLines;
					moduleBlockFound = true;
				}
				inJSDoc = false;
			}
		}
	}

	const effectiveDocLines = docLines - moduleBlockLines;
	const docRatio =
		totalNonBlank > 0
			? Math.round((effectiveDocLines / totalNonBlank) * 100)
			: 0;

	return {
		path: relPath,
		isTypes,
		docRatio,
		exampleBlocks,
		totalNonBlank,
		docLines: effectiveDocLines,
		moduleBlockLines,
	};
}

// ─── Rule enforcement ────────────────────────────────────────────────────────

function checkRules(result: FileResult): {
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	const isSmall = result.totalNonBlank < 100;

	if (result.isTypes) {
		// *.types.ts rules — tiered budget
		const budget = isSmall ? 80 : 50;
		if (result.docRatio > budget) {
			warnings.push(
				`${result.path}: doc ratio ${result.docRatio}% exceeds ${budget}% budget (${result.docLines}/${result.totalNonBlank} non-blank lines)`,
			);
		}
		for (const ex of result.exampleBlocks) {
			if (ex.lineCount > 5) {
				errors.push(
					`${result.path}:${ex.line}: @example block is ${ex.lineCount} lines (max 5 in *.types.ts). Move to *.examples.test.ts and use @see link instead.`,
				);
			}
		}
	} else {
		// Implementation *.ts rules — tiered budget
		const budget = isSmall ? 50 : 35;
		if (result.exampleBlocks.length > 0) {
			for (const ex of result.exampleBlocks) {
				errors.push(
					`${result.path}:${ex.line}: @example block found in implementation file (${ex.lineCount} lines). Move to *.examples.test.ts and use @see link instead.`,
				);
			}
		}
		if (result.docRatio > budget) {
			warnings.push(
				`${result.path}: doc ratio ${result.docRatio}% exceeds ${budget}% budget (${result.docLines}/${result.totalNonBlank} non-blank lines)`,
			);
		}
	}

	return { errors, warnings };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const glob = new Glob("src/**/*.ts");
const allErrors: string[] = [];
const allWarnings: string[] = [];

for await (const filePath of glob.scan({ cwd: root, absolute: true })) {
	const relPath = filePath.replace(`${root}/`, "");

	// Skip test files and barrel index files
	if (relPath.includes(".test.ts")) continue;
	if (relPath.endsWith("index.ts")) continue;

	const content = await Bun.file(filePath).text();
	const result = analyzeFile(filePath, content);
	const { errors, warnings } = checkRules(result);

	allErrors.push(...errors);
	allWarnings.push(...warnings);
}

// ─── Output ──────────────────────────────────────────────────────────────────

for (const w of allWarnings) {
	console.warn(`WARN: ${w}`);
}
for (const e of allErrors) {
	console.error(`FAIL: ${e}`);
}

if (allErrors.length > 0) {
	console.error(
		`\nDocs check failed: ${allErrors.length} error(s), ${allWarnings.length} warning(s)`,
	);
	process.exit(1);
}

if (allWarnings.length > 0) {
	console.log(`\nDocs check passed with ${allWarnings.length} warning(s)`);
} else {
	console.log("Docs check passed.");
}
