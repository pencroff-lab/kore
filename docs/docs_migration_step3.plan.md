# Docs Migration Step 3 — Sync, Trim, and Layer 3

## Problem

After steps 1-2 the documentation rules evolved but supporting docs drifted:
- `docs_guide.md` still shows flat budgets (40%/20%), no tiered thresholds, no `@module` exclusion
- `docs_migration_step2.plan.md` has a "types-first" `@module` rule that contradicts reality (implementation-first)
- `logger.ts` (39%) and `format_dt.ts` (38%) still exceed the 35% budget
- Internal helpers carry full JSDoc despite being invisible in TypeDoc
- `llms.txt` was recommended in `docs_guide.md` but never created
- Layer 3 (guides) exists in theory but has no content
- `docs/err.types.example.ts` is redundant with the real `src/types/err.types.ts`

## Steps

### Step 1: Sync `docs_guide.md` with current rules

Update `docs_guide.md` to match CLAUDE.md as the source of truth.

**Changes:**
- Replace flat budget table (line 154-158) with tiered budget table matching CLAUDE.md
- Add `@module` exclusion from ratio
- Add "no file-level JSDoc in `*.types.ts`" rule
- Add `@module` placement rule: always in implementation file (TypeDoc entry point), never in `*.types.ts`
- Note that Layer 3 = `*.examples.test.ts` for small libraries; separate `docs/guides/` when the library grows
- Remove reference to `err.types.example.ts` (line 126), point to real `src/types/err.types.ts` instead
- Remove `llms.txt` mention from "AI Agent Context" section (line 109-111) — replaced by step 6

**Files to modify:**
- `docs/docs_guide.md`

---

### Step 2: Fix `docs_migration_step2.plan.md` — correct `@module` placement

Step 2's "types-first rule" (lines 26-35) was invalidated: TypeDoc only renders `@module` from
entry points. The implementation followed CLAUDE.md (implementation-first), not the plan.

**Changes:**
- Replace "types-first rule" in Step 2 with: `@module` always in the implementation file (TypeDoc entry point)
- Update the placement table to show `err.ts`, `outcome.ts`, `format_dt.ts`, `logger.ts`
- Add a note: "Corrected in step 3 — TypeDoc ignores `@module` in non-entry-point files"

**Files to modify:**
- `docs/docs_migration_step2.plan.md`

---

### Step 3: Add internal JSDoc rule to CLAUDE.md

Internal helpers (`@internal` or non-exported) don't appear in TypeDoc output. Full JSDoc on them
wastes doc budget without benefit.

**Add to CLAUDE.md `### Inline JSDoc rules`:**
- `@internal` and non-exported functions: one-line `//` comment only. Full JSDoc (`@param`/`@returns`) reserved for exported symbols.

**Files to modify:**
- `CLAUDE.md`

---

### Step 4: Trim `logger.ts` JSDoc — apply internal helper rule

**Current:** 39% (171/437 non-blank lines). **Target:** ≤ 30%.

Trim internal helpers to one-line `//` comments. Remove redundancy in exported symbols.

| Block | Current | Action | Savings |
|-------|---------|--------|---------|
| `formatTimestamp()` inner | 15 lines | Replace with 1-line `//` comment (internal closure) | ~14 |
| `getLogLevel()` | 12 lines | Condense to 1-line `//` comment (`@internal`) | ~11 |
| `lvl` constant | 11 lines | Remove per-level descriptions; keep summary line | ~6 |
| `Logger` interface | 13 lines | Remove "Call Signatures" section (duplicates TS signatures) | ~6 |
| `resolveCall()` | 11 lines | Remove enumerated variants; keep summary (`@internal`) | ~3 |
| `normalizeContext()` | 10 lines | Condense to 1-line description (`@internal`) | ~3 |
| `prettyTransport()` | 14 lines | Remove format layout example; keep Err rendering note | ~3 |

**Projected:** ~125/437 = ~28%

