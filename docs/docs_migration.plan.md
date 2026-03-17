# Documentation Migration Plan

## Context

Source files have a 35/65 code-to-docs ratio (target: ≥ 80/20 for implementation files).
The `docs/docs_guide.md` layer model is agreed upon but not yet executed.
This plan migrates Layer 3 content (examples, patterns) out of source into
`*.examples.test.ts` files and trims Layer 1 JSDoc to contracts only.

### Current state

| File | Lines | Doc ratio | @example blocks |
|------|-------|-----------|-----------------|
| `src/types/err.ts` | 1,763 | ~63% | 54 |
| `src/types/outcome.ts` | 1,497 | ~64% | 59 |
| `src/utils/logger.ts` | 583 | ~49% | 10 |
| `src/utils/format_dt.ts` | 143 | ~55% | 6 |

### Target state

| File | Estimated lines | Doc ratio | @example blocks |
|------|----------------|-----------|-----------------|
| `src/types/err.types.ts` | ~75 | ≤ 40% | 0 |
| `src/types/err.ts` | ~700 | ≤ 20% | 0 |
| `src/types/outcome.types.ts` | ~60 | ≤ 40% | 0 |
| `src/types/outcome.ts` | ~600 | ≤ 20% | 0 |
| `src/utils/logger.ts` | ~400 | ≤ 20% | 0 |
| `src/utils/format_dt.ts` | ~100 | ≤ 20% | 0 |

### Rules (agreed)

| Check | Severity | Rule |
|-------|----------|------|
| `@example` in implementation `*.ts` | **CI fail** | Zero — use `@see` to examples test |
| `@example` > 5 lines in `*.types.ts` | **CI fail** | Keep type examples minimal |
| Doc ratio > budget | **CI warn** | ≤ 20% impl, ≤ 40% types |
| Barrel files (`index.ts`) | **Exempt** | Skip |

Advanced examples live in `*.examples.test.ts` — no examples in markdown guides.
Markdown guides explain concepts; test files prove usage.

---

## Phase 1 — CI enforcement script

**Goal:** Create `scripts/check-docs.sh.ts` that enforces the rules above.

**File:** `scripts/check-docs.sh.ts`

**Logic:**
1. Glob all `src/**/*.ts`, exclude `*.test.ts` and `index.ts` barrel files
2. For each file, parse JSDoc blocks (`/** ... */`):
   - Count doc lines vs total non-blank lines → ratio
   - Detect `@example` blocks and count their lines
3. Apply rules:
   - `*.types.ts`: warn if ratio > 40%, fail if any `@example` > 5 lines
   - Other `*.ts`: fail if any `@example` exists, warn if ratio > 20%
4. Exit 0 (pass), exit 1 (fail), warnings printed to stderr

> Fail error details has to be descriptive, to let any agentic tool fix mistake (if skip rules)

**Add to `package.json`:**
```json
"check:docs": "bun scripts/check-docs.sh.ts"
```

**Add to CI** (`ci.yml`) as a step after lint, before tests:
```yaml
- name: Check docs
  run: bun run check:docs
```

**Add to lint script**

Add `check:docs` to curent `lint` script

**Files to modify:**
- `scripts/check-docs.sh.ts` (new)
- `package.json` (add script)
- `.github/workflows/ci.yml` (add step)

---

## Phase 2 — Extract types

**Goal:** Move exported types/interfaces to `*.types.ts` files.
Follow `docs/err.types.example.ts` as the template.

### 2a. `src/types/err.types.ts` (new)

Move from `err.ts`:
- `ErrCode` type
- `ErrOptions` interface
- `ErrJSON` interface
- `ErrJSONOptions` interface
- `ToStringOptions` interface

**JSDoc per type:** 1-3 lines + field-level `@default` tags. No `@example` blocks.
Group with separator comments (`// ─── Group: Creation ───`).
Add `@module err` tag (TypeDoc needs it on the main entry, not here — this file
is imported by `err.ts` and re-exported, so TypeDoc picks it up through `err.ts`).

### 2b. `src/types/outcome.types.ts` (new)

Move from `outcome.ts`:
- `NullErr` type
- `ResultTuple<T>` type
- `CallbackReturn<T>` type
- `PipeFn<In, Out>` type
- `PipeFnAsync<In, Out>` type

