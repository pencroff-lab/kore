import { resolve } from "node:path";
import { Glob } from "bun";
import ts from "typescript";

/** A module specifier found in a source file. `null` when not statically known. */
export interface ImportRef {
	specifier: string | null;
	line: number;
}

// Literal text of a module specifier, or null when it cannot be resolved
// statically (a template with substitutions, a variable, a missing argument).
function literalText(node: ts.Node | undefined): string | null {
	if (!node) return null;
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	return null;
}

/**
 * Every module specifier a file depends on.
 *
 * Covers static imports and re-exports, dynamic `import()`, `require()`,
 * `import x = require(...)`, and inline import types (`import("m").T` and
 * `typeof import("m")`) — a type-level edge is still an edge, and the tier rule
 * is type-level. A specifier that is not a literal is reported with
 * `specifier: null` rather than skipped, so it cannot silently bypass a rule.
 *
 * @param source - File contents
 * @param fileName - Name used for parsing and diagnostics
 * @returns Every dependency reference, in source order
 */
export function importSpecifiers(
	source: string,
	fileName = "probe.ts",
): ImportRef[] {
	const sourceFile = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const refs: ImportRef[] = [];

	const record = (node: ts.Node, target: ts.Node | undefined): void => {
		refs.push({
			specifier: literalText(target),
			line:
				sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
					.line + 1,
		});
	};

	const visit = (node: ts.Node): void => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			if (node.moduleSpecifier) record(node, node.moduleSpecifier);
		} else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference)
		) {
			record(node, node.moduleReference.expression);
		} else if (ts.isImportTypeNode(node)) {
			// `import("m").T` and `typeof import("m")` — the argument is a literal
			// type node wrapping the specifier.
			const { argument } = node;
			record(
				node,
				ts.isLiteralTypeNode(argument) ? argument.literal : argument,
			);
		} else if (ts.isCallExpression(node)) {
			const isDynamicImport =
				node.expression.kind === ts.SyntaxKind.ImportKeyword;
			const isRequire =
				ts.isIdentifier(node.expression) && node.expression.text === "require";
			if (isDynamicImport || isRequire) record(node, node.arguments[0]);
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return refs;
}

/**
 * Rule: nothing under `src/flow/` may depend on the class tier.
 *
 * @param path - Path reported in the message
 * @param source - File contents
 * @returns One message per violation
 */
export function flowViolations(path: string, source: string): string[] {
	return importSpecifiers(source, path).flatMap(({ specifier, line }) => {
		if (specifier === null) {
			return [
				`${path}:${line}: import specifier is not statically analyzable — src/flow/ must keep every dependency inspectable`,
			];
		}
		return specifier.toLowerCase().includes("outcome")
			? [
					`${path}:${line}: imports "${specifier}" — src/flow/ must not name outcome`,
				]
			: [];
	});
}

/**
 * Rule: `common.types.ts` owns the shared tuple alias and imports only `./err`.
 *
 * @param source - File contents
 * @returns One message per violation
 */
export function commonTypesViolations(source: string): string[] {
	const path = "src/types/common.types.ts";
	return importSpecifiers(source, path).flatMap(({ specifier, line }) =>
		specifier === "./err"
			? []
			: [
					`${path}:${line}: imports ${
						specifier === null ? "a non-literal specifier" : `"${specifier}"`
					} — only "./err" is allowed`,
				],
	);
}

if (import.meta.main) {
	const root = resolve(import.meta.dir, "..");
	const errors: string[] = [];

	const flowGlob = new Glob("src/flow/**/*.ts");
	for await (const file of flowGlob.scan({ cwd: root, absolute: true })) {
		const rel = file.replace(`${root}/`, "");
		errors.push(...flowViolations(rel, await Bun.file(file).text()));
	}

	const commonPath = resolve(root, "src/types/common.types.ts");
	errors.push(...commonTypesViolations(await Bun.file(commonPath).text()));

	if (errors.length > 0) {
		for (const e of errors) console.error(`FAIL: ${e}`);
		console.error(`\nImport boundary check failed: ${errors.length} error(s)`);
		process.exit(1);
	}

	console.log("Import boundary check passed.");
}
