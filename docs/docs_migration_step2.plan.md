# Docs Migration Step 2 — Budget Rebalance & Module Descriptions

## Problem

Current JSDoc budgets (20% impl, 40% types) produce persistent warnings because:
- Rich APIs with many methods exceed 20% even with minimal per-method docs
- Small type files (< 100 lines) get skewed ratios
- Module-level narrative (overview, examples) competes with per-method docs for budget

## Steps

### Step 1: Update `check-docs.sh.ts` — tiered budgets + module exclusion

**Module exclusion:**
- Detect the first JSDoc block containing `@module` tag
- Subtract its line count from `docLines` before computing ratio

**Tiered budgets by file size** (threshold: 100 non-blank lines):

| File type | Small (< 100 lines) | Normal (>= 100 lines) |
|-----------|---------------------|------------------------|
| `*.types.ts` | 80% | 50% |
| Implementation `*.ts` | 50% | 35% |

### Step 2: Expand `@module` JSDoc — implementation-first rule

> **Corrected in step 3** — TypeDoc ignores `@module` in non-entry-point files.
> The types-first rule originally proposed here was invalidated: TypeDoc only renders
> `@module` from entry points (implementation files). `@module` in `*.types.ts` won't
> appear in generated docs.

Place the `@module` description in the implementation file (TypeDoc entry point), never
in `*.types.ts`.

| Module | `@module` location | Reason |
|--------|--------------------|--------|
| err | `err.ts` | TypeDoc entry point |
| outcome | `outcome.ts` | TypeDoc entry point |
| format_dt | `format_dt.ts` | TypeDoc entry point |
| logger | `logger.ts` | TypeDoc entry point |

### Step 3: Write module description content

Each `@module` block should contain (~15-25 lines):
- 1-3 line summary (what it is, why it exists)
- Key concepts paragraph (immutability, patterns, etc.)
- 1-2 short inline examples
- `@see` reference to `*.examples.test.ts`

### Step 4: Regenerate docs and verify

- `bun run gen_docs` — confirm TypeDoc renders module narrative in `docs/api/*.md`
- `bun run check:docs` — confirm zero warnings

### Step 5: Update CLAUDE.md

- Replace flat budget table with tiered budget table
- Document `@module` block exclusion from ratio
- Add types-first rule for `@module` placement