Same rules: lean JSDoc, no `@example`, separator comments.

### 2c. Update imports

- `err.ts`: `import type { ... } from "./err.types"` + re-export with `export type { ... } from "./err.types"`
- `outcome.ts`: same pattern
- `src/types/index.ts`: no change needed (barrel re-exports from `err` and `outcome`, types flow through)
- Verify tests still compile

**Files to create:**
- `src/types/err.types.ts`
- `src/types/outcome.types.ts`

**Files to modify:**
- `src/types/err.ts` (remove type defs, add import + re-export)
- `src/types/outcome.ts` (same)

---

## Phase 3 — Create examples test files

**Goal:** Move all `@example` content into executable test files.

### 3a. `src/types/err.examples.test.ts` (new)

Sections (each a `describe` block):
1. **Basic usage** — tuple pattern, creating errors with codes
2. **Error wrapping** — adding context as errors propagate
3. **Catching native errors** — `Err.wrap()` with `try/catch`
4. **Error aggregation** — `Err.aggregate()` + `.add()` + `.addAll()`
5. **JSON serialization** — `toJSON()` / `fromJSON()` round-trip
6. **Metadata** — `withMetadata()`, `findMetadata()`, `filterMetadata()`
7. **Error codes** — `withCode()`, `hasCode()` prefix matching

Source: 54 `@example` blocks from `err.ts` + module header examples.

### 3b. `src/types/outcome.examples.test.ts` (new)

Sections:
1. **Creating outcomes** — `Outcome.ok()`, `Outcome.err()`, `Outcome.unit()`
2. **Factory methods** — `Outcome.from()`, `Outcome.fromAsync()`
3. **Transformations** — `map()`, `mapErr()`, `pipe()`, `pipeAsync()`
4. **Terminal operations** — `toTuple()`, `defaultTo()`, `either()`
5. **Side effects** — `effect()`
6. **Combinators** — `Outcome.all()`, `Outcome.any()`
7. **Migration from throwing** — before/after patterns

Source: 59 `@example` blocks from `outcome.ts`.

### 3c. `src/utils/logger.examples.test.ts` (new)

Sections:
1. **Basic logging** — level usage, context objects
2. **Err integration** — logging Err instances
3. **Child loggers** — module context, correlation
4. **Custom transports** — DI for testing
5. **Level configuration** — `LOG_LEVEL` env var

Source: 10 `@example` blocks from `logger.ts` + module header.

### 3d. `src/utils/format_dt.examples.test.ts` (new)

Sections:
1. **Default formatting** — UTC datetime
2. **Options combinations** — readable, parts, ms, tz, delimiter

Source: 6 `@example` blocks from `format_dt.ts`.

**Files to create:**
- `src/types/err.examples.test.ts`
- `src/types/outcome.examples.test.ts`
- `src/utils/logger.examples.test.ts`
- `src/utils/format_dt.examples.test.ts`

---

## Phase 4 — Trim JSDoc in source files

**Goal:** Strip all `@example` blocks, reduce to Layer 1 contracts.

### Per-file pattern

**Module header** (before):
```typescript
/**
 * Error-as-value implementation for TypeScript applications.
 * ... 110 lines of examples and prose ...
 * @module err
 */
```

**Module header** (after):
```typescript
/**
 * Immutable, value-based error type with wrapping and aggregation.
 *
 * @see {@link err.examples.test.ts} for usage patterns
 * @module err
 */
```

**Method JSDoc** (before):
```typescript
/**
 * Wrap this error with additional context message.
 *
 * @example
 * ```typescript
 * const wrapped = err.wrap('Failed to load user');
 * // ... 10 lines ...
 * ```
 *
 * @param message - Context message
 * @returns New Err wrapping this error as cause
 */
```

**Method JSDoc** (after):
```typescript
/**
 * Wrap this error with additional context message.
 *
 * @param message - Context message
 * @returns New Err wrapping this error as cause
 */
```

### Specific trimming targets

