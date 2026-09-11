# @pencroff-lab/kore

TypeScript core utilities library providing value-based error handling types inspired by Go-style error handling. Published as a dual ESM/CJS package.

Since v0.7.0 the primary API is **`flow`** — free functions over a plain
`ResultTuple<T>` (`[value, null]` or `[null, Err]`). The `Outcome<T>` class is
deprecated and frozen from v0.7.0 onward; v0.7.0 itself changed it, so see the
[changelog](CHANGELOG.md) when upgrading and
[Migrating from `Outcome`](#migrating-from-outcome) when moving off it.

## Install

```bash
npm install @pencroff-lab/kore
# or
bun add @pencroff-lab/kore
```

Requires TypeScript 5.9+ as a peer dependency.

## Documentation

The package ships its own documentation. After installing, start at
[`docs/README.md`](docs/README.md); agents should read
[`llms.txt`](llms.txt), the machine-readable index of the same set. Both
resolve inside the installed package, so they always describe the version you
have.

Detailed API documentation for each module:

- [Err](docs/api/err.md) -- Immutable, value-based error type with wrapping, aggregation, and serialization
- [flow](docs/api/flow.md) -- Free functions over result tuples: the primary API
- [test helpers](docs/api/test.md) -- `expectOk` / `expectErr`, from `@pencroff-lab/kore/test`
- [Outcome\<T\>](docs/api/outcome.md) -- **Deprecated** monadic container, frozen in v0.7.0
- [dtStamp](docs/api/format_dt.md) -- Filesystem/log-safe date formatting utility
- [Logger](docs/api/logger.md) -- Structured logging with transport DI and Err integration

### Guides

- [Flow operation flows](docs/guides/flow-operation-flows.md) -- how `flow` composes operations, end to end
- [Error handling guide](docs/guides/error-handling-patterns.md) -- `Err` practical examples
  - [Migration from throwing](docs/guides/migration-from-throwing.md)
- [Logging guide](docs/guides/logging_guide.md) -- Patterns, conventions, and integration strategies
- [TS docstrings general guide](docs/guides/docs_guide.md)
  - [TS Docs formating rules](docs/guides/tsdoc_guide.md)

### Examples

Generated from executable tests: [all examples](docs/examples/README.md).

## API

### Err

Immutable, value-based error type. Supports wrapping (cause chains), aggregation (multiple errors), hierarchical error codes, JSON serialization, and conversion to native `Error`.

```typescript
import { Err } from "@pencroff-lab/kore";

// Create an error with a code
const err = Err.from("User not found", "NOT_FOUND");

// Wrap with context (returns a new instance)
const wrapped = err.wrap("Failed to load profile");

// Aggregate multiple errors
let errors = Err.from("Validation failed");
errors = errors.add("Name is required");
errors = errors.add(Err.from("Invalid email", "INVALID_EMAIL"));

if (errors.isAggregate) {
  console.log(errors.toString());
}
```

#### Creating errors

```typescript
// From string with code
Err.from("Timeout", "TIMEOUT");

// From string with options
Err.from("Connection failed", {
  code: "DB_ERROR",
  metadata: { host: "localhost" },
});

// From native Error (preserves stack and cause chain)
try {
  riskyOperation();
} catch (e) {
  Err.from(e as Error, { code: "OPERATION_FAILED" });
}

// Wrap native errors with context
try {
  await db.query(sql);
} catch (e) {
  Err.from(e as Error).wrap("Database query failed");
}
```

#### Error inspection

```typescript
const err = Err.from("DB error", "DB:CONNECTION:TIMEOUT")
  .wrap("Repository failed")
  .wrap("Service unavailable");

err.hasCode("DB:CONNECTION:TIMEOUT"); // true - exact match in chain
err.hasCodePrefix("DB"); // true - hierarchical prefix match
err.root.message; // "DB error" - original error
err.chain(); // array from root to current
err.find((e) => e.code === "DB:CONNECTION:TIMEOUT"); // find in tree
```

#### Serialization

```typescript
// Serialize for API responses
const json = err.toJSON({ stack: false }); // omit stack for public APIs

// Deserialize
const restored = Err.fromJSON(json);

// Convert to native Error
throw err.toError();
```

### flow

Free functions over `ResultTuple<T>` — `readonly [T, null]` on success,
`readonly [null, Err]` on failure. There is no container to construct or unwrap:
a result destructures at any point.

```typescript
import { ok, fail, pipe, onOk, onErr, defaultTo, type ResultTuple } from "@pencroff-lab/kore";

const parsePort = (raw: string): ResultTuple<number> => {
  const port = Number(raw);
  return Number.isInteger(port) ? ok(port) : fail(`invalid port: ${raw}`, "PORT");
};

const [port, err] = parsePort("8080");
if (err) return err;
```

#### The callback protocol

Every fallible callback returns a `ResultTuple`. The error slot is the only
failure signal — no operator inspects a value's runtime shape:

```typescript
flatMap(ok(2), (n) => ok(n * 2));        // success
flatMap(ok(2), () => fail("nope"));       // failure
flatMap(ok(1), readConfig);               // a tuple-returning callee composes directly
```

`ok(...)` is the one way to carry error- or tuple-shaped data as a success:

```typescript
ok(Err.from("this is data"));   // ResultTuple<Err>
ok(ok(1));                      // ResultTuple<ResultTuple<number>> — nesting is explicit
```

`map` is the single exception: its return is never inspected, so an `Err` or a
tuple returned from `map` is data. A callback that returns a bare value, a bare
`Err`, or nothing at all does not compile.

#### Boundaries and transformations

```typescript
ok(42);                       // [42, null]
ok();                         // [undefined, null] — ResultTuple<void>
fail("Not found", "NOT_FOUND");
fail(Err.from(caught, { code: "READ_FAILED", metadata: { path } }));

attempt(() => ok(JSON.parse(raw)));            // converts a throw to a failure
await attemptAsync(async () => ok(await fetchUser(id)));

map(result, (n) => n * 2);                     // total callback, return-preserving
flatMap(result, readConfig);                   // fallible callback
mapErr(result, (e) => fail(e.wrap("Failed to load project").withCode("LOAD")));
effect(result, ([v, e]) => log(v ?? e));       // side effect on either channel
ensure(result, isPositive, (n) => Err.from(`not positive: ${n}`, "RANGE"));
```

Error enrichment has no `flow` helpers of its own — chain the `Err` methods
inside `mapErr` / `onErr`.

#### Pipelines

```typescript
const loaded = pipe(
  ok(raw),
  onOk(parse),
  onOk(validate),
  onErr((e) => fail(e.wrap("Failed to load config", { code: "CONFIG" }))),
);

const fetched = await pipeAsync(
  Promise.resolve(ok(userId)),          // a promised source needs no extra await
  onOkAsync(fetchUser),
  onOk(normalize),
  onErr((e) => ok(anonymousUser(e))),   // recovery after a failed or throwing stage
);
```

`pipe` and `pipeAsync` copy the source once on entry and catch each stage
separately, so a later `onErr` stage can recover from a throwing custom stage.
Both are typed through ten stages; past that the result widens to
`ResultTuple<unknown>`. A reusable pipeline is an ordinary typed function:

```typescript
const transform = (source: ResultTuple<Input>) =>
  pipe(source, onOk(step1), onOk(step2), onErr(recover));
```

#### Terminal operations, collections, serialization

```typescript
defaultTo(result, () => 0);              // handler-only — a constant fallback is a thunk
defaultTo(result, (e) => recover(e));
either(result, (v) => render(v), (e) => renderError(e));

all([readA(), readB()]);                 // ordered, non-short-circuiting, aggregates every error
all([ok(1), ok("two")] as const);        // heterogeneous: ResultTuple<[number, string]>
any([primary(), replica()]);             // first success by reference; any([]) is EMPTY_INPUT

JSON.stringify(ok({ id: 1 }));           // [{"id":1},null] — no wrapper needed
fromJSON(payload);                       // validates the envelope; never throws
```

`fromJSON` validates only the tuple envelope and the error slot — `T` is a
caller assertion. An invalid payload returns an `INVALID_JSON` failure carrying
the payload as `originalValue` metadata.

#### Input protection

`flow` protects the tuple container, not the payload. A pipeline copies its
source once on entry, `effect` hands its callback the output copy, and
`onTuple` hands it an input copy — so callback code cannot mutate the tuple you
passed in. Success values, `Err` instances, and metadata are never cloned. Use
the exported `copy` when a custom operator needs an isolated tuple.

#### Test helpers

`expectOk` and `expectErr` ship from a separate subpath, so they never reach
production code. They import no test framework:

```typescript
import { expectOk, expectErr } from "@pencroff-lab/kore/test";

const port = expectOk(parsePort("8080"));
const error = expectErr(parsePort("nope"));
```

### Outcome\<T\>

> **Deprecated since v0.7.0.** The class stays exported and its shape is frozen
> from v0.7.0 onward — but v0.7.0 is itself a breaking release for it. Upgrading
> from v0.6.x, see the changelog; writing new code, see
> [Migrating from `Outcome`](#migrating-from-outcome).

Monadic container wrapping `ResultTuple<T>` (`[T, null] | [null, Err]`). Supports `map`/`flatMap`/`mapErr`/`pipe`/`pipeAsync` chains, combinators (`all`, `any`), side effects (`effect`), and terminal operations (`toTuple`, `defaultTo`, `either`).

Callbacks follow the **value protocol**: a returned `Err` is the failure, a returned `Outcome` passes through, and anything else is the success value. `fromTuple`/`fromTupleAsync` are the only entry points that read a `[value, error]` tuple as control flow.

```typescript
import { Outcome, Err } from "@pencroff-lab/kore";

// Create from callback
const outcome = Outcome.from(() => {
  if (!isValid(input)) return Err.from("Invalid input", "VALIDATION");
  return processedValue;
});

// Extract with tuple destructuring
const [value, err] = outcome.toTuple();
if (err) {
  console.error(err.message);
  return;
}
console.log(value);
```

#### Construction

```typescript
Outcome.ok(42); // success
Outcome.err("Failed", "ERROR_CODE"); // error (Outcome<never>)
Outcome.err<number>("Failed"); // error that still chains as Outcome<number>
Outcome.ok(); // void success (Outcome<void>, value undefined)
Outcome.ok(null); // explicit null success (Outcome<null>)
Outcome.ok(someErr); // an Err carried as the success value

// From sync callback (catches throws)
Outcome.from(() => JSON.parse(input)); // may throw

// From async callback
await Outcome.fromAsync(async () => {
  const res = await fetch("/api/data");
  if (!res.ok) return Err.from("Request failed", "HTTP_ERROR");
  return await res.json();
});

// From a Go-style function returning [value, error]
Outcome.fromTuple(() => readConfig());
await Outcome.fromTupleAsync(() => loadConfig());
```

#### Transformations

```typescript
const result = Outcome.ok(5)
  .map((n) => n * 2) // transform success, cannot fail
  .flatMap((n) => (n > 5 ? Outcome.err("Too big") : Outcome.ok(n))) // step that can fail
  .mapErr((err) => err.wrap("Added context")) // transform error
  .toTuple();

// Pipe for sequential transformations with access to both value and error
const piped = Outcome.ok(rawInput).pipe(
  ([val, err]) => (err ? err : validate(val)),
  ([val, err]) => (err ? err : transform(val)),
);
```

#### Combinators

```typescript
// All must succeed (collects all errors)
const all = Outcome.all([Outcome.ok(1), Outcome.ok(2), Outcome.ok(3)]);
// all.toTuple() === [[1, 2, 3], null]

// First success wins
const any = Outcome.any([
  Outcome.err("Failed"),
  Outcome.ok(42),
  Outcome.ok(100),
]);
// any.toTuple() === [42, null]
```

#### Terminal operations

```typescript
// Default value on error
const count = parseNumber(input).defaultTo(0);

// Computed fallback
const name = fetchUser(id).defaultTo((err) =>
  err.hasCode("NOT_FOUND") ? "Guest" : "Unknown",
);

// Transform both cases
const response = processOrder(orderId).either(
  (order) => ({ status: 200, body: order }),
  (err) => ({ status: err.hasCode("NOT_FOUND") ? 404 : 500, body: { error: err.message } }),
);
```

## Migrating from `Outcome`

`Outcome` and `flow` share one `ResultTuple<T>` declaration, so `toTuple()` is
the bridge and migration is call-site local.

| `Outcome` | `flow` |
|---|---|
| `Outcome.ok(value)` / `Outcome.ok()` | `ok(value)` / `ok()` |
| `Outcome.err(error)` | `fail(error)` |
| `Outcome.err<T>(...)` | `fail(...)` — `ResultTuple<never>` threads through later operations |
| `Outcome.from(fn)` | `attempt(() => ok(fn()))`, or `attempt(() => cond ? ok(v) : fail(...))` |
| `Outcome.fromAsync(fn)` | `attemptAsync(async () => ok(await fn()))` |
| `Outcome.fromTuple(tuple)` | use the tuple directly |
| `Outcome.fromTuple(callback)` | `attempt(callback)` |
| `outcome.toTuple()` | destructure the result directly |
| `outcome.map(fn)` | `map(tuple, fn)` |
| `outcome.flatMap(fn)` | `flatMap(tuple, fn)`; a value-returning `fn` becomes `(v) => ok(fn(v))` |
| `outcome.mapErr(fn)` | `mapErr(tuple, fn)`; enrichment becomes `(e) => fail(e.wrap(...))`, recovery `(e) => ok(fallback)` |
| `outcome.effect(fn)` | `effect(tuple, fn)` |
| `outcome.defaultTo(value)` / `defaultTo(value, true)` | `defaultTo(tuple, () => value)` |
| `outcome.defaultTo(handler)` | `defaultTo(tuple, handler)` |
| `outcome.either(...)` | `either(tuple, ...)` |
| `outcome.pipe(...)` | `pipe(tuple, onOk(...), onErr(...), onTuple(...))` |
| `Outcome.all(...)` / `Outcome.any(...)` | `all(...)` / `any(...)` |
| `Outcome.fromJSON(payload)` | `fromJSON(payload)` |
| `Outcome.ok(err)` in a callback or as a result | `ok(err)` in both positions |

Migration is not textual. Three changes need attention:

- **Every fallible callback now returns a tuple.** A callback that returned a
  bare value or a bare `Err` gains an explicit `ok(...)` or `fail(...)`. The
  compiler locates every site, because neither a bare value nor a missing return
  satisfies `ResultTuple`.
- **`defaultTo` is handler-only.** A value-form call no longer type-checks and
  becomes a thunk: `defaultTo(tuple, () => value)`.
- **`Err.isErr` is nominal.** Code that relied on a plain `{ kind: "Err" }`
  marker being treated as an error now sees that object as success data. This
  one is not caught by the compiler — construct a real instance with
  `Err.from(marker)`.

## Utilities

### dtStamp

Formats a `Date` into a compact timestamp string. Useful for filenames, logs, and identifiers.

```typescript
import { dtStamp } from "@pencroff-lab/kore";

dtStamp(); // "20260218_153045"
dtStamp(new Date(), { parts: "date" }); // "20260218"
dtStamp(new Date(), { parts: "time", ms: true }); // "153045_123"
dtStamp(new Date(), { readable: true }); // "2026-02-18_15:30:45"
dtStamp(new Date(), { tz: "local" }); // uses local timezone
```

### Logger

Structured, callable logger with transport DI, child loggers, and automatic `Err` formatting.

```typescript
import { log, createLogger } from "@pencroff-lab/kore";

// Default logger
log("Application started");
log(log.WARN, "Connection slow");
log(log.ERROR, "Failed to save", { userId: "123" });

// Module-specific logger
const dbLog = createLogger("database");
dbLog("Connected to postgres");

// Child loggers with inherited context
const userLog = dbLog.child("users", { version: "1.0" });
userLog("User created");
// Output: [database] [users] User created {"version":"1.0"}

// Err instances rendered automatically
const [data, err] = fetchData();
if (err) {
  log(log.ERROR, "Fetch failed", err);
  // Output includes indented Err.toString() below the log line
}
```

## Development

```bash
bun install                # install dependencies
bun test                   # run tests
bun run test:coverage      # run tests with coverage (>= 83%)
bun run lint               # lint + type check (auto-fix)
bun run build              # build ESM + CJS to dist/
```

## License

[Apache-2.0](LICENSE)

## Release process

This section is the maintainer checklist for publishing the library and its
versioned documentation. The documentation implementation and recovery model
are described in more detail in [`site/README.md`](site/README.md).

### 1. Finish the code and documentation

Keep `package.json#version` at the currently published version while ordinary
feature work is in progress. Before merging a feature, make its commit messages
final: `git-cliff` derives the next version from Conventional Commits. Use `!`
and a `BREAKING CHANGE:` footer for a real breaking change, for example:

```text
feat(flow)!: add tuple-based error boundaries

BREAKING CHANGE: flow replaces Outcome as the primary result API.
```

Regenerate documentation whenever exported APIs, JSDoc, examples or navigation
change, and commit generated files with their source change:

```bash
bun install --frozen-lockfile
bun run docs:generate
bun run docs:check
```

Validate code and documentation before preparing the release:

```bash
bun run lint:ci
bun run check:boundaries
bun test --coverage --path-ignore-patterns='scripts/docs/build.integration.test.ts'
bun test scripts/docs/build.integration.test.ts
bun run build
bun run docs:build
bun run docs:check -- --site build/docs-site/public
```

The documentation integration tests and site build require the exact Bun, Go,
Hugo Extended and Hextra versions listed in
[`site/toolchain.json`](site/toolchain.json).

### 2. Prepare the release

Create a release-preparation branch from the latest `main`:

```bash
VERSION=0.8.0
git switch main
git pull --ff-only origin main
git switch -c "release/prepare-${VERSION}"
```

Check the version inferred from the commit history, generate the changelog, and
set `package.json#version` to the same version without the leading `v`:

```bash
bunx git-cliff --bumped-version
bun run bump_version
```

Review `CHANGELOG.md`; do not accept the inferred version blindly. If it is
wrong, fix the Conventional Commit messages before they reach `main`, then
regenerate the changelog. Once the version is final, regenerate documentation
so its source links use `v<version>` and create the immutable snapshot:

```bash
bun run docs:generate
bun run check:release
bun run docs:check
bun run docs:snapshot "$VERSION"
bun run docs:release-state
```

The final command must report `mode=release`, `snapshot_present=true` and
`publication_recorded=false`. Review and commit every generated release file:

```bash
git status
git diff --stat
git add -A
git commit -m "chore(release): prepare ${VERSION}"
git push -u origin "release/prepare-${VERSION}"
```

Open a pull request. Pull-request CI validates the package and complete site but
does not publish. Merging the prepared commit to `main` publishes npm, verifies
the exact registry version, creates `v<version>`, and uploads the verified
`publication-receipt-<version>` artifact.

### 3. Commit the publication receipt

Download the receipt artifact from the successful workflow run, copy its
`published.json` over `site/published.json`, and commit it in a second pull
request. With the GitHub CLI:

```bash
VERSION=0.8.0
RUN_ID=123456789
gh run download "$RUN_ID" \
  --name "publication-receipt-${VERSION}" \
  --dir build/receipt
cp build/receipt/published.json site/published.json
bun run docs:release-state
git add site/published.json
git commit -m "docs: record ${VERSION} publication"
```

The classifier must now report `mode=docs-only`. Merging this receipt commit
promotes the new documentation edition and deploys GitHub Pages without
publishing or moving the tag again.

## Troubleshooting releases

### `git-cliff` suggests the wrong version

Inspect the commits since the latest tag. A breaking release needs `!` after
the type or scope, or a `BREAKING CHANGE:` footer. Rewrite incorrect messages
before merging the feature branch. If the commits are already on `main`, avoid
rewriting shared history merely to change the changelog: select the intended
version explicitly, review `CHANGELOG.md`, and continue with a release-prep
branch.

### Release state is `unprepared`

`package.json` names a version that is neither recorded as published nor
present under `site/versions/`. Confirm that `CHANGELOG.md` contains the exact
version, then run:

```bash
VERSION=0.8.0
bun run check:release
bun run docs:generate
bun run docs:snapshot "$VERSION"
bun run docs:release-state
```

Never add a `site/versions.yaml` entry manually; `docs:snapshot` creates the
directory, manifest, hashes and catalog entry as one validated operation.

### npm publish failed before the version appeared on npm

Fix the reported authentication, permission, network or package-validation
error and rerun the release. The prepared snapshot is still only a candidate,
and no receipt should be committed until the exact version exists on npm.

### npm published, but receipt generation failed

Do **not** publish again and do not bump to another version. This includes the
`Executable not found in $PATH: "npm"` failure from the slim Bun CI image. The
receipt verifier uses `bun info`; update to the fix if the failed release commit
predates it.

The recorder requires `HEAD` to equal the commit referenced by `v<version>`.
Create a recovery branch at that tag, apply any verifier fix without committing
it yet, verify the operation, and then write the receipt:

```bash
VERSION=0.8.0
git fetch origin --tags
git switch -c "recovery/record-${VERSION}" "v${VERSION}"

# Apply the required tooling fix here, but keep HEAD at "v${VERSION}".
bun run docs:record-publication -- "$VERSION" --dry-run
bun run docs:record-publication -- "$VERSION"
bun run docs:release-state
```

Commit `site/published.json` together with the tooling fix. The resulting
branch reports `mode=docs-only`; merging it skips npm publication and resumes
the documentation deployment.

### The version already exists on npm

First determine whether it is the package produced by the current release. If
it is the expected release and `v<version>` points at its release commit, use
the receipt-recovery procedure above. If it belongs to another build, stop and
investigate; npm versions are immutable, so the intended release needs a new
version rather than an overwritten artifact.

### The release tag is missing or points at another commit

Compare the tag and release commit:

```bash
VERSION=0.8.0
git rev-parse "v${VERSION}"
git rev-parse HEAD
```

Do not move an existing published tag automatically. Confirm which commit
produced the npm artifact first. A missing tag may be created at that verified
commit; a mismatched tag requires manual investigation.

### The receipt exists but was not committed

Download `publication-receipt-<version>` from the original workflow run and
commit its `published.json` as described above. If the artifact expired, check
out `v<version>` and recreate it with `docs:record-publication`.

### Documentation validation cannot find Hugo

Install the Extended edition and match [`site/toolchain.json`](site/toolchain.json).
Library tests intentionally exclude `scripts/docs/build.integration.test.ts`;
run that suite only in an environment where Hugo is available.

### GitHub Actions warns that Node.js 20 is deprecated

The warning refers to the JavaScript runtime used internally by an action, not
to Bun or this package. Upgrade the named action to a Node.js 24-based major;
for example, replace `actions/checkout@v4` with `actions/checkout@v5`.

### npm succeeded but GitHub Pages deployment failed

Commit the verified receipt first if it is still pending. Then rerun the failed
deployment or manually dispatch the CI workflow with `deploy_docs_only=true`.
That path rebuilds and deploys the committed documentation state and cannot
republish npm or move the release tag.
