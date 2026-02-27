# Documentation Guide

General approach for maintaining sustainable documentation in large codebases.

## Documentation Layers Model

Every piece of documentation has a **change velocity** — how often it changes relative
to the code. The rule:

> **Place documentation as far from the source as its change velocity allows.**

```
High velocity (changes with code)
  │
  ▼  Layer 1: Inline JSDoc
       - param/return types, 1-line description
       - contracts & invariants (immutability, thread safety)
       - @see links to lower layers

  ▼  Layer 2: Generated API reference (TypeDoc/TSDoc/Swagger)
       - auto-derived from Layer 1
       - no manual maintenance

  ▼  Layer 3: Usage guides / examples
       - patterns, integration, how-to
       - changes when mental model changes, not on every refactor

  ▼  Layer 4: Architecture / context (CLAUDE.md, ADRs, llms.txt)
       - decisions, rationale, high-level design
       - rarely changes
  │
  ▼
Low velocity
```

### Layer 1: Inline JSDoc — Rules for Agents

Agents read types and structured tags directly — they do not need prose or examples to
infer intent. To make Layer 1 maximally useful for agents:

**Include:**
- Standard tags consistently: `@param`, `@returns`, `@throws` — agents extract these
  as structured data, not as prose
- Contracts and invariants: "returns a new instance", "never mutates", "throws if null"
  — these constrain how an agent reasons about safe usage
- Non-obvious decisions: a one-line `@description` explaining *why* a choice was made
  when the signature alone doesn't reveal it
- `@deprecated` with replacement — agents use this to avoid suggesting outdated patterns
- `@see` links to guides and architecture docs — agents follow these to gather deeper
  context when needed

**Omit:**
- Narrative examples explaining basic usage — the type signature already conveys this
- Conceptual introductions ("this follows the Go pattern") — belongs in Layer 4
- Repeated invariants — state an invariant once at the class level, not on every method

**Why this matters for agents:** An agent processing 50 files will skip long prose blocks
but will reliably parse `@param`, `@returns`, and `@throws`. Structured tags give agents
the same contract guarantees that TypeScript types provide — concise, unambiguous,
machine-readable.

## The 1:3 Ratio Problem

When source code is 1/3 logic and 2/3 docs, content from layers 3 and 4 has leaked
into layer 1. Common offenders:

| Leaked content | Belongs in |
|---|---|
| Multi-step usage examples | Layer 3 guide |
| Before/after migration examples | Layer 3 guide |
| Conceptual explanations ("this is Go-style") | Layer 4 |
| Examples that restate the type signature | Nowhere — delete |
| Architectural invariants (immutability contract) | Layer 1 once, at class level — not repeated per method |

## Layer 1 Budget (inline JSDoc)

A practical budget per construct:

| Construct | Max prose | Example |
|---|---|---|
| Module | 2–3 sentences + 1 minimal `@example` | Primary use case only |
| Class/interface | Invariants only, no examples | "All instances are immutable" |
| Public method | 1 sentence + `@param`/`@returns` | `@example` only if behavior is non-obvious from signature |
| Type alias | 1 sentence, discriminant semantics if union | No example unless ambiguous |

If an example is needed to understand a method, that is a signal the API is not
self-describing — fix the API first.

## Examples Belong in Tests

The most durable solution for large codebases: **examples live in tests, not comments**.

- Tests are executed — they cannot go stale silently
- Tests cover edge cases that comments never would
- Link from JSDoc: `@see` referencing the test file

Put representative examples in a dedicated `*.examples.test.ts` file that serves dual
purpose: test coverage and living documentation.

## AI Agent Context Is a Separate Concern

Agents do not need examples to understand intent — they read types and contracts.
What agents need:

- **Architecture decisions** → `CLAUDE.md` / `llms.txt`
- **Type contracts** → inline JSDoc (Layer 1)
- **Patterns** → concise guide (Layer 3)

The `llms.txt` convention (similar to `robots.txt`) is the right format for AI context
at the project root. It points agents at the right entry points rather than forcing
them to read all source.

## Preventing Source Size Explosion

### Separate types from implementation

The single most effective structural change: put all exported types and interfaces in a
dedicated `*.types.ts` file with their full JSDoc. The implementation file imports from
it and carries minimal inline comments — the consumer already has the annotated type.

```
src/types/err.types.ts   ← full JSDoc on ErrCode, ErrOptions, ErrJSON, ToStringOptions
src/types/err.ts         ← imports types, implements Err class, minimal inline comments
```

`err.types.example.ts` in this folder shows the target structure. Key observations from
that example:

- Each group is delimited by a named separator comment — scannable at a glance
- JSDoc per type is 1–3 lines of prose + field-level `@default` tags where relevant
- No `@example` blocks — types are self-describing; examples belong in tests
- `@see` links point to the method that gives the type its behavior contract

### Group exports by concern, not by file size

When a file grows, the reflex is to split it by line count. Instead, split by **concern**
— a cohesive set of types that change together for the same reasons.

In `err.types.example.ts` the three groups are:

| Group | Contents | Reason to change |
|---|---|---|
| Creation | `ErrCode`, `ErrOptions` | Error construction contract changes |
| Serialization | `ErrJSON`, `ErrJSONOptions` | Wire format / transport contract changes |
| Formatting | `ToStringOptions` | Human-readable output contract changes |

These groups could become separate files if they grow independently. They should never
be split just because the file hits an arbitrary line count.

### Concrete ratio target

A measurable signal to catch drift during code review:

| File type | JSDoc budget |
|---|---|
| `*.types.ts` | ≤ 40% of lines — types are the API contract, they need annotation |
| Implementation (`*.ts`) | ≤ 20% of lines — logic should be self-evident from types |
| Test files | 0% — tests are documentation; prose comments are noise |

**How to measure** (approximate, good enough for review):

```bash
# Lines starting with * or /** or */ relative to total non-blank lines
awk 'NF' file.ts | awk '/^[[:space:]]*(\*|\/\*\*)/{d++} !/^[[:space:]]*(\*|\/\*\*)/{c++} END{printf "doc: %d%\n", d*100/(d+c)}' file.ts
```

When a file exceeds its budget, the fix is to move content down a layer — not to
compress wording. Shorter prose in the same quantity does not solve the problem.

## Migration Strategy for Existing Codebases

1. **Audit** — flag every `@example` block > 5 lines; those are guide content
2. **Extract** — move examples into `docs/guides/` with `@see` back-references
3. **Delete** — remove examples that just restate the type signature
4. **Promote** — hoist class-level invariants up from per-method repetitions
5. **Test-ify** — convert the best examples into `*.examples.test.ts` files

## Summary

| Question | Layer |
|---|---|
| What does this function contract to do? | Layer 1 inline |
| Why was this non-obvious choice made? | Layer 1 inline |
| How do I use this in my project? | Layer 3 guide |
| Does it actually work? | Tests |
| Why is the system designed this way? | Layer 4 architecture |
