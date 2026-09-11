# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@pencroff-lab/kore` is a TypeScript core utilities library published to npm as a dual ESM/CJS package. It provides value-based error handling inspired by Go-style error handling: the `Err` type, and — since v0.7.0 — the `flow` tier of free functions over `ResultTuple<T>`. The `Outcome<T>` class is deprecated and frozen.

## Commands

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Run all tests | `bun test` |
| Run tests with coverage | `bun run test:coverage` |
| Run a single test file | `bun test src/types/err.test.ts` |
| Run tests matching pattern | `bun test --test-name-pattern "pattern"` |
| Watch mode | `bun test --watch` |
| **Lint (all checks)** | **`bun run lint`** (biome fix + type check + doc check) |
| Lint & format only | `bunx biome check --fix src/ scripts/` |
| Lint (CI, no writes) | `bunx biome ci src/ scripts/` |
| Build (ESM + CJS) | `bun run build` |
| Fix CJS compatibility | `bun scripts/fix-cjs.sh.ts` (runs automatically in build) |
| Verify build artifacts | `bun scripts/verify-build.sh.ts` (runs automatically in build) |
| Check version on npm | `bun scripts/check-version.sh.ts` |
| Check docs | `bun run check:docs` |
| Validate all documentation | `bun run docs:check` (add `-- --site build/docs-site/public` for rendered links) |
| Regenerate API + example Markdown | `bun run docs:generate` |
| Build the documentation site | `bun run docs:build` |
| Serve the site locally | `bun run docs:dev` (1313) / `bun run docs:preview` (4173) |
| Snapshot a release's docs | `bun run docs:snapshot <version>` |
| Record a verified npm release | `bun run docs:record-publication <version>` |
| Check import boundaries | `bun run check:boundaries` |
| Test build tooling | `bun test ./scripts/<name>.test.ts` (also covered by `bun test`) |
| Check release state (version vs CHANGELOG) | `bun run check:release` |
| Verify built package consumers | `bun scripts/verify-consumers.sh.ts` (runs automatically in build) |
| Publish | `bun run publish_pkg` |

## Testing

Use `bun run test:coverage` to run tests with coverage. Coverage must be >= 83%.
`bunfig.toml` sets the test root to the repository (build tooling under
`scripts/` carries its own tests) and excludes `scripts/**` from the coverage
gate, which measures the published library.

### Core Testing Rules

- Use `test()` from `bun:test` -- PROHIBITED to use `it()`
- Place test files next to source: `parser.test.ts` beside `parser.ts`
- Integration tests use `.integration.test.ts` suffix
- **Sinon for ALL behavior/assertions**, `mock.module()` ONLY for ESM import wiring
- Always use Sinon sandboxes (`sinon.createSandbox()` in `beforeEach`, `sandbox.restore()` in `afterEach`)
- Test both success and error paths with `Outcome` types using `toTuple()`
- Use `test.each` with object format for parametrized tests
- Place all imports (including type imports) at the beginning of the file before any test code
- Strategy preference order:
  1. Observable behavior testing (verify side effects via mocked deps)
  2. Dependency injection (inject test state via optional params)
  3. Underscore-prefixed properties (last resort, edge cases only)

Full testing guide: `.claude/rules/testing.md`

### TypeScript Mocking Patterns

When writing tests, avoid `any` type assertions. Use Sinon for all behavior definitions.

**Use `as unknown as <Type>` for Sinon stub mock objects:**

```typescript
import type { PGlite } from "@electric-sql/pglite";
const mockDb = { exec: sinon.stub().resolves() } as unknown as PGlite;
```

**Use specific function signatures instead of `Function`:**

```typescript
let handlers: Record<string, () => void>;
let handlers: Record<string, (...args: never) => unknown>;
```

**Type adjustment for internal properties:**

```typescript
const ext = extension as { _cleanup?: () => void };
```

**Sinon stubs with proper type casting:**

```typescript
sandbox.stub(process, "exit").callsFake(
    (() => {}) as (code?: number) => never
);
```

## Architecture

### Dual ESM/CJS Build

```
index.ts (root barrel) --> tsc (tsconfig.esm.json) --> dist/esm/
                       --> tsc (tsconfig.cjs.json) --> dist/cjs/
                                                   --> fix-cjs.sh.ts --> dist/cjs/package.json
```

- `tsconfig.json` -- IDE/dev config (noEmit)
- `tsconfig.build.json` -- shared build settings (extends tsconfig.json)
- `tsconfig.esm.json` / `tsconfig.cjs.json` -- extend build config with output format

