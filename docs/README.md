# Kore documentation

Documentation for `@pencroff-lab/kore`, a TypeScript core utilities library
providing value-based error handling: the immutable `Err` type and `flow`, a
tier of free functions over `ResultTuple<T>`.

Everything linked from this page ships inside the npm package. If you are
reading this from `node_modules/@pencroff-lab/kore/docs/`, you are reading the
documentation for the exact version you have installed — prefer it over the
website when the two disagree.

## Start here

```typescript
import { Err, ok, fail, pipe, onOk, onErr, defaultTo } from "@pencroff-lab/kore";
import { expectOk, expectErr } from "@pencroff-lab/kore/test";
```

The package has two entry points: the root export carries the library, and
`@pencroff-lab/kore/test` carries the assertion helpers so they never reach
production bundles.

A `ResultTuple<T>` is `readonly [T, null] | readonly [null, Err]`. The error
slot is the only failure signal — no operation inspects a value's runtime
shape. Every fallible callback returns a `ResultTuple`; `map` is the single
exception, and its return is always data.

## API reference

Generated from the source comments; regenerated on every release.

- [Overview](api/README.md) — every exported symbol
- [flow](api/flow.md) — the primary API: free functions over `ResultTuple<T>`
- [Err](api/err.md) — immutable error type with wrapping, aggregation, codes,
  and JSON serialization
- [test helpers](api/test.md) — `expectOk` / `expectErr`, from the `/test`
  subpath
- [Outcome](api/outcome.md) — **deprecated and frozen since v0.7.0**
- [Logger](api/logger.md) — structured, level-filtered logging
- [dtStamp](api/format_dt.md) — compact, sortable date/time stamps

## Guides

- [Flow operation flows](guides/flow-operation-flows.md) — creating results,
  exception boundaries, transformations, pipelines, combinators, terminal
  operations, serialization, input protection
- [Error handling patterns](guides/error-handling-patterns.md) — `Err`
  composition, propagation, and the nominal type guard
- [Migration from throwing](guides/migration-from-throwing.md) — step-by-step
  conversion from `try`/`catch` to result tuples
- [Logging guide](guides/logging_guide.md) — levels, transports, conventions

## Examples

Every example page is generated from an executable test file, so the code runs
in the library's own test suite.

- [All examples](examples/README.md)
- [flow examples](examples/flow.md)
- [Err examples](examples/err.md)
- [test helper examples](examples/test.md)
- [Outcome examples](examples/outcome.md)
- [Logger examples](examples/logger.md)
- [dtStamp examples](examples/format_dt.md)

## Contributor documentation

These describe how the library itself is written; they are not needed to use
the package.

- [Documentation guide](guides/docs_guide.md) — the documentation layer model
  and budget rules
- [TSDoc formatting rules](guides/tsdoc_guide.md)
- [Commit convention](commit_convention.md)
- [Worktree guide](guides/worktree_guide.md)

## For agents

[`llms.txt`](../llms.txt) at the package root is the machine-readable index of
this documentation set. It links only to files that ship in the package.
