# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@pencroff-lab/kore` is a TypeScript core utilities library published to npm as a dual ESM/CJS package. It provides value-based error handling types (`Err`, `Outcome`) inspired by Go-style error handling.

## Commands

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Run all tests | `bun test` |
| Run tests with coverage | `bun run test:coverage` |
| Run a single test file | `bun test src/types/err.test.ts` |
| Run tests matching pattern | `bun test --test-name-pattern "pattern"` |
| Watch mode | `bun test --watch` |
| Lint & format (auto-fix) | `bunx biome check --fix src/` |
| Lint (CI, no writes) | `bunx biome ci src/` |
| Build (ESM + CJS) | `bun run build` |
| Publish | `bun run publish_pkg` |

## Testing

Use `bun run test:coverage` to run tests with coverage. Coverage must be >= 83%.

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
```

- `tsconfig.json` -- IDE/dev config (noEmit)
- `tsconfig.build.json` -- shared build settings (extends tsconfig.json)
- `tsconfig.esm.json` / `tsconfig.cjs.json` -- extend build config with output format

Build entry is `index.ts` at root which re-exports from `src/`. Tests, benchmarks, and specs are excluded from builds.

### Core Types (`src/types/`)

- **`Err`** -- Immutable, value-based error type. Supports wrapping (cause chains), aggregation (multiple errors), hierarchical error codes (`AUTH:TOKEN:EXPIRED`), JSON serialization/deserialization, and conversion to native `Error`. All mutating methods (`wrap`, `withCode`, `withMetadata`, `add`) return new instances.
- **`Outcome<T>`** -- Monadic container wrapping `ResultTuple<T>` (`[T, null] | [null, Err]`). Supports `map`/`mapErr`/`pipe`/`pipeAsync` chains, combinators (`all`, `any`), side effects (`effect`), and terminal operations (`toTuple`, `defaultTo`, `either`). Callbacks can return `[value, null]`, `[null, Err]`, `Err` directly, or `null` (void success).

### Utilities (`src/utils/`)

- **`formatDateTime`** -- Date formatting utility (stub, in progress)

### Code Style

- Biome for linting and formatting (replaces ESLint + Prettier)
- Tab indentation, 80 char line width, double quotes
- `biome.json` scoped to `src/**/*.ts`
- Strict TypeScript with `noUncheckedIndexedAccess`, `noImplicitOverride`

### Package Publishing

- Scoped as `@pencroff-lab/kore` on npm
- CI via GitHub Actions (`oven/bun:1.2-slim` container)
- Pipeline: install -> test -> publish (on push to main) -> git tag
- Exact dependency versions (no `^` or `~`)
- `bun.lock` committed, `bun install --frozen-lockfile` in CI
