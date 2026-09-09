# Changelog

## [0.7.0] - 2026-09-09

### Features

- Add the `flow` tier: free functions over `ResultTuple<T>` — `ok`, `fail`,
  `attempt`/`attemptAsync`, `copy`, `map`/`flatMap`/`mapErr`/`effect` and their
  async forms, `ensure`, the `onOk`/`onErr`/`onTuple` stage factories,
  `pipe`/`pipeAsync` typed through ten stages, `defaultTo`, `either`, `all`,
  `any`, and `fromJSON`. Exported from the package root.
- Add `expectOk` and `expectErr`, published from the new
  `@pencroff-lab/kore/test` subpath. They import no test framework and work in
  any runner.
- `Outcome` gains the value/tuple protocol split: `from`/`fromAsync`,
  `flatMap`, `mapErr` and `pipe` read a returned `Err` as failure and anything
  else as the success value, while `fromTuple`/`fromTupleAsync` are the only
  entry points that read `[value, error]` as control flow.
- Add `Outcome.flatMap`/`flatMapAsync`.

### Breaking changes

- **`ResultTuple<T>` is readonly** and now declared in
  `src/types/common.types.ts`; `src/types/outcome.types.ts` re-exports it. This
  is a type-only change — no runtime behavior differs — but code that writes
  into a result tuple stops compiling.
- **`Err.isErr` is nominal**: it is now `value instanceof Err`. A plain object
  carrying `kind: "Err"` or `isErr: true` is data, not an error. Reconstruct a
  real instance with `Err.from(value)`.
- Three `Outcome` behaviors follow from that guard, with no change to the class
  itself:
  - `Outcome.from(() => ({ kind: "Err", message: "m" }))` is now a success
    carrying the object, not a failure;
  - `Outcome.err(markerObject)` now normalizes through `Err.from` instead of
    storing the marker raw;
  - a callback returning `[null, markerObject]` no longer fires the one-time
    legacy tuple warning, because the second slot is not an `Err`.
- `flow`'s `defaultTo` is **handler-only** — `defaultTo(tuple, () => 0)`. The
  class-tier value form and its `asValue` flag are not reproduced; a
  function-valued fallback must be wrapped in a thunk.
- `Outcome.value`, `Outcome.error`, `Outcome.isOk` and `Outcome.isErr` are
  removed. `toTuple()` is the sole extraction, and destructuring narrows both
  branches.
- `Outcome.unit()` is removed; use `Outcome.ok()`.

### Bug Fixes

- A marker candidate that fails validation inside `Err.from` now falls back to
  the `UNKNOWN` branch instead of throwing, so a thrown marker object inside
  `Outcome.from`/`fromAsync` becomes a failure tuple rather than escaping the
  catch boundary.
- `Err.from` is now total. Classifying a caught value touches it — `instanceof`
  walks a prototype chain, and the marker and native-error branches read
  properties — so a value with a throwing accessor, or a proxy with a throwing
  trap, used to escape whichever boundary was converting it (`attempt`,
  `attemptAsync`, a pipeline stage, `Outcome.from`). Such a value now lands in
  the `UNKNOWN` branch with the value kept as `originalValue` metadata.
- `Err.add` / `Err.addAll` reconstruct a marker-shaped child through `Err.from`
  instead of storing it raw.

### Deprecations

- `Outcome` is deprecated. It stays exported, and its implementation, signatures
  and overloads are frozen **from v0.7.0 onward** — this release is where it
  changed. The freeze is relative to the v0.7.0 shape, not a compatibility claim
  across the v0.6.x boundary: the removals, protocol split, and nominal-guard
  consequences listed above all land in v0.7.0. The `flow` tier is the supported
  API; see the migration map in the README.

## [0.6.0] - 2026-09-01

### Features

- Reject invalid callback returns (2887ef2)
- Add flatMap, deprecate unit (5c7a4dc)
- Add metadata immutability support (811fc20)

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
