import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

const contractName = ".kore-result-usage-contract.ts";

/** Loads a project with a virtual reference to the actual result contract. */
export function resultUsageProgram(
	project: string,
	contractModule = resolve(import.meta.dir, "../index.ts"),
): ts.Program {
	const config = ts.readConfigFile(project, ts.sys.readFile);
	if (config.error) {
		throw new Error(
			ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
		);
	}
	const parsed = ts.parseJsonConfigFileContent(
		config.config,
		ts.sys,
		dirname(project),
	);
	if (parsed.errors.length) {
		throw new Error(
			ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
				getCanonicalFileName: (file) => file,
				getCurrentDirectory: () => dirname(project),
				getNewLine: () => "\n",
			}),
		);
	}
	const contractPath = resolve(dirname(project), contractName);
	const contract = `type KoreMustUseResult = import(${JSON.stringify(contractModule)}).ResultTuple<unknown>;`;
	const host = ts.createCompilerHost(parsed.options);
	const read = host.readFile;
	const exists = host.fileExists;
	const getSource = host.getSourceFile;
	host.readFile = (file) => (file === contractPath ? contract : read(file));
	host.fileExists = (file) => file === contractPath || exists(file);
	host.getSourceFile = (file, version, onError, fresh) =>
		file === contractPath
			? ts.createSourceFile(file, contract, version, true)
			: getSource(file, version, onError, fresh);
	return ts.createProgram(
		[...parsed.fileNames, contractPath],
		parsed.options,
		host,
	);
}

// Wrappers do not consume a result; look through them at the same expression.
function unwrap(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (
		ts.isParenthesizedExpression(current) ||
		ts.isAsExpression(current) ||
		ts.isTypeAssertionExpression(current) ||
		ts.isNonNullExpression(current) ||
		ts.isSatisfiesExpression(current)
	)
		current = current.expression;
	return current;
}

// A reason must be on the line immediately above an explicit void statement.
function suppressed(
	statement: ts.ExpressionStatement,
	source: ts.SourceFile,
): boolean {
	if (!ts.isVoidExpression(unwrap(statement.expression))) return false;
	const start = statement.getStart(source);
	const { line } = source.getLineAndCharacterOfPosition(start);
	const lines = source.getLineStarts();
	if (line === 0 || !/^\s*$/u.test(source.text.slice(lines[line], start)))
		return false;
	const previous = source.text.slice(lines[line - 1], lines[line]).trimEnd();
	return /^\s*\/\/ kore-ignore-result:[ \t]*\S.*$/u.test(previous);
}

