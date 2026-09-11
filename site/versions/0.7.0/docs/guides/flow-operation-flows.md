# Flow Operation Flows

How `flow` composes operations in `@pencroff-lab/kore`. For error creation, wrapping, codes, metadata, and aggregation, see [error-handling-patterns.md](./error-handling-patterns.md).

Every operation here is a free function over `ResultTuple<T>`:

```typescript
type ResultTuple<T> = readonly [T, null] | readonly [null, Err];
```

The error slot is the discriminant. There is no container, so a result is
destructured wherever it is convenient — including in the middle of a chain.

## Creating results

### Success

```typescript
const result = ok(42);
const [value, error] = result;
// value === 42, error === null
```

### Failure

```typescript
fail("User not found", "NOT_FOUND");
fail(existingErr);                     // preserved by reference
fail(Err.from(caught, { code: "READ_FAILED", metadata: { path } }));
```

`fail` has one signature: an `Err` or a message, plus an optional code. Every
richer construction goes through `Err.from(...)` and is passed in as `fail(err)`.
`fail` returns `ResultTuple<never>`, which threads through later operations with
no generic claim.

### Void and null success

```typescript
ok();       // [undefined, null] — ResultTuple<void>
ok(null);   // [null, null]      — ResultTuple<null>
```

`[null, null]` is a valid success: the invariant is "the error slot is null",
not "exactly one slot is null".

### Error- and tuple-shaped data

`ok(...)` never inspects its argument, so it is the one way to carry a value
that happens to look like a failure:

```typescript
ok(Err.from("this is data"));   // ResultTuple<Err>
ok(new Error("this is data"));  // ResultTuple<Error>
ok(ok(1));                      // ResultTuple<ResultTuple<number>>
```

### State checking

Destructuring narrows both branches — no type guard needed:

```typescript
const [value, error] = parsePort(raw);
if (error) return error;   // error: Err
return value * 2;          // value: number
```

Filtering a collection maps to tuples first:

```typescript
const values = results
  .filter((t): t is readonly [number, null] => t[1] === null)
  .map(([v]) => v);
```

## Exception boundaries

### `attempt()` — catch synchronous throws

```typescript
const parsed = attempt(() => ok(JSON.parse(raw)));
```

The callback returns a tuple, so it can also decide the channel itself:

```typescript
attempt(() => (isValid(input) ? ok(input) : fail("invalid", "VALIDATION")));
```

A caught value becomes `Err.from(caught)`: a native `Error` keeps its stack and
cause chain, a serialized `Err` is reconstructed, and anything else lands in the
`UNKNOWN` branch with the value kept as `metadata.originalValue`.

### `attemptAsync()` — catch throws and rejections

```typescript
await attemptAsync(async () => {
  const res = await fetch(url);
  return res.ok ? ok(await res.json()) : fail(`HTTP ${res.status}`, "HTTP");
});
```

## Transformations

### `map()` — transform a success value

```typescript
map(ok(5), (n) => n * 2);        // [10, null]
map(fail("nope"), (n) => n * 2); // the same failure, by reference
```

`map` is the only operation whose callback returns plain data. Its return is
never inspected, so an `Err` or a tuple returned from `map` is the success
value. Only a throw changes the channel.

### `flatMap()` — chain a step that can fail

```typescript
flatMap(ok(id), readConfig);              // a tuple-returning callee composes directly
flatMap(ok(2), (n) => ok(n * 2));         // a pure step gains an explicit ok()
flatMap(ok(2), () => fail("no", "NO"));   // an explicit failure
```

The callback's tuple is returned by reference. A failure input passes through
untouched and the callback never runs.

### `mapErr()` — transform or recover from a failure

```typescript
// enrich: chain the Err methods inside one callback
mapErr(result, (e) =>
  fail(e.wrap("Failed to load project").withCode("PROJECT_LOAD").withMetadata({ projectId })),
);

// recover with a value — the success type widens
mapErr(result, () => ok("fallback"));

// recover with the error itself as data
mapErr(result, (e) => ok(e));
```

There are no `flow` error-enrichment helpers; `Err` already owns `wrap`,
`withCode` and `withMetadata`.

