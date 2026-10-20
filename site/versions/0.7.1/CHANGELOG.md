# Changelog

## [0.7.1] - 2026-10-20

### Bug Fixes

- Recover and document 0.7.0 publication (3d9f83d)

### Documentation

- Rename CLAUDE.md to AGENTS.md to manage codex as well (44cfd0c)
- Move consumer guides from Outcome to flow (7db7e59)

### Features

- Close agentic safety holes in flow typing and add result-usage checks (1202b41)

- CI now commits verified publication receipts to main automatically; the artifact remains available for manual recovery.

### Other

- Merge pull request #23 from pencroff-lab/fix/publication-bun (3eae79c)
- Merge pull request #24 from pencroff-lab/fix/publication-bun (e6122b5)

### Breaking changes and migration

v0.7.1 tightens the flow type contracts. Although this release uses a patch
version, the following previously accepted TypeScript calls must migrate.

#### Validate untyped values at an adapter boundary

Fallible callbacks, pipeline stages and sources now reject visible inferred
`any` and `Promise<any>`. Replace `attempt(() => JSON.parse(raw))` with
`attemptValue`, then validate its `unknown` payload. The adapters always add a
success envelope, so parsed tuple-shaped or error-shaped data stays data.

```typescript
import {
	attemptValue, attemptValueAsync, fail, flatMap, ok, type ResultTuple,
} from "@pencroff-lab/kore";

function parsePort(raw: string): ResultTuple<number> {
	return flatMap(attemptValue(() => JSON.parse(raw)), (data) => {
		if (
			typeof data !== "object" || data === null ||
			!("port" in data) || typeof data.port !== "number"
		) {
			return fail("numeric port required", "CONFIG:PORT");
		}
		return ok(data.port);
	});
}

function readResponse(response: Response): Promise<ResultTuple<unknown>> {
	return attemptValueAsync(() => response.json());
}
```

`attemptValue` rejects known Promise/PromiseLike returns, including mixed
value-or-promise returns. Use `attemptValueAsync` for them; it awaits thenables
and converts rejections to failures. Validate the resulting payload before
reading its properties, as in `parsePort` above.

Explicit success type arguments remain a guard bypass:
`attempt<number>(() => JSON.parse(raw))` still compiles. Preannotated callbacks,
operator aliases and casts can also erase the raw return type; JavaScript has
no type protection. Consumers need type-aware unsafe-any lint for returns,
assignments, arguments, member access and calls. An explicit generic is a type
claim, not data validation.

#### Split pipelines longer than ten stages

The widening overloads are removed. `pipe` and `pipeAsync` now reject an
eleventh stage; compose typed chunks instead.

```typescript
import { ok, onOk, pipe, type ResultTuple } from "@pencroff-lab/kore";

const step = onOk((n: number) => ok(n + 1));
const first = pipe(
	ok(0), step, step, step, step, step, step, step, step, step, step,
);
const result: ResultTuple<number> = pipe(first, step);
```

For async chunks, await the first `pipeAsync` result or pass its promise as
the source of the next `pipeAsync` call.

#### Make side-effect returns explicit

`effect` accepts only `void`/`undefined` callbacks. It now rejects tuple returns,
async callbacks, and expression-bodied value returns such as
`() => seen.push(1)` (which returns a number). Use a block with no return for
synchronous void work:

```typescript
import { effect, ok } from "@pencroff-lab/kore";

const seen: number[] = [];
const recorded = effect(ok(1), () => {
	seen.push(1);
});
```

Use `flatMap`/`flatMapAsync` for fallible work, preserving the original value
with `map` if needed. Use `effectAsync` and await it for asynchronous void work.

```typescript
import {
	effectAsync, flatMap, flatMapAsync, map, ok, type ResultTuple,
} from "@pencroff-lab/kore";

declare function save(n: number): ResultTuple<void>;
declare function saveAsync(n: number): Promise<ResultTuple<void>>;
declare function notify(): Promise<void>;

const saved = flatMap(ok(1), (n) => map(save(n), () => n));
const savedAsync = await flatMapAsync(ok(1), async (n) =>
	map(await saveAsync(n), () => n),
);
const notified = await effectAsync(ok(1), async () => {
	await notify();
});
```

#### Handle every result

Enable `noFloatingPromises`, and handle or propagate every tuple, including
awaited results. Promise lint alone permits awaited or explicitly voided tuples
to be discarded. v0.7.1 adds an in-repository tuple usage checker and Biome
promise checks to local lint and CI; it ships no downstream tuple must-use
rule. Consumer rule delivery remains a follow-up. These checks do not prove
that every later caller handles an assigned or passed result.

## [0.7.0] - 2026-09-11

### Bug Fixes

- Compare file contents instead of timestamps (26477e4)

### Documentation

- Doc(site): add custom CSS assets for site palette (05afc13)

### Features

- Feat(flow): functional tuple based err boundaries (e65878e)

### Other

- Re-works started (da571f6)
- Add docs by hextra (82b32fb)
- Update CHANGELOG.md (d9f1aa1)
- Update ci.yml (ed2b033)

### Refactor

- Update protocol docs & tests (795b410)

## [0.6.0] - 2026-09-01

### Features

- Reject invalid callback returns (2887ef2)
- Add flatMap, deprecate unit (5c7a4dc)
- Add metadata immutability support (811fc20)
- Add flatMap and metadata immutability (d93e698)

### Other