Build entries are `index.ts` (package root) and `test.ts` (the
`@pencroff-lab/kore/test` subpath), both re-exporting from `src/`. Tests,
benchmarks, and specs are excluded from builds. `postbuild` runs
`verify-build.sh.ts` (asserts the eight required `dist` paths) and
`verify-consumers.sh.ts` (throwaway ESM + CJS consumers, a declaration-consumer
type-check against `dist/esm/*.d.ts`, and the foreign-copy `Err` reconstruction
case). `expectOk` / `expectErr` must never be re-exported from the package root.

### Tuple tier (`src/flow/`)

`flow` is the primary API: free functions over `ResultTuple<T>`, with `Err` as
their only runtime dependency. `src/flow/flow.ts` is the implementation and the
TypeDoc entry point; `src/flow/flow.types.ts` holds `Op`, `OpAsync`, `AnyOp`,
`AsyncSource`, `OkValue`, `OkValues`; `src/flow/test.ts` holds `expectOk` /
`expectErr` and ships from the `@pencroff-lab/kore/test` subpath **only**.

- **One fallible protocol.** Every fallible callback returns a `ResultTuple`.
  The error slot is the only failure signal — no operator inspects a value's
  runtime shape. `map` is the single exception: its return is always data.
  A bare value, a bare `Err`, and a missing return are all compile errors.
- **`ok(...)`** is the one way to carry error- or tuple-shaped data as success.
  `fail` has exactly one signature (`Err | string`, optional code); richer
  construction goes through `Err.from(...)` and is passed as `fail(err)`.
- **Exception boundaries.** `attempt`/`attemptAsync`, every callback-taking
  operation, and every pipeline stage convert a throw to `Err.from(caught)`.
  `defaultTo` and `either` are terminal and add no catch boundary.
- **`defaultTo` is handler-only** — `defaultTo(tuple, () => 0)`. The class-tier
  value form and its `asValue` flag are deliberately not reproduced.
- **Input protection.** `pipe`/`pipeAsync` copy the source once on entry;
  `effect` hands its callback the output copy, `onTuple` an input copy. An
  unchanged passthrough channel is returned by reference. `all` always
  constructs; `any` returns the winning input by reference. Payloads are never
  cloned. `copy` is exported for custom operators.
- **Ten typed stages** in both `pipe` and `pipeAsync`, matching the frozen
  `Outcome` ladders; past ten the result widens to `ResultTuple<unknown>`.
- Data-first functions hold the logic; `onOk`/`onErr`/`onTuple` only delegate.
  No error-enrichment helpers exist — chain `Err` methods inside `mapErr`/`onErr`.
- `fromJSON` validates the envelope and the error slot only, never throws, and
  rejects with the deterministic `INVALID_JSON` rows documented in
  `docs/guides/flow-operation-flows.md`.

### Module boundaries

```text
Err                     depends on nothing in this graph
└── common.types.ts     owns ResultTuple; imports the Err type only
    ├── flow            imports Err and common.types.ts
    └── Outcome         imports Err and common.types.ts
```

Read `A └── B` as **B imports A**. `src/types/common.types.ts` is the single
declaration site of the readonly `ResultTuple<T>`; `src/types/outcome.types.ts`
and `src/flow/flow.ts` both re-export that one binding, so the tiers stay
mutually assignable with no cross-tier import. `src/flow/` must never name
`outcome` in an import specifier, and `common.types.ts` must import only
`./err` — `scripts/check-boundaries.sh.ts` enforces both in `bun run lint`. It
parses with the TypeScript compiler rather than by regex — static imports and
re-exports, dynamic `import()`, `require()`, `import x = require(...)`, and
inline import types (`import("m").T`, `typeof import("m")`), since the tier rule
is type-level and a type-level edge is still an edge. A specifier it cannot
resolve statically is a violation rather than a skip.

### Core Types (`src/types/`)