### `ensure()` — validate, optionally refining the type

```typescript
ensure(ok(port), (n) => n > 0, (n) => Err.from(`invalid port ${n}`, "PORT"));

// a type predicate narrows the success type
ensure(input, (v): v is string => typeof v === "string", () => Err.from("not a string"));
```

A passing predicate returns the original tuple untouched. The error factory is
lazy, and a throw from either callback becomes the failure.

### Async forms

`mapAsync`, `flatMapAsync`, `mapErrAsync` and `effectAsync` mirror their
synchronous counterparts and additionally convert rejections. `ensure` has no
async form.

## Pipelines

### `pipe()` — a synchronous chain

```typescript
const loaded = pipe(
  ok(raw),
  onOk(parse),
  onOk(validate),
  onErr((e) => fail(e.wrap("Failed to load config", { code: "CONFIG" }))),
);
```

Stage factories classify a stage by what its callback receives:

| Factory | Callback input | Delegates to |
|---|---|---|
| `onOk` / `onOkAsync` | the success value | `flatMap` / `flatMapAsync` |
| `onErr` / `onErrAsync` | the `Err` | `mapErr` / `mapErrAsync` |
| `onTuple` / `onTupleAsync` | a copy of the whole tuple | `attempt` / `attemptAsync` |

A return-preserving map stage has no curried form — write it explicitly:

```typescript
pipe(source, (tuple) => map(tuple, formatName));
```

### Mid-chain recovery

Each stage is caught separately, so a later `onErr` recovers from a failing
**or throwing** stage:

```typescript
pipe(
  ok(1),
  () => { throw new Error("stage boom"); },
  onErr((e) => ok(e.message)),
);
// ["stage boom", null]
```

### `pipeAsync()` — mixed and promised

```typescript
await pipeAsync(
  Promise.resolve(ok(userId)),   // a promised source needs no extra await
  onOkAsync(fetchUser),
  onOk(normalize),               // sync stages are welcome
  onErr((e) => ok(anonymous(e))),
);
```

A rejected source enters the failure channel before the first stage, so a later
`onErr` can still recover.

### Typed stages

Both composers are typed through **ten** stages. Past ten, the trailing overload
widens the result to `ResultTuple<unknown>`. A reusable pipeline is an ordinary
typed function:

```typescript
const transform = (source: ResultTuple<Input>) =>
  pipe(source, onOk(step1), onOk(step2), onErr(recover));
```

### When to use `map`, `flatMap` or `pipe`

| Need | Use |
|---|---|
| A transformation that cannot fail | `map` |
| A step that can fail | `flatMap` (or `onOk` in a pipeline) |
| Access to both channels | `onTuple`, or destructure directly |
| Three or more chained steps | `pipe` / `pipeAsync` |

## Side effects

```typescript
effect(result, ([value, error]) => {
  if (error) logger.error(`Failed: ${error.message}`);
  else logger.info(`Success: ${value}`);
});
```

`effect` runs on either channel and returns the tuple it handed the callback —
an output copy, not your input. Its callback's normal return value is ignored; a
throw becomes the failure.

## Combinators

### `all()` — succeed when every input succeeded

```typescript
all([ok(1), ok(2), ok(3)]);             // [[1, 2, 3], null]
all([ok(1), ok("two")] as const);       // ResultTuple<[number, string]>
all([]);                                 // [[], null]
all([fail("a", "A"), fail("b", "B")]);  // one aggregate Err holding both
```

`all` is ordered and non-short-circuiting: it inspects every already-evaluated
result and collects every error through `addAll`. Because
`all([readA(), readB()])` evaluates both calls before `all` runs, it is for
independent work — it does not replace a sequential guard that must stop at the
first failure.

### `any()` — succeed on the first success

```typescript
any([fail("primary down"), ok("replica")]);  // the winning tuple, by reference
any([]);                                      // failure with code EMPTY_INPUT
```

The winner is returned by reference, so it is the tuple the caller owns. If
every input failed, the errors are aggregated.

## Terminal operations