/** Finds discarded structural results and callbacks consumed as returning void. */
export function resultUsageViolations(
	program: ts.Program,
	root: string,
	files?: readonly string[],
): string[] {
	const checker = program.getTypeChecker();
	const contract = program.getSourceFile(resolve(root, contractName));
	const declaration = contract?.statements.find(ts.isTypeAliasDeclaration);
	if (!declaration) throw new Error("Missing virtual result contract");
	const resultType = checker.getTypeFromTypeNode(declaration.type);
	if (resultType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
		throw new Error(
			"ResultTuple contract did not resolve; check project imports",
		);
	}
	const violations: string[] = [];
	const selected = files
		? new Set(files.map((file) => resolve(root, file)))
		: null;

	const isResult = (type: ts.Type, seen = new Set<ts.Type>()): boolean => {
		if (
			type.flags &
			(ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)
		)
			return false;
		if (seen.has(type)) return false;
		seen.add(type);
		if (type.isUnion()) return type.types.some((part) => isResult(part, seen));
		const awaited = checker.getAwaitedType(type);
		if (awaited && awaited !== type) return isResult(awaited, seen);
		if (checker.isTypeAssignableTo(type, resultType)) return true;
		if (checker.isArrayType(type) || checker.isTupleType(type)) {
			const element = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
			return Boolean(element && isResult(element, seen));
		}
		// allSettled wraps fulfilled results in { status: "fulfilled", value }.
		const status = checker.getPropertyOfType(type, "status");
		const value = checker.getPropertyOfType(type, "value");
		if (status && value) {
			const statusType = checker.getTypeOfSymbolAtLocation(status, declaration);
			if (statusType.isStringLiteral() && statusType.value === "fulfilled")
				return isResult(
					checker.getTypeOfSymbolAtLocation(value, declaration),
					seen,
				);
		}
		return false;
	};
	const isVoid = (type: ts.Type): boolean => {
		if (type.isUnion()) return type.types.some(isVoid);
		const awaited = checker.getAwaitedType(type) ?? type;
		if (awaited.isUnion()) return awaited.types.some(isVoid);
		return Boolean(
			awaited.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined),
		);
	};

	for (const source of program.getSourceFiles()) {
		const path = relative(root, source.fileName).replaceAll("\\", "/");
		if (
			source.isDeclarationFile ||
			(selected
				? !selected.has(source.fileName)
				: !/^(src|scripts)\//u.test(path))
		)
			continue;
		const reported = new Set<ts.Node>();
		const ignored = new Set<ts.Expression>();
		const report = (node: ts.Node, message: string): void => {
			if (reported.has(node)) return;
			reported.add(node);
			const line =
				source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
			violations.push(`${path}:${line}: ${message}`);
		};
		const discard = (expression: ts.Expression): void => {
			const value = unwrap(expression);
			if (ignored.has(value) || ts.isYieldExpression(value)) return;
			if (
				ts.isBinaryExpression(value) &&
				value.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
				value.operatorToken.kind <= ts.SyntaxKind.LastAssignment
			) {
				return;
			} else if (ts.isVoidExpression(value)) {
				discard(value.expression);
			} else if (isResult(checker.getTypeAtLocation(value))) {
				report(
					value,
					"result tuple discarded; handle its error or put // kore-ignore-result: <reason> before an explicit void statement",
				);
			} else if (ts.isConditionalExpression(value)) {
				discard(value.whenTrue);
				discard(value.whenFalse);
			} else if (
				ts.isBinaryExpression(value) &&
				[
					ts.SyntaxKind.CommaToken,
					ts.SyntaxKind.AmpersandAmpersandToken,
					ts.SyntaxKind.BarBarToken,
					ts.SyntaxKind.QuestionQuestionToken,
				].includes(value.operatorToken.kind)
			) {
				discard(value.left);
				discard(value.right);
			}
		};
		const callback = (
			expression: ts.Node,
			contextual: ts.Type | undefined,
		): void => {
			const actual = checker.getTypeAtLocation(expression).getCallSignatures();
			const target = contextual?.isUnion()
				? contextual.types.flatMap((part) => part.getCallSignatures())
				: (contextual?.getCallSignatures() ?? []);
			if (
				actual.some((signature) =>
					isResult(checker.getReturnTypeOfSignature(signature)),
				) &&
				target.length > 0 &&
				target.every((signature) =>
					isVoid(checker.getReturnTypeOfSignature(signature)),
				)
			)
				report(
					expression,
					"tuple-returning callback discarded by a void consumer; handle the result inside the callback",
				);
		};
		const visit = (node: ts.Node): void => {
			if (ts.isExpressionStatement(node)) {
				if (suppressed(node, source)) ignored.add(unwrap(node.expression));
				discard(node.expression);
			}
			if (ts.isVoidExpression(node) && !ignored.has(node))
				discard(node.expression);
			if (ts.isForStatement(node)) {
				if (node.initializer && !ts.isVariableDeclarationList(node.initializer))
					discard(node.initializer);
				if (node.incrementor) discard(node.incrementor);
			}
			if (
				ts.isBinaryExpression(node) &&
				node.operatorToken.kind === ts.SyntaxKind.CommaToken
			)
				discard(node.left);
			if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
				callback(node, checker.getContextualType(node));
			if (
				ts.isMethodDeclaration(node) &&
				ts.isObjectLiteralExpression(node.parent)
			) {
				const object = checker.getContextualType(node.parent);
				const name = ts.isStringLiteralLike(node.name)
					? node.name.text
					: node.name.getText(source);
				const property = object && checker.getPropertyOfType(object, name);
				if (property)
					callback(node, checker.getTypeOfSymbolAtLocation(property, node));
			}
			if (ts.isCallExpression(node) || ts.isNewExpression(node))
				for (const arg of node.arguments ?? [])
					callback(arg, checker.getContextualType(arg));
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return violations;
}

if (import.meta.main) {
	const project = resolve(
		Bun.argv[2] ?? resolve(import.meta.dir, "../tsconfig.json"),
	);
	const root = dirname(project);
	const violations = resultUsageViolations(resultUsageProgram(project), root);
	for (const violation of violations) console.error(`FAIL: ${violation}`);
	if (violations.length) process.exit(1);
	console.log("Result usage check passed.");
}