- Merge pull request #18 from pencroff-lab/17-fix-from-callback-various-values (fbc581f)

## [0.5.0] - 2026-05-11

### Features

- Check for any code in error tree (0247f5f)
- Allow hasCode() to check any code (d256835)

### Other

- Merge pull request #16 from pencroff-lab/15-code-check---make-code-optional (4623e59)

## [0.4.0] - 2026-04-02

### Bug Fixes

- Capture native Error .code (4f7505a)

### Documentation

- Replace Err.aggregate with Err.from (499adea)
- Update error handling patterns guide (dbb1155)

### Features

- Refactor static wrap/aggregate, simplify API (b779e69)

### Other

- Merge pull request #13 from pencroff-lab/12-native-err-code-capture (68d7a2d)
- Update package.json version (1c1132d)
- Merge pull request #14 from pencroff-lab/12-native-err-code-capture (53c44d2)

### Refactor

- Use addAll for outcome error aggregation (64255f4)
- Simplify aggregation API (86127e3)

## [0.3.1] - 2026-03-19

### Documentation

- Rename and reorganize guide files in documentation (d8a7447)
- Update error handling guide link to reflect new naming convention (7220943)

### Other

- Merge pull request #11 from pencroff-lab/docs_refactoring (49d81d0)

## [0.3.0] - 2026-03-17

### Bug Fixes

- Resolve lint warnings and type errors in test files (9484b3b)
- Use relative links in TypeDoc and plain @see references (7addecf)
- Add example test links in generated docs with relative paths (74a4e4b)

### Documentation

- Add plan for Err metadata methods (f639b90)
- Add Git Worktree Guide (2d2e61a)
- Remove metadata-methods plan file (990251a)
- Add migration plan (a2423d8)
- Update API docs with example references (e5a22d2)
- Update JSDoc and TypeDoc guidelines (087816f)
- Add docs migration step 2 plan (7c0c40a)
- Update docs for types and utils (f485b31)
- Add @module tags for err and outcome (300b745)
- Enforce no file-level JSDoc in *.types.ts (585f3ba)
- Add migration plan for docs step 3 (ae81358)
- Add error handling and migration guides (118a7e3)
- Remove legacy migration plan files (6ae0896)

### Features

- Add git-cliff (0dbef87)
- Add git-cliff changelog (452f121)
- DtStamp accept unix timestamps (f0da2ae)

### Other

- Merge pull request #6 from pencroff-lab/set_changelog (0209fef)
- Merge pull request #7 from pencroff-lab/2-add-to-dtstamp-support-timestamp-as-number (12a9128)
- Haiku implementation (5c6b062)
- Add metadata find/filter tests for Err (96b1210)
- Merge branch 'compare/haiku' into 5-methods-metadata (bcddf35)
- Merge pull request #9 from pencroff-lab/5-methods-metadata (2a26fd7)
- Phase 1 - CI enforcement script of doc migration (ba78766)
- Phase 2 - Extract types of doc migration (3c7d7e6)
- Phase 3 - Create examples test files of doc migration (2c826e4)
- Phase 4 - Trim JSDoc in source files of doc migration (dc1c7c6)
- Phase 5 - Update CLAUDE.md of doc migration (dfe815c)
- Phase 6 - Verify and format of doc migration (d115a06)
- Merge pull request #10 from pencroff-lab/8-refine-doc-approach (063e378)

### Refactor

- Inline dtStamp date init (7a7467d)

## [0.2.1] - 2026-02-27

### Other

- Add TypeDoc markdown API docs and config (ee2e861)
- Add TypeDoc JSDoc guide for API documentation conventions (32cb342)
- Add documentation guide and docstring audit reports to docs (191942d)
- Update Outcome API doc mismatch table with proposed fixes (056a91d)
- Add JSDoc comments for internal helpers in logger and outcome (16cbfd8)
- Update README links and remove obsolete API docs (9138bc7)
- Update package.json (9000041)
- Merge pull request #3 from pencroff-lab/TypeDoc_setup (15c4f97)

## [0.2.0] - 2026-02-21

### Other

- Add brainstorm and logger redesign documentation for zero-dependency logger implementation (fd2bf25)
- Add logger export and enhance test coverage with detailed argument resolution and context handling (afe06a9)
- Add logging guide with patterns, conventions, and integration details (caa26e0)
- Add logger documentation with usage patterns, types, and integration details (1b62c18)
- Bump version to 0.2.0 - logger with docs and guide (00b62ec)

## [0.1.2] - 2026-02-19

### Other

- Initial commit (170dd36)
- Initialize project with CI configuration, package setup, and TypeScript support (7121398)
- Add initial implementation of formatDateTime function and tests for Err and Outcome types (0e348af)
- Add testing guide and CLAUDE documentation for project setup and best practices (6238456)
- Add dtStamp function with options for formatting date and time, and update CI configuration for linting and test coverage (10a744d)
- Update linting scripts in package.json to include type checking and improve CI configuration (4e86b9b)
- Add scripts for version checking, build verification, and CJS compatibility (c4d21b6)
- Add README.md with library overview, installation instructions, API documentation, and development guidelines (c7b867f)
- Update CI configuration to add permissions for OIDC and increment package version to 0.1.1 (5079f66)
- Update CI configuration to uncomment permissions for OIDC and enable npm token usage (93273e3)
- Add llms.txt with library overview, modules, quick start, and installation instructions (2f0fdc8)