- **`Err`** -- Immutable, value-based error type. Supports wrapping (cause chains), aggregation (multiple errors), hierarchical error codes (`AUTH:TOKEN:EXPIRED`), JSON serialization/deserialization, and conversion to native `Error`. All mutating methods (`wrap`, `withCode`, `withMetadata`, `add`) return new instances. `metadata` is copied and frozen on construction, so neither the caller's original object nor a cast can write into it; the copy and freeze are shallow, so nested values stay the caller's.
  - **`Err.isErr` is nominal since v0.7.0**: `value instanceof Err`. A plain object carrying `kind: "Err"` or `isErr: true` is data, not an error.
  - `Err.from` still reconstructs wire data: an internal `hasErrMarker` check dispatches marker candidates to `Err.fromJSON` (calling the candidate's own `toJSON()` first when it has one, so a foreign instance keeps its stack). A candidate that fails validation falls back to the `UNKNOWN` branch and **never throws**, which keeps every catch boundary total. `Err.fromJSON` itself still throws on malformed input.
  - **`Err.from` is total.** Classifying a caught value touches it — `instanceof` walks a prototype chain, the marker and native branches read properties — and a hostile accessor or proxy trap can throw from any of those. The whole classification runs inside a `try`; an unclassifiable value lands in the `UNKNOWN` branch. Every catch boundary in the package converts with `Err.from`, so this is what makes those boundaries total. `Err.isErr` is deliberately left as the bare `value instanceof Err`: it is a predicate, not a conversion boundary.
- **`Outcome<T>`** — **Deprecated; frozen from v0.7.0 onward** (v0.7.0 is itself the release that changed it — the freeze is relative to its v0.7.0 shape, not a compatibility claim across v0.6.x). Monadic container wrapping `ResultTuple<T>`. Its source structure, method signatures, overloads and copy semantics must not change; only deprecation documentation is permitted. Two things reach it indirectly and are covered by regression rows in `outcome.test.ts`: the readonly `ResultTuple` (type-only), and nominal `Err` recognition (a marker object is now success data, `Outcome.err(marker)` normalizes through `Err.from`, and a thrown malformed marker becomes a failure instead of escaping). Its own contract:
  - **Value protocol** (`from`/`fromAsync`, `flatMap`, `mapErr`, `pipe`/`pipeAsync`) — a returned `Err` is the failure, a returned `Outcome` passes through by reference, and **anything else is the success value**, tuples included. Typed as `ValueOf<R>`.
  - **Tuple protocol** (`fromTuple`/`fromTupleAsync`) — the only entry points that read `[value, error]` as control flow. **Never overload a callback-taking signature** — more than one call signature strips the callback body's contextual type (bare tuple literals widen to arrays, multi-branch callbacks fail with TS2769); use one signature with a union parameter. The same rule produced `ensure`'s single signature in `flow`.
  - `map` stays total: `(T) => U`, its return is never inspected.
  - `toTuple()` is the **sole** extraction. `value`, `error`, `isOk` and `isErr` were removed in v0.7.0. Library internals use the private `_ok` getter.
  - A callback returning the pre-v0.7.0 `[value, error]` shape triggers a one-time `console.warn` (`Outcome._legacyTupleWarned`). The test asserting it must stay first in `outcome.test.ts`. The warning stays in `Outcome` — do not move it into `flow`.

### Documentation site (`site/`, `scripts/docs/`)

`site/` holds the Hugo + pinned Hextra website; `scripts/docs.sh.ts` is the one
CLI dispatcher behind every `docs:*` script. Nothing under `site/` ships in the
package. The full contributor and release runbook is
[`site/README.md`](site/README.md) — read it before changing the site build.

- Canonical Markdown lives in `docs/` and links **relatively**, so it reads on
  GitHub and inside the installed package. The build resolves every destination
  through a content manifest and writes edition-prefixed site paths into staged
  Markdown; `site/layouts/` overrides the theme's link hooks so those staged
  destinations are trusted verbatim.
- Editions are `/next/` (working tree, `noindex`), `/v/<version>/` (immutable
  snapshots), `/archived/` (pre-0.7.0 summaries), and `/` (latest stable, or an
  overview before the first release). Each is a separate Hugo build; they are
  merged into one artifact.
- `site/versions.yaml` records that a snapshot **exists**; `site/published.json`
  is the only evidence that a version is **published**. A snapshot missing from
  the receipt stays out of navigation and never becomes the default edition.
- The build strips each page's first H1: the theme renders the front-matter
  title, and leaving the H1 in shifts Goldmark's heading ids (`#err` → `#err-1`),
  breaking TypeDoc's cross-references.

### Utilities (`src/utils/`)

- **`formatDateTime`** -- Date formatting utility (stub, in progress)

### Code Style

- Biome for linting and formatting (replaces ESLint + Prettier)
- Tab indentation, 80 char line width, double quotes
- `biome.json` scoped to `src/**/*.ts` and `scripts/**/*.ts`; `lint:edit` and `lint:ci` pass both paths, so release tooling is linted with the library
- Strict TypeScript with `noUncheckedIndexedAccess`, `noImplicitOverride`

### Package Publishing

- Scoped as `@pencroff-lab/kore` on npm, with a `./test` export subpath
- CI via GitHub Actions (`oven/bun:1.3-slim` container)
- Pipeline: install -> lint -> boundaries -> docs -> test -> release state -> build (with consumer verification) -> publish (on push to main) -> git tag
- `bun run check:release` fails when `package.json#version` has no matching `CHANGELOG.md` heading
- Exact dependency versions (no `^` or `~`)
- `bun.lock` committed, `bun install --frozen-lockfile` in CI

## Documentation Rules

### Doc Budget (enforced in CI)

Tiered by file size (threshold: 100 non-blank lines). The first `@module` JSDoc block is excluded from the ratio.

| File type | Small (< 100 lines) | Normal (≥ 100 lines) |
|-----------|---------------------|----------------------|
| `*.types.ts` | ≤ 80% | ≤ 50% |
| Implementation `*.ts` | ≤ 50% | ≤ 35% |
| `*.test.ts` | 0% | 0% |

### What goes where

| Content | Location |
|---------|----------|
| `@param`, `@returns`, `@throws`, 1-line description | Inline JSDoc (Layer 1) |
| Class/module invariants (e.g., "immutable") | Once at class level, not per method |
| Usage examples, patterns, how-to | `*.examples.test.ts` files |
| Architecture, design rationale | CLAUDE.md / Layer 4 docs |

### Inline JSDoc rules

- **`@module` placement:** Always in the TypeDoc entry point file (the implementation file, e.g., `err.ts`, `flow.ts`, `test.ts`, `outcome.ts`). `typedoc.json` lists them explicitly — a new root export does not add itself to the generated docs. TypeDoc only renders `@module` from entry points — placing it in `*.types.ts` won't appear in generated docs.
- **No file-level JSDoc in `*.types.ts`:** TypeDoc doesn't render file-level comments from non-entry-point files — they only waste doc budget. Per-symbol JSDoc (on types, interfaces, properties) renders correctly via re-exports.
- `@module` block: summary + key concepts + `@see` reference. No `@example` in implementation files.
- No `@example` in implementation files — use `@see [file.examples.test.ts](../../src/.../file.examples.test.ts)`
- `{@link}` only for TypeScript symbols (classes, methods). Never for `.ts` file paths — TypeDoc copies them to `_media/` and breaks builds
- `@example` in `*.types.ts` only if non-obvious from signature, max 5 lines
- Never repeat invariants per method — state once at class/module level
- Delete examples that restate the type signature
- `@internal` and non-exported functions: one-line `//` comment only. Full JSDoc (`@param`/`@returns`) reserved for exported symbols.

### TypeDoc / generated docs rules

- No hardcoded GitHub commit URLs — `typedoc.json` uses `sourceLinkTemplate` with relative paths and `disableGit: true`
- `gen_docs` / `docs:generate` pipeline (`scripts/docs/generate.ts`): `typedoc` renders into a staging directory → `normalizeApiMarkdown` rewrites destinations → `docs/examples/*.md` is generated from every `src/**/*.examples.test.ts` → both directories are swapped in. `docs/api/` and `docs/examples/` are fully generator-owned: they are rebuilt wholesale, so a removed source entry cannot leave an obsolete file behind. Never hand-edit either directory.
- Destination rewriting is done with the Markdown AST (`scripts/docs/markdown.ts`), never with a global regex, so fenced code and code spans are untouched.
- `@see` example references become links to `docs/examples/<stem>.md`. "Defined in" citations become GitHub URLs pinned to the release tag derived from `package.json#version` (e.g. `https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/err.ts#L23`). `src/` does not ship in the package, so relative `../../src/...` links were broken for every consumer. `typedoc.json` still uses a relative `sourceLinkTemplate` with `disableGit: true`; the tag is applied by the generator, and no commit SHA is ever embedded.
- Because citations are tag-pinned, **finalize `package.json#version` before generating**; the links are otherwise pinned to the wrong tag.

### TypeScript patterns

- `flow`'s `fail()` returns `ResultTuple<never>` and chains without a generic claim, because the tuple is covariant in `T`. The class-tier `Outcome.err()` returns `Outcome<never>`, which is assignable everywhere but does not chain — claim the success type instead of casting: `Outcome.err<number>("msg").defaultTo(0)`.
- The rest overloads of `pipe`/`pipeAsync` widen their stages with `any`, not `unknown`: under `strictFunctionTypes` an `Op<number, string>` is not assignable to `Op<unknown, unknown>`, so an `unknown` fall-off overload would reject every typed stage.
- **A stage factory whose callback has no inference site must return a generic stage.** `onErr`/`onErrAsync` receive an `Err`, so an `In` type parameter on the *factory* collapses to `unknown` the moment the stage is stored in a variable — silently widening the whole pipeline. They return `<In>(tuple: ResultTuple<In>) => ResultTuple<In | Out>` (and its async form), written **inline at the factory**: the public operator type list is exactly `Op`, `OpAsync`, `AnyOp`, and a name is easier to add later than to withdraw. `onOk` and `onTuple` do not need this — their callbacks name the input. Typed-stage tests must store a stage in a variable; an inline call passes under the broken declaration too.
- **`AnyOp` is one call signature with a union return**, not `Op | OpAsync`. TypeScript cannot instantiate a generic stage against a union target, so the union form collapsed every `pipeAsync` recovery stage to `ResultTuple<unknown>`.
- `all` infers heterogeneous input through `OkValues<T>`, a mapped type over the alias `OkValue<R> = R extends readonly [infer V, null] ? V : never`. The conditional must live in its own alias so it distributes over the `ResultTuple` union; inlining it in the mapped type does not.