**Files to modify:**
- `src/utils/logger.ts`

---

### Step 5: Trim `format_dt.ts` JSDoc — condense interface properties

**Current:** 38% (41/108 non-blank lines). **Target:** ≤ 35%.

`DtStampOptions` interface properties over-document what the type signature already shows.

| Property | Action | Savings |
|----------|--------|---------|
| `tz` | Remove enum value explanations (`"utc"` -- use UTC methods...) — type `"utc" \| "local"` is self-describing | ~2 |
| `readable` | Remove format examples (`YYYY-MM-DD`, `HH:MM:SS`) — defer to examples test | ~2 |
| `@param date` on `dtStamp` | Condense 2-line explanation to 1 line | ~1 |

**Projected:** ~36/108 = ~33%

**Files to modify:**
- `src/utils/format_dt.ts`

---

### Step 6: Create `llms.txt` in project root

Convention file for AI agents to find project context (similar to `robots.txt`).

**Content structure:**
- Project name, description, npm package
- Pointer to `CLAUDE.md` for full rules and architecture
- Core modules: `Err` (error values), `Outcome<T>` (result container)
- Key entry points: `src/types/err.ts`, `src/types/outcome.ts`
- Example files: `*.examples.test.ts`
- Testing: `bun test`, Sinon for mocking, `bun:test` for assertions

> Validate format against the `llms.txt` convention before finalizing.

**Files to create:**
- `llms.txt`

---

### Step 7: Delete `docs/err.types.example.ts`

Redundant now that `src/types/err.types.ts` exists as the real implementation.
Reference in `docs_guide.md` updated in step 1.

**Files to delete:**
- `docs/err.types.example.ts`

---

### Step 8: Create Layer 3 guide stubs in `docs/guides/`

Two guides for content that doesn't fit example tests (narrative, composition, migration paths).

**Source material:** Use generated API docs (`docs/api/`) and `*.examples.test.ts` files as reference
when writing guide content. API docs are also available at https://github.com/pencroff-lab/kore/tree/main/docs/api.

**`docs/guides/error-handling-patterns.md`:**
- How `Err` and `Outcome` compose in practice
- Propagation through call stacks (wrap at each layer)
- When to use `Err` directly vs `Outcome`
- Real-world scenarios: API handler, file processing pipeline
- Cross-reference `docs/api/` for method signatures and type details
- `@see` links to `err.examples.test.ts` and `outcome.examples.test.ts`

**`docs/guides/migration-from-throwing.md`:**
- Step-by-step: `try/catch` → `Outcome`
- Common refactoring patterns (wrapping existing throwing code)
- What changes in calling code
- Gotchas and edge cases
- Reference `docs/api/` for `Outcome.from()`, `Outcome.fromAsync()`, `Err.wrap()` signatures

**Files to create:**
- `docs/guides/error-handling-patterns.md`
- `docs/guides/migration-from-throwing.md`

---

### Step 9: Verify

1. `bun run check:docs` — zero errors, zero warnings
2. `bun test` — all tests pass
3. `bun run test:coverage` — coverage ≥ 83%
4. `bunx biome check --fix src/` — no lint issues
5. `bun run gen_docs` — TypeDoc generates without warnings
6. Review generated `docs/api/` — types and methods still documented

---

## Execution order

| Step | Depends on | Can parallelize |
|------|------------|-----------------|
| 1. Sync docs_guide.md | — | With 2, 3, 6, 7 |
| 2. Fix step2 plan | — | With 1, 3, 6, 7 |
| 3. CLAUDE.md internal rule | — | With 1, 2, 6, 7 |
| 4. Trim logger.ts | Step 3 (rule defined) | With 5 |
| 5. Trim format_dt.ts | Step 3 (rule defined) | With 4 |
| 6. Create llms.txt | — | With 1, 2, 3, 7 |
| 7. Delete example file | — | With 1, 2, 3, 6 |
| 8. Create guide stubs | — | With any |
| 9. Verify | All above | — |
