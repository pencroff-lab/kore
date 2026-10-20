[@pencroff-lab/kore](README.md) / flow

# flow

Result tuples as free functions — the tuple tier of the package.

`flow` operates directly on `ResultTuple<T>`: `[value, null]` on success,
`[null, Err]` on failure. There is no container to construct or unwrap, so a
result destructures at any point and every operation is a plain function.

**Key concepts:**
- **One fallible protocol** — every fallible callback returns a `ResultTuple`.
  The error slot is the only failure signal; no operator inspects a value's
  runtime shape. Maps and value adapters always carry callback returns as data.
- **`ok` / `fail` are the boundary** — `ok(err)` and `ok(tuple)` carry
  error- or tuple-shaped values as successful data.
- **Exception boundaries** — `attempt`/`attemptAsync`, every callback-taking
  operation, and every pipeline stage convert a throw into `Err.from(caught)`.
  `attemptValue` / `attemptValueAsync` always envelope throwing value returns,
  normalizing untyped data to `unknown` for validation by the caller.
- **Type guards** reject inferred raw `any` returns and sources. Explicit type
  arguments, preannotations and casts erase that check; use unsafe-any lint.
- **Input protection** — a pipeline copies its source once on entry, and tuple
  callbacks receive a copy. Payloads are never cloned.
- **Error enrichment** lives on `Err`: use `mapErr`/`onErr` and chain
  `wrap`, `withCode`, `withMetadata` inside the callback.

## See

[flow.examples.test.ts](../examples/flow.md) for usage patterns

## Type Aliases

### AnyOp

