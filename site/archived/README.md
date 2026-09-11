# Archived releases

Brief overviews of every `@pencroff-lab/kore` release published before v0.7.0,
newest first. Each entry links to that release's own documentation at its Git
tag, which is the authoritative record of how the library behaved then.

These summaries are historical context, not an API reference. They describe the
contract of the release they name; none of it describes current code. Full
documentation snapshots begin at v0.7.0 and live under `/v/<version>/`.

The archive stops at v0.6.0 and does not grow. Dates are the release dates
recorded in `CHANGELOG.md`, each confirmed against its Git tag; they are not
independently verified npm publication timestamps.

## v0.6.0 — 2026-09-01

Added `Outcome.flatMap`, deprecated `Outcome.unit`, and tightened validation of
callback return values so an invalid return failed rather than passing through.
Added metadata immutability support to `Err`.

Migration note: code relying on `unit` should move to the replacement it was
deprecated in favour of, and callbacks that previously returned an unsupported
shape now surface an error instead of being silently accepted.

[Documentation at v0.6.0](https://github.com/pencroff-lab/kore/tree/v0.6.0/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.6.0/README.md)

## v0.5.0 — 2026-05-11

Expanded error-code checking to walk the whole error tree, so `hasCode()` could
find a code carried by a wrapped cause or an aggregated error rather than only
the top-level `Err`. Made the code argument optional, letting `hasCode()` ask
whether any code is present at all.

[Documentation at v0.5.0](https://github.com/pencroff-lab/kore/tree/v0.5.0/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.5.0/README.md)

## v0.4.0 — 2026-04-02

Simplified error wrapping and aggregation around `Err.from` and `addAll`,
replacing the earlier separate static wrap/aggregate entry points. Native
`Error` values converted through `Err.from` now carry their `.code` across.
Refreshed the error-handling documentation for the smaller API.

Migration note: `Err.aggregate` was replaced by `Err.from`.

[Documentation at v0.4.0](https://github.com/pencroff-lab/kore/tree/v0.4.0/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.4.0/README.md)

## v0.3.1 — 2026-03-19

Documentation-only release. Renamed and reorganized the guide files and
corrected the links that pointed at their previous names.

[Documentation at v0.3.1](https://github.com/pencroff-lab/kore/tree/v0.3.1/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.3.1/README.md)

## v0.3.0 — 2026-03-17

Added metadata find/filter coverage for `Err` and taught `dtStamp` to accept a
Unix timestamp as well as a `Date`. Introduced `git-cliff` changelog tooling and
carried out the documentation migration that established executable
`*.examples.test.ts` files, the TypeDoc `@see` convention, and the CI documentation
budget check still used today.

[Documentation at v0.3.0](https://github.com/pencroff-lab/kore/tree/v0.3.0/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.3.0/README.md)

## v0.2.1 — 2026-02-27

Added the generated TypeDoc Markdown API reference and the JSDoc/TypeDoc
conventions that produce it, expanded source comments for the logger and
`Outcome` internals, and refreshed the README links.

[Documentation at v0.2.1](https://github.com/pencroff-lab/kore/tree/v0.2.1/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.2.1/README.md)

## v0.2.0 — 2026-02-21

Added the zero-dependency logger export, with expanded tests, API documentation,
and a logging guide covering patterns, conventions, and `Err` integration.

[Documentation at v0.2.0](https://github.com/pencroff-lab/kore/tree/v0.2.0/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.2.0/README.md)

## v0.1.2 — 2026-02-19

First published release. Established the TypeScript package with its dual
ESM/CJS build, CI, and build-verification scripts, the initial `Err` and
`Outcome` implementations with tests, and the `dtStamp` timestamp utility.
Added the first README, `llms.txt`, and development guidance.

v0.1.2 is the earliest release recorded by a Git tag. No v0.1.0 or v0.1.1
release is claimed here, because none is verified.

[Documentation at v0.1.2](https://github.com/pencroff-lab/kore/tree/v0.1.2/docs)
· [README](https://github.com/pencroff-lab/kore/blob/v0.1.2/README.md)