**`err.ts`:**
- Delete module header examples (lines 18-107, ~90 lines)
- Delete all per-method `@example` blocks (~54 blocks)
- Keep: 1-line descriptions, `@param`, `@returns`, `@throws`
- Keep: class-level immutability contract (but trim to 2 lines)
- Add: `@see` links to `err.examples.test.ts`

**`outcome.ts`:**
- Delete module header examples (lines 7-43, ~37 lines)
- Delete all per-type and per-method `@example` blocks (~59 blocks)
- Keep: 1-line descriptions, `@param`, `@returns`, `@typeParam`
- Add: `@see` links to `outcome.examples.test.ts`

**`logger.ts`:**
- Delete module header examples and design philosophy (lines 8-57, ~50 lines)
- Delete per-method `@example` blocks (~10 blocks)
- Keep: interface JSDoc on call signatures (important for overload docs)
- Add: `@see` links to `logger.examples.test.ts` and `docs/logging_guide.md`

**`format_dt.ts`:**
- Delete function-level `@example` blocks (~6 blocks)
- Keep: option field `@default` tags, `@param`/`@returns`
- Add: `@see` link to `format_dt.examples.test.ts`

**Files to modify:**
- `src/types/err.ts`
- `src/types/outcome.ts`
- `src/utils/logger.ts`
- `src/utils/format_dt.ts`

---

## Phase 5 — Update CLAUDE.md

**Goal:** Add documentation rules so AI agents follow them.

Add a `## Documentation Rules` section to `CLAUDE.md`:

```markdown
## Documentation Rules

### Doc Budget (enforced in CI)

| File type | Max JSDoc ratio | Notes |
|-----------|----------------|-------|
| `*.types.ts` | ≤ 40% of non-blank lines | Types are the API contract |
| Implementation `*.ts` | ≤ 20% of non-blank lines | Logic self-evident from types |
| `*.test.ts` | 0% | Tests are documentation |

### What goes where

| Content | Location |
|---------|----------|
| `@param`, `@returns`, `@throws`, 1-line description | Inline JSDoc (Layer 1) |
| Class/module invariants (e.g., "immutable") | Once at class level, not per method |
| Usage examples, patterns, how-to | `*.examples.test.ts` files |
| Architecture, design rationale | CLAUDE.md / Layer 4 docs |

### Inline JSDoc rules

- Module header: ≤ 3 lines summary + `@see` links. No `@example` blocks
- No `@example` in implementation files — use `@see` to examples test
- `@example` in `*.types.ts` only if non-obvious from signature, max 5 lines
- Never repeat invariants per method — state once at class/module level
- Delete examples that restate the type signature
```

**Files to modify:**
- `CLAUDE.md`

---

## Phase 6 — Regenerate TypeDoc + verify

**Goal:** Confirm generated docs still render correctly after migration.

### TypeDoc config

`typedoc.json` entry points stay as implementation files (`err.ts`, `outcome.ts`, etc.).
Types are re-exported through them, so TypeDoc picks them up automatically.
No config changes needed.

### Verification steps

1. `bun test` — all existing tests pass
2. `bun run test:coverage` — coverage ≥ 83% (examples tests add coverage)
3. `bun run check:docs` — new CI script passes on migrated files
4. `bunx biome check --fix src/` — no lint issues
5. `bun run gen_docs` — TypeDoc generates without warnings
6. Review `docs/api/err.md` and `docs/api/outcome.md` — confirm:
   - Types still documented (from `*.types.ts` JSDoc)
   - Method signatures still have `@param`/`@returns`
   - No broken `@see` links
7. `bun run build` — ESM + CJS build succeeds

---

## Execution order

| Step | Phase | Depends on | Can parallelize |
|------|-------|------------|-----------------|
| 1 | Phase 1: CI script | — | — |
| 2 | Phase 2: Extract types | — | With step 1 |
| 3 | Phase 3: Examples tests | Phase 2 (imports) | — |
| 4 | Phase 4: Trim JSDoc | Phase 2 + 3 | — |
| 5 | Phase 5: CLAUDE.md | — | With any step |
| 6 | Phase 6: Verify | All above | — |

Phases 1, 2, and 5 are independent and can be done in parallel.
Phase 3 needs types extracted (for clean imports).
Phase 4 needs examples tests created (to verify nothing is lost).
Phase 6 is the final verification gate.