### `defaultTo()` — a value, or a handler's result

```typescript
defaultTo(result, () => 0);                  // constant fallback, as a thunk
defaultTo(result, (e) => recover(e));        // error-aware recovery
defaultTo(result, () => fallbackFunction);   // a function-valued fallback
```

One handler-only signature. The handler is lazy — it never runs on the success
path — and its exceptions propagate: `defaultTo` adds no catch boundary. A bare
value as the second argument is a compile error, which is the point: the
class-tier value form silently mis-resolved when `T` was itself a function type.

### `either()` — fold both channels

```typescript
either(
  processOrder(orderId),
  (order) => ({ status: 200, body: order }),
  (e) => ({ status: e.hasCode("NOT_FOUND") ? 404 : 500, body: { error: e.message } }),
);
```

Handler exceptions propagate here too.

## Serialization

```typescript
JSON.stringify(ok({ id: 1 }));       // [{"id":1},null]
JSON.stringify(fail("nope"));         // [null, {...Err.toJSON()}]

const [value, error] = fromJSON<Config>(JSON.parse(payload));
```

`fromJSON` validates the tuple envelope and the error slot only. `T` is a caller
assertion, not a decode, and a success payload is never interpreted — so
error-shaped data survives a round trip unchanged. It never throws:

| Input | Code | Message |
|---|---|---|
| Not an array, or not exactly two elements | `INVALID_JSON` | `Invalid JSON result: expected a two-element tuple` |
| Both slots non-null | `INVALID_JSON` | `Invalid JSON result: both value and error slots are set` |
| Error slot not reconstructible | `INVALID_JSON` | `Invalid JSON result: invalid serialized error` |

Every rejection attaches the offending payload as `originalValue` metadata.
`ok()` serializes to `[null, null]` and comes back as `ok(null)` — `void` does
not round-trip.

## Input protection

`flow` protects the tuple container, never the payload:

- `pipe` / `pipeAsync` copy the source once on entry, so a stage cannot mutate
  the caller's tuple. Built-in operators never expose an input, so every
  intermediate is private to the run.
- `effect` hands its callback the output copy; `onTuple` hands it an input copy.
- `map`, `flatMap`, `mapErr` and their async forms receive a payload only.
- An unchanged passthrough channel is returned by reference — a failure can
  cross every later stage as one object.
- `all` always constructs its output; `any` returns the winning input by
  reference, so a caller that mutates that tuple sees the change in the result.
- Success values, `Err` instances, and metadata are never cloned. Use the
  exported `copy` when a custom `Op` needs an isolated tuple.

## Real-world patterns

### API handler with validation

```typescript
const handle = (raw: string) =>
  either(
    pipe(
      ok(raw),
      onOk((body: string) => attempt(() => ok(JSON.parse(body) as Draft))),
      onOk((draft: Draft) =>
        ensure(ok(draft), (d) => d.title.length > 0, () =>
          Err.from("title is required", "VALIDATION:TITLE"),
        ),
      ),
      onOk(save),
    ),
    (saved) => ({ status: 201, body: saved }),
    (e) => ({ status: e.hasCodePrefix("VALIDATION") ? 400 : 500, body: { error: e.message } }),
  );
```

### Parallel work with error collection

```typescript
const [config, err] = all([readSecrets(), readFeatureFlags(), readLimits()] as const);
if (err) logger.error(err.toString());   // one aggregate holding every failure
```

### Fallback chain

```typescript
const [value] = any([fromCache(key), fromReplica(key), fromOrigin(key)]);
```

### Async pipeline with recovery

```typescript
const profile = await pipeAsync(
  ok(userId),
  onOkAsync((id: string) => attemptAsync(async () => ok(await fetchUser(id)))),
  onOkAsync(loadPreferences),
  onErr((e) => ok(defaultProfile(e))),
);
```

## See also

- [flow examples](../examples/flow.md) — every pattern above, executable
- [Migration from throwing](./migration-from-throwing.md) — converting `try/catch` code
- [Migrating from `Outcome`](../../README.md#migrating-from-outcome) — the class-tier operation map
- [API reference](../api/flow.md)
