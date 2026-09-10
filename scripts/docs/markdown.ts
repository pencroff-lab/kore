import { fromMarkdown } from "mdast-util-from-markdown";

export type DestinationKind = "link" | "image" | "definition";

export interface Destination {
	kind: DestinationKind;
	/** Destination exactly as written in the source, without `<`/`>`. */
	raw: string;
	/** Destination after CommonMark unescaping, for lookups. */
	value: string;
	/** Offsets of {@link raw} inside the source string. */
	start: number;
	end: number;
	/** True when the source wrote the destination as `<...>`. */
	angled: boolean;
	line: number;
	column: number;
}

interface MdNode {
	type: string;
	url?: string;
	children?: MdNode[];
	position?: {
		start: { line: number; column: number; offset?: number };
		end: { line: number; column: number; offset?: number };
	};
}

// Walks the mdast tree depth-first.
function walk(node: MdNode, visit: (n: MdNode) => void): void {
	visit(node);
	for (const child of node.children ?? []) walk(child, visit);
}

// Skips a backtick-delimited code span starting at `i`; returns the index
// after it, or -1 when the span is not closed before `end`.
function skipCodeSpan(src: string, i: number, end: number): number {
	let ticks = 0;
	while (i + ticks < end && src[i + ticks] === "`") ticks++;
	const fence = "`".repeat(ticks);
	const close = src.indexOf(fence, i + ticks);
	if (close === -1 || close >= end) return -1;
	return close + ticks;
}

// Finds the `]` matching the `[` at `open`, honouring escapes, nesting and
// code spans. Returns -1 when unbalanced.
function matchBracket(src: string, open: number, end: number): number {
	let depth = 0;
	for (let i = open; i < end; i++) {
		const ch = src[i];
		if (ch === "\\") {
			i++;
			continue;
		}
		if (ch === "`") {
			const next = skipCodeSpan(src, i, end);
			if (next === -1) continue;
			i = next - 1;
			continue;
		}
		if (ch === "[") depth++;
		else if (ch === "]") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

// Reads a CommonMark link destination starting at `i`. Returns its span, or
// null when the source does not hold one.
function readDestination(
	src: string,
	i: number,
	end: number,
): { start: number; end: number; angled: boolean } | null {
	while (i < end && /\s/.test(src[i] as string)) i++;
	if (i >= end) return null;
	if (src[i] === "<") {
		for (let j = i + 1; j < end; j++) {
			if (src[j] === "\\") {
				j++;
				continue;
			}
			if (src[j] === "\n") return null;
			if (src[j] === ">") return { start: i + 1, end: j, angled: true };
		}
		return null;
	}
	let depth = 0;
	let j = i;
	for (; j < end; j++) {
		const ch = src[j] as string;
		if (ch === "\\") {
			j++;
			continue;
		}
		if (/\s/.test(ch)) break;
		if (ch === "(") depth++;
		else if (ch === ")") {
			if (depth === 0) break;
			depth--;
		}
	}
	if (j === i) return null;
	return { start: i, end: j, angled: false };
}

// CommonMark backslash-unescaping, used to compare against real paths.
function unescapeDestination(raw: string): string {
	return raw.replace(/\\([!-/:-@[-`{-~])/g, "$1");
}

function lineColumn(
	src: string,
	offset: number,
): { line: number; col: number } {
	let line = 1;
	let last = -1;
	for (let i = 0; i < offset; i++) {
		if (src[i] === "\n") {
			line++;
			last = i;
		}
	}
	return { line, col: offset - last };
}

function toDestination(
	src: string,
	kind: DestinationKind,
	span: { start: number; end: number; angled: boolean },
): Destination {
	const raw = src.slice(span.start, span.end);
	const { line, col } = lineColumn(src, span.start);
	return {
		kind,
		raw,
		value: unescapeDestination(raw),
		start: span.start,
		end: span.end,
		angled: span.angled,
		line,
		column: col,
	};
}

/**
 * Collects every inline link, image and reference-definition destination in a
 * Markdown document, with the source offsets needed to rewrite it in place.
 * Fenced code, indented code and code spans are never reported.
 */
export function findDestinations(source: string): Destination[] {
	const tree = fromMarkdown(source) as MdNode;
	const found: Destination[] = [];

	walk(tree, (node) => {
		const pos = node.position;
		const from = pos?.start.offset;
		const to = pos?.end.offset;
		if (from === undefined || to === undefined) return;

		if (node.type === "link" || node.type === "image") {
			const isImage = node.type === "image";
			const open = isImage ? from + 1 : from;
			if (source[open] !== "[") return; // autolink or HTML form
			const close = matchBracket(source, open, to);
			if (close === -1 || source[close + 1] !== "(") return; // no inline dest
			const span = readDestination(source, close + 2, to);
			if (!span) return;
			found.push(toDestination(source, isImage ? "image" : "link", span));
			return;
		}

		if (node.type === "definition") {
			if (source[from] !== "[") return;
			const close = matchBracket(source, from, to);
			if (close === -1 || source[close + 1] !== ":") return;
			const span = readDestination(source, close + 2, to);
			if (!span) return;
			found.push(toDestination(source, "definition", span));
		}
	});

	return found.sort((a, b) => a.start - b.start);
}

/**
 * Locates the first level-1 heading, skipping any inside fenced or indented
 * code. Returns the source span to remove, or null when there is none.
 */
export function findFirstH1(
	source: string,
): { start: number; end: number } | null {
	const tree = fromMarkdown(source) as MdNode;
	for (const node of tree.children ?? []) {
		if (node.type !== "heading") continue;
		const depth = (node as MdNode & { depth?: number }).depth;
		if (depth !== 1) continue;
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (start === undefined || end === undefined) return null;
		let after = end;
		while (after < source.length && /[ \t\r]/.test(source[after] as string)) {
			after++;
		}
		while (after < source.length && source[after] === "\n") after++;
		return { start, end: after };
	}
	return null;
}

/**
 * Rewrites Markdown destinations in place. The callback returns the
 * replacement destination, or `null` to leave the original untouched.
 */
export function rewriteDestinations(
	source: string,
	rewrite: (destination: Destination) => string | null,
): string {
	const destinations = findDestinations(source);
	let out = source;
	for (let i = destinations.length - 1; i >= 0; i--) {
		const dest = destinations[i] as Destination;
		const next = rewrite(dest);
		if (next === null || next === dest.raw) continue;
		out = out.slice(0, dest.start) + next + out.slice(dest.end);
	}
	return out;
}