> **AnyOp**\<`In`, `Out`, `Raw`\> = (`tuple`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Defined in: [flow/flow.types.ts:66](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.types.ts#L66)

Stage accepted by `pipeAsync`: it may settle synchronously or not.

A single call signature with a union *return*, not a union of `Op` and
`OpAsync` — TypeScript cannot instantiate a generic stage (the one `onErr`
returns) against a union target, which would collapse the pipeline's success
type to `unknown`. Every `Op` and `OpAsync` is assignable here. It does not
make an async stage valid in the synchronous `pipe`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`AsyncSource`](#asyncsource)\<`Out`\> = [`AsyncSource`](#asyncsource)\<`Out`\>

***

### AsyncSource

> **AsyncSource**\<`T`, `Raw`\> = `Raw` & `NoAny`\<`Raw`\>

Defined in: [flow/flow.types.ts:72](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.types.ts#L72)

Source accepted by `pipeAsync`: a tuple, or a promise of one.

#### Type Parameters

##### T

`T`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`T`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\> = [`ResultTuple`](#resulttuple)\<`T`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

***

### OkValue

> **OkValue**\<`R`\> = `R` *extends* readonly \[infer V, `null`\] ? `V` : `never`

Defined in: [flow/flow.types.ts:82](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.types.ts#L82)

Success type carried by a result tuple.

#### Type Parameters

##### R

`R`

***

### OkValues

> **OkValues**\<`T`\> = `{ -readonly [K in keyof T]: OkValue<T[K]> }`

Defined in: [flow/flow.types.ts:88](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.types.ts#L88)

Success types of a collection of result tuples, positionally.
A tuple of results maps to a tuple of values; an array maps to an array.

#### Type Parameters

##### T

`T` *extends* readonly `unknown`[]

***

### Op

> **Op**\<`In`, `Out`, `Raw`\> = (`tuple`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Defined in: [flow/flow.types.ts:39](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.types.ts#L39)

Synchronous pipeline stage: tuple in, tuple out.

#### Type Parameters

##### In

`In`

Input success type

##### Out

`Out`

Output success type

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> = [`ResultTuple`](#resulttuple)\<`Out`\>

***

### OpAsync

> **OpAsync**\<`In`, `Out`, `Raw`\> = (`tuple`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Defined in: [flow/flow.types.ts:50](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.types.ts#L50)

Asynchronous pipeline stage.

#### Type Parameters

##### In

`In`

Input success type

##### Out

`Out`

Output success type

##### Raw

`Raw` *extends* `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\> = `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

***

### ResultTuple

> **ResultTuple**\<`T`\> = readonly \[`T`, `null`\] \| readonly \[`null`, [`Err`](err.md#err)\]

Defined in: [types/common.types.ts:15](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/types/common.types.ts#L15)

Tuple-based result with positional semantics, shared by the `flow` and
`Outcome` tiers.

- `[T, null]`: success with value
- `[null, Err]`: failure

The error slot is the discriminant — `ok(null)` is the valid success tuple
`[null, null]`. Readonly at the type level; nested payloads are not protected.

#### Type Parameters

##### T

`T`

## Functions

### all()

> **all**\<`T`\>(`results`): [`ResultTuple`](#resulttuple)\<[`OkValues`](#okvalues)\<`T`\>\>

Defined in: [flow/flow.ts:1111](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L1111)

Combine already-evaluated results, succeeding only if every one succeeded.

Order-preserving and non-short-circuiting: every failure is collected into one
aggregate `Err`. Heterogeneous input infers a tuple of success types. Empty
input succeeds with `[]`.

#### Type Parameters

##### T

`T` *extends* readonly [`ResultTuple`](#resulttuple)\<`unknown`\>[]

#### Parameters

##### results

`T`

Result tuples to combine

#### Returns

[`ResultTuple`](#resulttuple)\<[`OkValues`](#okvalues)\<`T`\>\>

Success with all values, or one aggregate failure

***

### any()

> **any**\<`T`\>(`results`): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [flow/flow.ts:1140](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L1140)

Return the first successful result, by reference.

The winning tuple is the caller's own, not a copy. If every input failed the
errors are aggregated; empty input fails with code `EMPTY_INPUT`.

#### Type Parameters

##### T

`T`

#### Parameters

##### results

readonly [`ResultTuple`](#resulttuple)\<`T`\>[]

Result tuples to check

#### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

The first success, or an aggregate failure

***

### attempt()

> **attempt**\<`T`, `Raw`\>(`fn`): [`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Raw`\>\>

Defined in: [flow/flow.ts:120](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L120)

Run a fallible callback, converting a throw into a failure tuple.

#### Type Parameters

##### T

`T`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`T`\> = [`ResultTuple`](#resulttuple)\<`T`\>

#### Parameters

##### fn

() => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Callback returning a result tuple

#### Returns

[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Raw`\>\>

The callback's tuple, or `Err.from(caught)` as a failure

***

### attemptAsync()

> **attemptAsync**\<`T`, `Raw`\>(`fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

Defined in: [flow/flow.ts:136](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L136)

Async counterpart of `attempt()`. Converts throws and rejections.

#### Type Parameters

##### T

`T`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`T`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\> = `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

#### Parameters

##### fn

() => `Raw` & `NoAny`\<`Raw`, `Promise`\<`unknown`\>, `UseAttemptValueOrAttemptValueAsync`\>

Async callback returning a result tuple

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

Promise of the callback's tuple, or of a failure

***

### attemptValue()

> **attemptValue**\<`T`\>(`fn`): [`ResultTuple`](#resulttuple)\<`SafeValue`\<`T`\>\>

Defined in: [flow/flow.ts:157](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L157)

Wrap a throwing value callback as data, normalizing `any` to `unknown`.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T` & `SyncValue`\<`T`\>

Synchronous data callback; use `attemptValueAsync` for PromiseLike returns

#### Returns

[`ResultTuple`](#resulttuple)\<`SafeValue`\<`T`\>\>

A success envelope, or a caught throw as a failure

#### See

[flow.examples.test.ts](../examples/flow.md)

***

### attemptValueAsync()

> **attemptValueAsync**\<`T`\>(`fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`SafeValue`\<`Awaited`\<`T`\>\>\>\>

Defined in: [flow/flow.ts:173](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L173)

Await and wrap a value callback, converting throws and rejections.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `PromiseLike`\<`T`\>

Callback returning a promise of data

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`SafeValue`\<`Awaited`\<`T`\>\>\>\>

A success envelope with awaited `any` normalized to `unknown`, or a failure

***

### copy()

> **copy**\<`T`\>(`tuple`): `T`

Defined in: [flow/flow.ts:68](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L68)

Copy a result tuple, keeping its narrowed type.

Two slots only — the payload is shared, not cloned.

#### Type Parameters

##### T

`T` *extends* [`ResultTuple`](#resulttuple)\<`unknown`\>

#### Parameters

##### tuple

`T`

Tuple to copy

#### Returns

`T`

A new tuple with the same slots

***

### defaultTo()

> **defaultTo**\<`T`\>(`tuple`, `onErr`): `T`

Defined in: [flow/flow.ts:1072](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L1072)

Extract the success value, or compute a fallback from the error.

Handler-only: a constant fallback is `defaultTo(tuple, () => 0)`. The handler
is lazy and its exceptions propagate — this operation adds no catch boundary.

#### Type Parameters

##### T

`T`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

Source result

##### onErr

(`error`) => `T`

Handler called only on the failure branch

#### Returns

`T`

The success value, or the handler's result

***

### effect()

> **effect**\<`T`\>(`tuple`, `fn`): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [flow/flow.ts:342](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L342)

Run a side effect on either channel.

The callback receives the returned copy, not the caller's tuple, and its
callback must return void or undefined. A throw becomes the failure.

#### Type Parameters

##### T

`T`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

Source result

##### fn

(`tuple`) => `void` \| `undefined`

Side effect receiving the output tuple

#### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

The output copy, or a caught throw as a failure

***

### effectAsync()

> **effectAsync**\<`T`\>(`tuple`, `fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

Defined in: [flow/flow.ts:363](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L363)

Async counterpart of `effect()`.

#### Type Parameters

##### T

`T`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

Source result

##### fn

(`tuple`) => `Promise`\<`void`\>

Async side effect receiving the output tuple

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

Promise of the output copy, or of a failure

***

### either()

> **either**\<`T`, `U`\>(`tuple`, `onOk`, `onErr`): `U`

Defined in: [flow/flow.ts:1088](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L1088)

Fold both channels to a common output type. Handler exceptions propagate.

#### Type Parameters

##### T

`T`

##### U

`U`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

Source result

##### onOk

(`value`) => `U`

Handler for the success value

##### onErr

(`error`) => `U`

Handler for the error

#### Returns

`U`

The selected handler's result

***

### ensure()

> **ensure**\<`T`, `S`, `Predicate`, `ErrorValue`\>(`tuple`, `predicate`, `toErr`): [`ResultTuple`](#resulttuple)\<`S`\>

Defined in: [flow/flow.ts:388](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L388)

Validate a success value, optionally refining its type.

A passing predicate returns the original success tuple untouched; a failing
one builds the error lazily. A throw from either callback becomes the
failure. A failure input passes through and calls neither callback.

#### Type Parameters

##### T

`T`

##### S

`S` = `T`

##### Predicate

`Predicate` *extends* `boolean` = `boolean`

##### ErrorValue

`ErrorValue` *extends* [`Err`](err.md#err) = [`Err`](err.md#err)

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

Source result

##### predicate

Type predicate or boolean test

(`value`) => `value is S` | (`value`) => `Predicate` & `NoAny`\<`Predicate`\>

##### toErr

(`value`) => `ErrorValue` & `NoAny`\<`ErrorValue`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Error factory, called only when the predicate fails

#### Returns

[`ResultTuple`](#resulttuple)\<`S`\>

The original success, a constructed failure, or a caught throw

***

### fail()

> **fail**(`error`, `code?`): [`ResultTuple`](#resulttuple)\<`never`\>

Defined in: [flow/flow.ts:107](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L107)

Create a failure tuple.

An existing `Err` is preserved by reference unless a code is supplied, in
which case it is cloned with that code. Richer construction — metadata, a
wrapped native error, a serialized payload — goes through `Err.from(...)` and
is then passed here as `fail(err)`.

#### Parameters

##### error

An existing `Err`, or a message to build one from

`string` | [`Err`](err.md#err)

##### code?

`string`

Optional error code

#### Returns

[`ResultTuple`](#resulttuple)\<`never`\>

`[null, Err]`

***

### flatMap()

> **flatMap**\<`In`, `Out`, `Raw`\>(`tuple`, `fn`): [`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Raw`\>\>

Defined in: [flow/flow.ts:239](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L239)

Chain a fallible callback on the success channel.

The callback's tuple is returned by reference, so a tuple-returning callee
composes directly: `flatMap(ok(project), readConfig)`. A failure passes
through by reference.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> = [`ResultTuple`](#resulttuple)\<`Out`\>

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

Source result

##### fn

(`value`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Callback returning a result tuple

#### Returns

[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Raw`\>\>

The callback's tuple, the original failure, or a caught throw

***

### flatMapAsync()

> **flatMapAsync**\<`In`, `Out`, `Raw`\>(`tuple`, `fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

Defined in: [flow/flow.ts:263](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L263)

Async counterpart of `flatMap()`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\> = `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

Source result

##### fn

(`value`) => `Raw` & `NoAny`\<`Raw`, `Promise`\<`unknown`\>, `UseAttemptValueOrAttemptValueAsync`\>

Async callback returning a result tuple

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

Promise of the resulting tuple

***

### fromJSON()

> **fromJSON**\<`T`\>(`payload`): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [flow/flow.ts:1180](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L1180)

Reconstruct a result tuple from `JSON.parse` output.

Validation covers the envelope and the error slot only — `T` is a caller
assertion, not a decode, and an error-shaped success payload is preserved
unchanged. Never throws: every invalid input returns an `INVALID_JSON`
failure carrying the payload as `originalValue` metadata. `ok()` serializes
to `[null, null]` and reconstructs as `ok(null)`; `void` does not round-trip.

#### Type Parameters

##### T

`T`

#### Parameters

##### payload

`unknown`

Parsed JSON value

#### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

The reconstructed tuple, or an `INVALID_JSON` failure

***

### map()

> **map**\<`In`, `Out`\>(`tuple`, `fn`): [`ResultTuple`](#resulttuple)\<`Out`\>

Defined in: [flow/flow.ts:197](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L197)

Transform a success value with a total function.

Return-preserving: the callback's return is the success value even when it is
an `Err`, a native `Error`, or a tuple. A failure passes through by reference.

#### Type Parameters

##### In

`In`

##### Out

`Out`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

Source result

##### fn

(`value`) => `Out`

Transformation applied to the success value

#### Returns

[`ResultTuple`](#resulttuple)\<`Out`\>

Transformed success, the original failure, or a caught throw

***

### mapAsync()

> **mapAsync**\<`In`, `Out`\>(`tuple`, `fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Defined in: [flow/flow.ts:216](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L216)

Async counterpart of `map()`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

Source result

##### fn

(`value`) => `Promise`\<`Out`\>

Async transformation applied to the success value

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Promise of the transformed result

***

### mapErr()

> **mapErr**\<`In`, `Out`, `Raw`\>(`tuple`, `fn`): [`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Raw`\>\>

Defined in: [flow/flow.ts:291](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L291)

Transform or recover from a failure.

`fail(error.wrap(...))` replaces the error, `ok(value)` recovers, and
`ok(error)` recovers with the error as data. A success passes through by
reference.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> = [`ResultTuple`](#resulttuple)\<`Out`\>

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

Source result

##### fn

(`error`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Callback receiving the error and returning a result tuple

#### Returns

[`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Raw`\>\>

The callback's tuple, the original success, or a caught throw

***

### mapErrAsync()

> **mapErrAsync**\<`In`, `Out`, `Raw`\>(`tuple`, `fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

Defined in: [flow/flow.ts:315](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L315)

Async counterpart of `mapErr()`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\> = `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

Source result

##### fn

(`error`) => `Raw` & `NoAny`\<`Raw`, `Promise`\<`unknown`\>, `UseAttemptValueOrAttemptValueAsync`\>

Async callback receiving the error

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

Promise of the resulting tuple

***

### ok()

#### Call Signature

> **ok**(): [`ResultTuple`](#resulttuple)\<`void`\>

Defined in: [flow/flow.ts:77](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L77)

Create a success tuple with no value.

##### Returns

[`ResultTuple`](#resulttuple)\<`void`\>

`[undefined, null]`

#### Call Signature

> **ok**\<`T`\>(`value`): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [flow/flow.ts:88](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L88)

Create a success tuple carrying a value.

The value is never inspected: `ok(err)` and `ok(tuple)` carry error- and
tuple-shaped data as success.

##### Type Parameters

###### T

`T`

##### Parameters

###### value

`T`

The success value

##### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

`[value, null]`

***

### onErr()

> **onErr**\<`Out`, `Raw`\>(`fn`): \<`In`\>(`tuple`) => [`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Raw`\>\>

Defined in: [flow/flow.ts:456](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L456)

Stage running a callback on the error channel.

The stage — not this factory — is generic in the pipeline's success type. An
error callback offers no site from which `In` could be inferred, so a factory
type parameter would collapse to `unknown` as soon as the stage is stored in
a variable, widening the whole pipeline.

#### Type Parameters

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> = [`ResultTuple`](#resulttuple)\<`Out`\>

#### Parameters

##### fn

(`error`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Callback receiving the error and returning a result tuple

#### Returns

A synchronous pipeline stage that preserves the success type

> \<`In`\>(`tuple`): [`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Raw`\>\>

##### Type Parameters

###### In

`In`

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Raw`\>\>

***

### onErrAsync()

> **onErrAsync**\<`Out`, `Raw`\>(`fn`): \<`In`\>(`tuple`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

Defined in: [flow/flow.ts:469](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L469)

Async counterpart of `onErr()`.

#### Type Parameters

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\> = `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

#### Parameters

##### fn

(`error`) => `Raw` & `NoAny`\<`Raw`, `Promise`\<`unknown`\>, `UseAttemptValueOrAttemptValueAsync`\>

Async callback receiving the error

#### Returns

An asynchronous pipeline stage that preserves the success type

> \<`In`\>(`tuple`): `Promise`\<[`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

##### Type Parameters

###### In

`In`

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`In` \| [`OkValue`](#okvalue)\<`Awaited`\<`Raw`\>\>\>\>

***

### onOk()

> **onOk**\<`In`, `Out`, `Raw`\>(`fn`): (`tuple`) => [`ResultTuple`](#resulttuple)

Defined in: [flow/flow.ts:421](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L421)

Stage running a fallible callback on the success value.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> = [`ResultTuple`](#resulttuple)\<`Out`\>

#### Parameters

##### fn

(`value`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Callback returning a result tuple

#### Returns

A synchronous pipeline stage

> (`tuple`): [`ResultTuple`](#resulttuple)

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

[`ResultTuple`](#resulttuple)

***

### onOkAsync()

> **onOkAsync**\<`In`, `Out`, `Raw`\>(`fn`): (`tuple`) => `Promise`

Defined in: [flow/flow.ts:434](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L434)

Async counterpart of `onOk()`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\> = `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

#### Parameters

##### fn

(`value`) => `Raw` & `NoAny`\<`Raw`, `Promise`\<`unknown`\>, `UseAttemptValueOrAttemptValueAsync`\>

Async callback returning a result tuple

#### Returns

An asynchronous pipeline stage

> (`tuple`): `Promise`

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

`Promise`

***

### onTuple()

> **onTuple**\<`In`, `Out`, `Raw`\>(`fn`): (`tuple`) => [`ResultTuple`](#resulttuple)

Defined in: [flow/flow.ts:487](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L487)

Stage running a callback on a copy of the whole tuple, on either channel.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> = [`ResultTuple`](#resulttuple)\<`Out`\>

#### Parameters

##### fn

(`tuple`) => `Raw` & `NoAny`\<`Raw`, `unknown`, `UseAttemptValueOrAttemptValueAsync`\>

Callback receiving a tuple copy and returning a result tuple

#### Returns

A synchronous pipeline stage

> (`tuple`): [`ResultTuple`](#resulttuple)

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

[`ResultTuple`](#resulttuple)

***

### onTupleAsync()

> **onTupleAsync**\<`In`, `Out`, `Raw`\>(`fn`): (`tuple`) => `Promise`

Defined in: [flow/flow.ts:505](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L505)

Async counterpart of `onTuple()`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

##### Raw

`Raw` *extends* [`ResultTuple`](#resulttuple)\<`Out`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\> = `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

#### Parameters

##### fn

(`tuple`) => `Raw` & `NoAny`\<`Raw`, `Promise`\<`unknown`\>, `UseAttemptValueOrAttemptValueAsync`\>

Async callback receiving a tuple copy

#### Returns

An asynchronous pipeline stage

> (`tuple`): `Promise`

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

`Promise`

***

### pipe()

#### Call Signature

> **pipe**\<`A`, `Source`\>(`source`): [`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Source`\>\>

Defined in: [flow/flow.ts:532](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L532)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

##### Parameters

###### source

`Source` & `NoAny`\<`Source`\>

##### Returns

[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Source`\>\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `Source`, `R1`\>(`source`, `op1`): [`ResultTuple`](#resulttuple)\<`B`\>

Defined in: [flow/flow.ts:536](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L536)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`B`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `Source`, `R1`, `R2`\>(`source`, `op1`, `op2`): [`ResultTuple`](#resulttuple)\<`C`\>

Defined in: [flow/flow.ts:546](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L546)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`C`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `Source`, `R1`, `R2`, `R3`\>(`source`, `op1`, `op2`, `op3`): [`ResultTuple`](#resulttuple)\<`D`\>

Defined in: [flow/flow.ts:559](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L559)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`D`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `Source`, `R1`, `R2`, `R3`, `R4`\>(`source`, `op1`, `op2`, `op3`, `op4`): [`ResultTuple`](#resulttuple)\<`E`\>

Defined in: [flow/flow.ts:575](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L575)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> = [`ResultTuple`](#resulttuple)\<`E`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

###### op4

[`Op`](#op)\<`NoInfer`\<`D`\>, `E`, `R4` & `ResultSlots`\<`E`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`E`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`): [`ResultTuple`](#resulttuple)\<`F`\>

Defined in: [flow/flow.ts:594](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L594)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> = [`ResultTuple`](#resulttuple)\<`E`\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> = [`ResultTuple`](#resulttuple)\<`F`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

###### op4

[`Op`](#op)\<`NoInfer`\<`D`\>, `E`, `R4` & `ResultSlots`\<`E`\>\>

###### op5

[`Op`](#op)\<`NoInfer`\<`E`\>, `F`, `R5` & `ResultSlots`\<`F`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`F`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`): [`ResultTuple`](#resulttuple)\<`G`\>

Defined in: [flow/flow.ts:616](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L616)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> = [`ResultTuple`](#resulttuple)\<`E`\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> = [`ResultTuple`](#resulttuple)\<`F`\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> = [`ResultTuple`](#resulttuple)\<`G`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

###### op4

[`Op`](#op)\<`NoInfer`\<`D`\>, `E`, `R4` & `ResultSlots`\<`E`\>\>

###### op5

[`Op`](#op)\<`NoInfer`\<`E`\>, `F`, `R5` & `ResultSlots`\<`F`\>\>

###### op6

[`Op`](#op)\<`NoInfer`\<`F`\>, `G`, `R6` & `ResultSlots`\<`G`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`G`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`): [`ResultTuple`](#resulttuple)\<`H`\>

Defined in: [flow/flow.ts:641](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L641)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> = [`ResultTuple`](#resulttuple)\<`E`\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> = [`ResultTuple`](#resulttuple)\<`F`\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> = [`ResultTuple`](#resulttuple)\<`G`\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> = [`ResultTuple`](#resulttuple)\<`H`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

###### op4

[`Op`](#op)\<`NoInfer`\<`D`\>, `E`, `R4` & `ResultSlots`\<`E`\>\>

###### op5

[`Op`](#op)\<`NoInfer`\<`E`\>, `F`, `R5` & `ResultSlots`\<`F`\>\>

###### op6

[`Op`](#op)\<`NoInfer`\<`F`\>, `G`, `R6` & `ResultSlots`\<`G`\>\>

###### op7

[`Op`](#op)\<`NoInfer`\<`G`\>, `H`, `R7` & `ResultSlots`\<`H`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`H`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`): [`ResultTuple`](#resulttuple)\<`I`\>

Defined in: [flow/flow.ts:669](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L669)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> = [`ResultTuple`](#resulttuple)\<`E`\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> = [`ResultTuple`](#resulttuple)\<`F`\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> = [`ResultTuple`](#resulttuple)\<`G`\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> = [`ResultTuple`](#resulttuple)\<`H`\>

###### R8

`R8` *extends* [`ResultTuple`](#resulttuple)\<`I`\> = [`ResultTuple`](#resulttuple)\<`I`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

###### op4

[`Op`](#op)\<`NoInfer`\<`D`\>, `E`, `R4` & `ResultSlots`\<`E`\>\>

###### op5

[`Op`](#op)\<`NoInfer`\<`E`\>, `F`, `R5` & `ResultSlots`\<`F`\>\>

###### op6

[`Op`](#op)\<`NoInfer`\<`F`\>, `G`, `R6` & `ResultSlots`\<`G`\>\>

###### op7

[`Op`](#op)\<`NoInfer`\<`G`\>, `H`, `R7` & `ResultSlots`\<`H`\>\>

###### op8

[`Op`](#op)\<`NoInfer`\<`H`\>, `I`, `R8` & `ResultSlots`\<`I`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`I`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`, `R9`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`): [`ResultTuple`](#resulttuple)\<`J`\>

Defined in: [flow/flow.ts:700](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L700)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### J

`J`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> = [`ResultTuple`](#resulttuple)\<`E`\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> = [`ResultTuple`](#resulttuple)\<`F`\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> = [`ResultTuple`](#resulttuple)\<`G`\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> = [`ResultTuple`](#resulttuple)\<`H`\>

###### R8

`R8` *extends* [`ResultTuple`](#resulttuple)\<`I`\> = [`ResultTuple`](#resulttuple)\<`I`\>

###### R9

`R9` *extends* [`ResultTuple`](#resulttuple)\<`J`\> = [`ResultTuple`](#resulttuple)\<`J`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

###### op4

[`Op`](#op)\<`NoInfer`\<`D`\>, `E`, `R4` & `ResultSlots`\<`E`\>\>

###### op5

[`Op`](#op)\<`NoInfer`\<`E`\>, `F`, `R5` & `ResultSlots`\<`F`\>\>

###### op6

[`Op`](#op)\<`NoInfer`\<`F`\>, `G`, `R6` & `ResultSlots`\<`G`\>\>

###### op7

[`Op`](#op)\<`NoInfer`\<`G`\>, `H`, `R7` & `ResultSlots`\<`H`\>\>

###### op8

[`Op`](#op)\<`NoInfer`\<`H`\>, `I`, `R8` & `ResultSlots`\<`I`\>\>

###### op9

[`Op`](#op)\<`NoInfer`\<`I`\>, `J`, `R9` & `ResultSlots`\<`J`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`J`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`, `R9`, `R10`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`, `op10`): [`ResultTuple`](#resulttuple)\<`K`\>

Defined in: [flow/flow.ts:734](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L734)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Accepts up to ten typed stages; compose
longer flows in typed chunks.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### J

`J`

###### K

`K`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> = [`ResultTuple`](#resulttuple)\<`A`\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> = [`ResultTuple`](#resulttuple)\<`B`\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> = [`ResultTuple`](#resulttuple)\<`C`\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> = [`ResultTuple`](#resulttuple)\<`D`\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> = [`ResultTuple`](#resulttuple)\<`E`\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> = [`ResultTuple`](#resulttuple)\<`F`\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> = [`ResultTuple`](#resulttuple)\<`G`\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> = [`ResultTuple`](#resulttuple)\<`H`\>

###### R8

`R8` *extends* [`ResultTuple`](#resulttuple)\<`I`\> = [`ResultTuple`](#resulttuple)\<`I`\>

###### R9

`R9` *extends* [`ResultTuple`](#resulttuple)\<`J`\> = [`ResultTuple`](#resulttuple)\<`J`\>

###### R10

`R10` *extends* [`ResultTuple`](#resulttuple)\<`K`\> = [`ResultTuple`](#resulttuple)\<`K`\>

##### Parameters

###### source

`Source` & `ResultSlots`\<`A`\> & `NoAny`\<`Source`\>

###### op1

[`Op`](#op)\<`NoInfer`\<`A`\>, `B`, `R1` & `ResultSlots`\<`B`\>\>

###### op2

[`Op`](#op)\<`NoInfer`\<`B`\>, `C`, `R2` & `ResultSlots`\<`C`\>\>

###### op3

[`Op`](#op)\<`NoInfer`\<`C`\>, `D`, `R3` & `ResultSlots`\<`D`\>\>

###### op4

[`Op`](#op)\<`NoInfer`\<`D`\>, `E`, `R4` & `ResultSlots`\<`E`\>\>

###### op5

[`Op`](#op)\<`NoInfer`\<`E`\>, `F`, `R5` & `ResultSlots`\<`F`\>\>

###### op6

[`Op`](#op)\<`NoInfer`\<`F`\>, `G`, `R6` & `ResultSlots`\<`G`\>\>

###### op7

[`Op`](#op)\<`NoInfer`\<`G`\>, `H`, `R7` & `ResultSlots`\<`H`\>\>

###### op8

[`Op`](#op)\<`NoInfer`\<`H`\>, `I`, `R8` & `ResultSlots`\<`I`\>\>

###### op9

[`Op`](#op)\<`NoInfer`\<`I`\>, `J`, `R9` & `ResultSlots`\<`J`\>\>

###### op10

[`Op`](#op)\<`NoInfer`\<`J`\>, `K`, `R10` & `ResultSlots`\<`K`\>\>

##### Returns

[`ResultTuple`](#resulttuple)\<`K`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

***

### pipeAsync()

#### Call Signature

> **pipeAsync**\<`A`, `Source`\>(`source`): `Promise`\<[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Awaited`\<`Source`\>\>\>\>

Defined in: [flow/flow.ts:797](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L797)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

##### Parameters

###### source

`Source` & `NoAny`\<`Source`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<[`OkValue`](#okvalue)\<`Awaited`\<`Source`\>\>\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `Source`, `R1`\>(`source`, `op1`): `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

Defined in: [flow/flow.ts:801](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L801)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `Source`, `R1`, `R2`\>(`source`, `op1`, `op2`): `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

Defined in: [flow/flow.ts:811](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L811)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `Source`, `R1`, `R2`, `R3`\>(`source`, `op1`, `op2`, `op3`): `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

Defined in: [flow/flow.ts:824](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L824)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `Source`, `R1`, `R2`, `R3`, `R4`\>(`source`, `op1`, `op2`, `op3`, `op4`): `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

Defined in: [flow/flow.ts:840](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L840)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\> = [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

###### op4

[`AnyOp`](#anyop)\<`NoInfer`\<`D`\>, `E`, `R4` & `AsyncSlots`\<`E`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`): `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

Defined in: [flow/flow.ts:859](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L859)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\> = [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\> = [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

###### op4

[`AnyOp`](#anyop)\<`NoInfer`\<`D`\>, `E`, `R4` & `AsyncSlots`\<`E`\>\>

###### op5

[`AnyOp`](#anyop)\<`NoInfer`\<`E`\>, `F`, `R5` & `AsyncSlots`\<`F`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`): `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

Defined in: [flow/flow.ts:881](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L881)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\> = [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\> = [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\> = [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

###### op4

[`AnyOp`](#anyop)\<`NoInfer`\<`D`\>, `E`, `R4` & `AsyncSlots`\<`E`\>\>

###### op5

[`AnyOp`](#anyop)\<`NoInfer`\<`E`\>, `F`, `R5` & `AsyncSlots`\<`F`\>\>

###### op6

[`AnyOp`](#anyop)\<`NoInfer`\<`F`\>, `G`, `R6` & `AsyncSlots`\<`G`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`): `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

Defined in: [flow/flow.ts:906](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L906)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\> = [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\> = [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\> = [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\> = [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

###### op4

[`AnyOp`](#anyop)\<`NoInfer`\<`D`\>, `E`, `R4` & `AsyncSlots`\<`E`\>\>

###### op5

[`AnyOp`](#anyop)\<`NoInfer`\<`E`\>, `F`, `R5` & `AsyncSlots`\<`F`\>\>

###### op6

[`AnyOp`](#anyop)\<`NoInfer`\<`F`\>, `G`, `R6` & `AsyncSlots`\<`G`\>\>

###### op7

[`AnyOp`](#anyop)\<`NoInfer`\<`G`\>, `H`, `R7` & `AsyncSlots`\<`H`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`): `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\>

Defined in: [flow/flow.ts:934](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L934)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\> = [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\> = [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\> = [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\> = [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

###### R8

`R8` *extends* [`ResultTuple`](#resulttuple)\<`I`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\> = [`ResultTuple`](#resulttuple)\<`I`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

###### op4

[`AnyOp`](#anyop)\<`NoInfer`\<`D`\>, `E`, `R4` & `AsyncSlots`\<`E`\>\>

###### op5

[`AnyOp`](#anyop)\<`NoInfer`\<`E`\>, `F`, `R5` & `AsyncSlots`\<`F`\>\>

###### op6

[`AnyOp`](#anyop)\<`NoInfer`\<`F`\>, `G`, `R6` & `AsyncSlots`\<`G`\>\>

###### op7

[`AnyOp`](#anyop)\<`NoInfer`\<`G`\>, `H`, `R7` & `AsyncSlots`\<`H`\>\>

###### op8

[`AnyOp`](#anyop)\<`NoInfer`\<`H`\>, `I`, `R8` & `AsyncSlots`\<`I`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`, `R9`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`): `Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\>

Defined in: [flow/flow.ts:965](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L965)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### J

`J`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\> = [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\> = [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\> = [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\> = [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

###### R8

`R8` *extends* [`ResultTuple`](#resulttuple)\<`I`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\> = [`ResultTuple`](#resulttuple)\<`I`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\>

###### R9

`R9` *extends* [`ResultTuple`](#resulttuple)\<`J`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\> = [`ResultTuple`](#resulttuple)\<`J`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

###### op4

[`AnyOp`](#anyop)\<`NoInfer`\<`D`\>, `E`, `R4` & `AsyncSlots`\<`E`\>\>

###### op5

[`AnyOp`](#anyop)\<`NoInfer`\<`E`\>, `F`, `R5` & `AsyncSlots`\<`F`\>\>

###### op6

[`AnyOp`](#anyop)\<`NoInfer`\<`F`\>, `G`, `R6` & `AsyncSlots`\<`G`\>\>

###### op7

[`AnyOp`](#anyop)\<`NoInfer`\<`G`\>, `H`, `R7` & `AsyncSlots`\<`H`\>\>

###### op8

[`AnyOp`](#anyop)\<`NoInfer`\<`H`\>, `I`, `R8` & `AsyncSlots`\<`I`\>\>

###### op9

[`AnyOp`](#anyop)\<`NoInfer`\<`I`\>, `J`, `R9` & `AsyncSlots`\<`J`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K`, `Source`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`, `R9`, `R10`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`, `op10`): `Promise`\<[`ResultTuple`](#resulttuple)\<`K`\>\>

Defined in: [flow/flow.ts:999](https://github.com/pencroff-lab/kore/blob/v0.7.1/src/flow/flow.ts#L999)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### E

`E`

###### F

`F`

###### G

`G`

###### H

`H`

###### I

`I`

###### J

`J`

###### K

`K`

###### Source

`Source` *extends* [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\> = [`ResultTuple`](#resulttuple)\<`A`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

###### R1

`R1` *extends* [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\> = [`ResultTuple`](#resulttuple)\<`B`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

###### R2

`R2` *extends* [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\> = [`ResultTuple`](#resulttuple)\<`C`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

###### R3

`R3` *extends* [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\> = [`ResultTuple`](#resulttuple)\<`D`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

###### R4

`R4` *extends* [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\> = [`ResultTuple`](#resulttuple)\<`E`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

###### R5

`R5` *extends* [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\> = [`ResultTuple`](#resulttuple)\<`F`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

###### R6

`R6` *extends* [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\> = [`ResultTuple`](#resulttuple)\<`G`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

###### R7

`R7` *extends* [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\> = [`ResultTuple`](#resulttuple)\<`H`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

###### R8

`R8` *extends* [`ResultTuple`](#resulttuple)\<`I`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\> = [`ResultTuple`](#resulttuple)\<`I`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\>

###### R9

`R9` *extends* [`ResultTuple`](#resulttuple)\<`J`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\> = [`ResultTuple`](#resulttuple)\<`J`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\>

###### R10

`R10` *extends* [`ResultTuple`](#resulttuple)\<`K`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`K`\>\> = [`ResultTuple`](#resulttuple)\<`K`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`K`\>\>

##### Parameters

###### source

`Source` & AsyncSlots\<A\> & NoAny\<Source\>

###### op1

[`AnyOp`](#anyop)\<`NoInfer`\<`A`\>, `B`, `R1` & `AsyncSlots`\<`B`\>\>

###### op2

[`AnyOp`](#anyop)\<`NoInfer`\<`B`\>, `C`, `R2` & `AsyncSlots`\<`C`\>\>

###### op3

[`AnyOp`](#anyop)\<`NoInfer`\<`C`\>, `D`, `R3` & `AsyncSlots`\<`D`\>\>

###### op4

[`AnyOp`](#anyop)\<`NoInfer`\<`D`\>, `E`, `R4` & `AsyncSlots`\<`E`\>\>

###### op5

[`AnyOp`](#anyop)\<`NoInfer`\<`E`\>, `F`, `R5` & `AsyncSlots`\<`F`\>\>

###### op6

[`AnyOp`](#anyop)\<`NoInfer`\<`F`\>, `G`, `R6` & `AsyncSlots`\<`G`\>\>

###### op7

[`AnyOp`](#anyop)\<`NoInfer`\<`G`\>, `H`, `R7` & `AsyncSlots`\<`H`\>\>

###### op8

[`AnyOp`](#anyop)\<`NoInfer`\<`H`\>, `I`, `R8` & `AsyncSlots`\<`I`\>\>

###### op9

[`AnyOp`](#anyop)\<`NoInfer`\<`I`\>, `J`, `R9` & `AsyncSlots`\<`J`\>\>

###### op10

[`AnyOp`](#anyop)\<`NoInfer`\<`J`\>, `K`, `R10` & `AsyncSlots`\<`K`\>\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`K`\>\>

##### See

[pipe](#pipe) for the synchronous version
