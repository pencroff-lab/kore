[@pencroff-lab/kore](README.md) / flow

# flow

Result tuples as free functions — the tuple tier of the package.

`flow` operates directly on `ResultTuple<T>`: `[value, null]` on success,
`[null, Err]` on failure. There is no container to construct or unwrap, so a
result destructures at any point and every operation is a plain function.

**Key concepts:**
- **One fallible protocol** — every fallible callback returns a `ResultTuple`.
  The error slot is the only failure signal; no operator inspects a value's
  runtime shape. `map` is the single exception: its return is always data.
- **`ok` / `fail` are the boundary** — `ok(err)` and `ok(tuple)` carry
  error- or tuple-shaped values as successful data.
- **Exception boundaries** — `attempt`/`attemptAsync`, every callback-taking
  operation, and every pipeline stage convert a throw into `Err.from(caught)`.
- **Input protection** — a pipeline copies its source once on entry, and tuple
  callbacks receive a copy. Payloads are never cloned.
- **Error enrichment** lives on `Err`: use `mapErr`/`onErr` and chain
  `wrap`, `withCode`, `withMetadata` inside the callback.

## See

[flow.examples.test.ts](../examples/flow.md) for usage patterns

## Type Aliases

### AnyOp()

> **AnyOp**\<`In`, `Out`\> = (`tuple`) => [`ResultTuple`](#resulttuple)\<`Out`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Defined in: [flow/flow.types.ts:32](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.types.ts#L32)

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

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

#### Returns

[`ResultTuple`](#resulttuple)\<`Out`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

***

### AsyncSource

> **AsyncSource**\<`T`\> = [`ResultTuple`](#resulttuple)\<`T`\> \| `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

Defined in: [flow/flow.types.ts:37](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.types.ts#L37)

Source accepted by `pipeAsync`: a tuple, or a promise of one.

#### Type Parameters

##### T

`T`

***

### OkValue

> **OkValue**\<`R`\> = `R` *extends* readonly \[infer V, `null`\] ? `V` : `never`

Defined in: [flow/flow.types.ts:42](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.types.ts#L42)

Success type carried by a result tuple.

#### Type Parameters

##### R

`R`

***

### OkValues

> **OkValues**\<`T`\> = `{ -readonly [K in keyof T]: OkValue<T[K]> }`

Defined in: [flow/flow.types.ts:48](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.types.ts#L48)

Success types of a collection of result tuples, positionally.
A tuple of results maps to a tuple of values; an array maps to an array.

#### Type Parameters

##### T

`T` *extends* readonly `unknown`[]

***

### Op()

> **Op**\<`In`, `Out`\> = (`tuple`) => [`ResultTuple`](#resulttuple)\<`Out`\>

Defined in: [flow/flow.types.ts:11](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.types.ts#L11)

Synchronous pipeline stage: tuple in, tuple out.

#### Type Parameters

##### In

`In`

Input success type

##### Out

`Out`

Output success type

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

#### Returns

[`ResultTuple`](#resulttuple)\<`Out`\>

***

### OpAsync()

> **OpAsync**\<`In`, `Out`\> = (`tuple`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Defined in: [flow/flow.types.ts:19](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.types.ts#L19)

Asynchronous pipeline stage.

#### Type Parameters

##### In

`In`

Input success type

##### Out

`Out`

Output success type

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

***

### ResultTuple

> **ResultTuple**\<`T`\> = readonly \[`T`, `null`\] \| readonly \[`null`, [`Err`](err.md#err)\]

Defined in: [types/common.types.ts:15](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/common.types.ts#L15)

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

Defined in: [flow/flow.ts:709](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L709)

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

Defined in: [flow/flow.ts:738](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L738)

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

> **attempt**\<`T`\>(`fn`): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [flow/flow.ts:103](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L103)

Run a fallible callback, converting a throw into a failure tuple.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => [`ResultTuple`](#resulttuple)\<`T`\>

Callback returning a result tuple

#### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

The callback's tuple, or `Err.from(caught)` as a failure

***

### attemptAsync()

> **attemptAsync**\<`T`\>(`fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

Defined in: [flow/flow.ts:117](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L117)

Async counterpart of `attempt()`. Converts throws and rejections.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

Async callback returning a result tuple

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

Promise of the callback's tuple, or of a failure

***

### copy()

> **copy**\<`T`\>(`tuple`): `T`

Defined in: [flow/flow.ts:51](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L51)

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

Defined in: [flow/flow.ts:670](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L670)

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

Defined in: [flow/flow.ts:266](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L266)

Run a side effect on either channel.

The callback receives the returned copy, not the caller's tuple, and its
normal return value is ignored. A throw becomes the failure.

#### Type Parameters

##### T

`T`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

Source result

##### fn

(`tuple`) => `void`

Side effect receiving the output tuple

#### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

The output copy, or a caught throw as a failure

***

### effectAsync()

> **effectAsync**\<`T`\>(`tuple`, `fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`T`\>\>

Defined in: [flow/flow.ts:286](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L286)

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

Defined in: [flow/flow.ts:686](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L686)

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

> **ensure**\<`T`, `S`\>(`tuple`, `predicate`, `toErr`): [`ResultTuple`](#resulttuple)\<`S`\>

Defined in: [flow/flow.ts:311](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L311)

Validate a success value, optionally refining its type.

A passing predicate returns the original success tuple untouched; a failing
one builds the error lazily. A throw from either callback becomes the
failure. A failure input passes through and calls neither callback.

#### Type Parameters

##### T

`T`

##### S

`S` = `T`

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

Source result

##### predicate

Type predicate or boolean test

(`value`) => `value is S` | (`value`) => `boolean`

##### toErr

(`value`) => [`Err`](err.md#err)

Error factory, called only when the predicate fails

#### Returns

[`ResultTuple`](#resulttuple)\<`S`\>

The original success, a constructed failure, or a caught throw

***

### fail()

> **fail**(`error`, `code?`): [`ResultTuple`](#resulttuple)\<`never`\>

Defined in: [flow/flow.ts:90](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L90)

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

> **flatMap**\<`In`, `Out`\>(`tuple`, `fn`): [`ResultTuple`](#resulttuple)\<`Out`\>

Defined in: [flow/flow.ts:183](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L183)

Chain a fallible callback on the success channel.

The callback's tuple is returned by reference, so a tuple-returning callee
composes directly: `flatMap(ok(project), readConfig)`. A failure passes
through by reference.

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

(`value`) => [`ResultTuple`](#resulttuple)\<`Out`\>

Callback returning a result tuple

#### Returns

[`ResultTuple`](#resulttuple)\<`Out`\>

The callback's tuple, the original failure, or a caught throw

***

### flatMapAsync()

> **flatMapAsync**\<`In`, `Out`\>(`tuple`, `fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Defined in: [flow/flow.ts:202](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L202)

Async counterpart of `flatMap()`.

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

(`value`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Async callback returning a result tuple

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Promise of the resulting tuple

***

### fromJSON()

> **fromJSON**\<`T`\>(`payload`): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [flow/flow.ts:778](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L778)

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

Defined in: [flow/flow.ts:141](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L141)

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

Defined in: [flow/flow.ts:160](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L160)

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

> **mapErr**\<`In`, `Out`\>(`tuple`, `fn`): [`ResultTuple`](#resulttuple)\<`In` \| `Out`\>

Defined in: [flow/flow.ts:225](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L225)

Transform or recover from a failure.

`fail(error.wrap(...))` replaces the error, `ok(value)` recovers, and
`ok(error)` recovers with the error as data. A success passes through by
reference.

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

(`error`) => [`ResultTuple`](#resulttuple)\<`Out`\>

Callback receiving the error and returning a result tuple

#### Returns

[`ResultTuple`](#resulttuple)\<`In` \| `Out`\>

The callback's tuple, the original success, or a caught throw

***

### mapErrAsync()

> **mapErrAsync**\<`In`, `Out`\>(`tuple`, `fn`): `Promise`\<[`ResultTuple`](#resulttuple)\<`In` \| `Out`\>\>

Defined in: [flow/flow.ts:244](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L244)

Async counterpart of `mapErr()`.

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

(`error`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Async callback receiving the error

#### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`In` \| `Out`\>\>

Promise of the resulting tuple

***

### ok()

#### Call Signature

> **ok**(): [`ResultTuple`](#resulttuple)\<`void`\>

Defined in: [flow/flow.ts:60](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L60)

Create a success tuple with no value.

##### Returns

[`ResultTuple`](#resulttuple)\<`void`\>

`[undefined, null]`

#### Call Signature

> **ok**\<`T`\>(`value`): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [flow/flow.ts:71](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L71)

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

> **onErr**\<`Out`\>(`fn`): \<`In`\>(`tuple`) => [`ResultTuple`](#resulttuple)\<`Out` \| `In`\>

Defined in: [flow/flow.ts:365](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L365)

Stage running a callback on the error channel.

The stage — not this factory — is generic in the pipeline's success type. An
error callback offers no site from which `In` could be inferred, so a factory
type parameter would collapse to `unknown` as soon as the stage is stored in
a variable, widening the whole pipeline.

#### Type Parameters

##### Out

`Out`

#### Parameters

##### fn

(`error`) => [`ResultTuple`](#resulttuple)\<`Out`\>

Callback receiving the error and returning a result tuple

#### Returns

A synchronous pipeline stage that preserves the success type

> \<`In`\>(`tuple`): [`ResultTuple`](#resulttuple)\<`Out` \| `In`\>

##### Type Parameters

###### In

`In`

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`Out` \| `In`\>

***

### onErrAsync()

> **onErrAsync**\<`Out`\>(`fn`): \<`In`\>(`tuple`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`Out` \| `In`\>\>

Defined in: [flow/flow.ts:377](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L377)

Async counterpart of `onErr()`.

#### Type Parameters

##### Out

`Out`

#### Parameters

##### fn

(`error`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Async callback receiving the error

#### Returns

An asynchronous pipeline stage that preserves the success type

> \<`In`\>(`tuple`): `Promise`\<[`ResultTuple`](#resulttuple)\<`Out` \| `In`\>\>

##### Type Parameters

###### In

`In`

##### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`Out` \| `In`\>\>

***

### onOk()

> **onOk**\<`In`, `Out`\>(`fn`): [`Op`](#op)\<`In`, `Out`\>

Defined in: [flow/flow.ts:336](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L336)

Stage running a fallible callback on the success value.

#### Type Parameters

##### In

`In`

##### Out

`Out`

#### Parameters

##### fn

(`value`) => [`ResultTuple`](#resulttuple)\<`Out`\>

Callback returning a result tuple

#### Returns

[`Op`](#op)\<`In`, `Out`\>

A synchronous pipeline stage

***

### onOkAsync()

> **onOkAsync**\<`In`, `Out`\>(`fn`): [`OpAsync`](#opasync)\<`In`, `Out`\>

Defined in: [flow/flow.ts:348](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L348)

Async counterpart of `onOk()`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

#### Parameters

##### fn

(`value`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Async callback returning a result tuple

#### Returns

[`OpAsync`](#opasync)\<`In`, `Out`\>

An asynchronous pipeline stage

***

### onTuple()

> **onTuple**\<`In`, `Out`\>(`fn`): [`Op`](#op)\<`In`, `Out`\>

Defined in: [flow/flow.ts:389](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L389)

Stage running a callback on a copy of the whole tuple, on either channel.

#### Type Parameters

##### In

`In`

##### Out

`Out`

#### Parameters

##### fn

(`tuple`) => [`ResultTuple`](#resulttuple)\<`Out`\>

Callback receiving a tuple copy and returning a result tuple

#### Returns

[`Op`](#op)\<`In`, `Out`\>

A synchronous pipeline stage

***

### onTupleAsync()

> **onTupleAsync**\<`In`, `Out`\>(`fn`): [`OpAsync`](#opasync)\<`In`, `Out`\>

Defined in: [flow/flow.ts:401](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L401)

Async counterpart of `onTuple()`.

#### Type Parameters

##### In

`In`

##### Out

`Out`

#### Parameters

##### fn

(`tuple`) => `Promise`\<[`ResultTuple`](#resulttuple)\<`Out`\>\>

Async callback receiving a tuple copy

#### Returns

[`OpAsync`](#opasync)\<`In`, `Out`\>

An asynchronous pipeline stage

***

### pipe()

#### Call Signature

> **pipe**\<`A`\>(`source`): [`ResultTuple`](#resulttuple)\<`A`\>

Defined in: [flow/flow.ts:420](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L420)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

##### Type Parameters

###### A

`A`

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`A`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`\>(`source`, `op1`): [`ResultTuple`](#resulttuple)\<`B`\>

Defined in: [flow/flow.ts:421](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L421)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

##### Type Parameters

###### A

`A`

###### B

`B`

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`B`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`\>(`source`, `op1`, `op2`): [`ResultTuple`](#resulttuple)\<`C`\>

Defined in: [flow/flow.ts:425](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L425)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`C`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`\>(`source`, `op1`, `op2`, `op3`): [`ResultTuple`](#resulttuple)\<`D`\>

Defined in: [flow/flow.ts:430](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L430)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

##### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`D`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`\>(`source`, `op1`, `op2`, `op3`, `op4`): [`ResultTuple`](#resulttuple)\<`E`\>

Defined in: [flow/flow.ts:436](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L436)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

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

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

###### op4

[`Op`](#op)\<`D`, `E`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`E`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`): [`ResultTuple`](#resulttuple)\<`F`\>

Defined in: [flow/flow.ts:443](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L443)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

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

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

###### op4

[`Op`](#op)\<`D`, `E`\>

###### op5

[`Op`](#op)\<`E`, `F`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`F`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`): [`ResultTuple`](#resulttuple)\<`G`\>

Defined in: [flow/flow.ts:451](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L451)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

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

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

###### op4

[`Op`](#op)\<`D`, `E`\>

###### op5

[`Op`](#op)\<`E`, `F`\>

###### op6

[`Op`](#op)\<`F`, `G`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`G`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`): [`ResultTuple`](#resulttuple)\<`H`\>

Defined in: [flow/flow.ts:460](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L460)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

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

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

###### op4

[`Op`](#op)\<`D`, `E`\>

###### op5

[`Op`](#op)\<`E`, `F`\>

###### op6

[`Op`](#op)\<`F`, `G`\>

###### op7

[`Op`](#op)\<`G`, `H`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`H`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`): [`ResultTuple`](#resulttuple)\<`I`\>

Defined in: [flow/flow.ts:470](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L470)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

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

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

###### op4

[`Op`](#op)\<`D`, `E`\>

###### op5

[`Op`](#op)\<`E`, `F`\>

###### op6

[`Op`](#op)\<`F`, `G`\>

###### op7

[`Op`](#op)\<`G`, `H`\>

###### op8

[`Op`](#op)\<`H`, `I`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`I`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`): [`ResultTuple`](#resulttuple)\<`J`\>

Defined in: [flow/flow.ts:481](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L481)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

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

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

###### op4

[`Op`](#op)\<`D`, `E`\>

###### op5

[`Op`](#op)\<`E`, `F`\>

###### op6

[`Op`](#op)\<`F`, `G`\>

###### op7

[`Op`](#op)\<`G`, `H`\>

###### op8

[`Op`](#op)\<`H`, `I`\>

###### op9

[`Op`](#op)\<`I`, `J`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`J`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`, `op10`): [`ResultTuple`](#resulttuple)\<`K`\>

Defined in: [flow/flow.ts:493](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L493)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

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

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`A`\>

###### op1

[`Op`](#op)\<`A`, `B`\>

###### op2

[`Op`](#op)\<`B`, `C`\>

###### op3

[`Op`](#op)\<`C`, `D`\>

###### op4

[`Op`](#op)\<`D`, `E`\>

###### op5

[`Op`](#op)\<`E`, `F`\>

###### op6

[`Op`](#op)\<`F`, `G`\>

###### op7

[`Op`](#op)\<`G`, `H`\>

###### op8

[`Op`](#op)\<`H`, `I`\>

###### op9

[`Op`](#op)\<`I`, `J`\>

###### op10

[`Op`](#op)\<`J`, `K`\>

##### Returns

[`ResultTuple`](#resulttuple)\<`K`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

#### Call Signature

> **pipe**(`source`, ...`ops`): [`ResultTuple`](#resulttuple)\<`unknown`\>

Defined in: [flow/flow.ts:508](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L508)

Run synchronous stages over a result tuple.

The source is copied once on entry, and each stage is caught separately so a
later `onErr` stage can recover. Typed through ten stages; past that the
result widens to `ResultTuple<unknown>`.

##### Parameters

###### source

[`ResultTuple`](#resulttuple)\<`unknown`\>

###### ops

...[`Op`](#op)\<`any`, `any`\>[]

##### Returns

[`ResultTuple`](#resulttuple)\<`unknown`\>

##### See

[pipeAsync](#pipeasync) for asynchronous and mixed stages

***

### pipeAsync()

#### Call Signature

> **pipeAsync**\<`A`\>(`source`): `Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

Defined in: [flow/flow.ts:540](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L540)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`A`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`\>(`source`, `op1`): `Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

Defined in: [flow/flow.ts:541](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L541)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Type Parameters

###### A

`A`

###### B

`B`

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`B`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`\>(`source`, `op1`, `op2`): `Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

Defined in: [flow/flow.ts:545](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L545)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`C`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`\>(`source`, `op1`, `op2`, `op3`): `Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

Defined in: [flow/flow.ts:550](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L550)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`D`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`\>(`source`, `op1`, `op2`, `op3`, `op4`): `Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

Defined in: [flow/flow.ts:556](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L556)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

###### op4

[`AnyOp`](#anyop)\<`D`, `E`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`E`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`): `Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

Defined in: [flow/flow.ts:563](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L563)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

###### op4

[`AnyOp`](#anyop)\<`D`, `E`\>

###### op5

[`AnyOp`](#anyop)\<`E`, `F`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`F`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`): `Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

Defined in: [flow/flow.ts:571](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L571)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

###### op4

[`AnyOp`](#anyop)\<`D`, `E`\>

###### op5

[`AnyOp`](#anyop)\<`E`, `F`\>

###### op6

[`AnyOp`](#anyop)\<`F`, `G`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`G`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`): `Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

Defined in: [flow/flow.ts:580](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L580)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

###### op4

[`AnyOp`](#anyop)\<`D`, `E`\>

###### op5

[`AnyOp`](#anyop)\<`E`, `F`\>

###### op6

[`AnyOp`](#anyop)\<`F`, `G`\>

###### op7

[`AnyOp`](#anyop)\<`G`, `H`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`H`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`): `Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\>

Defined in: [flow/flow.ts:590](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L590)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

###### op4

[`AnyOp`](#anyop)\<`D`, `E`\>

###### op5

[`AnyOp`](#anyop)\<`E`, `F`\>

###### op6

[`AnyOp`](#anyop)\<`F`, `G`\>

###### op7

[`AnyOp`](#anyop)\<`G`, `H`\>

###### op8

[`AnyOp`](#anyop)\<`H`, `I`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`I`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`): `Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\>

Defined in: [flow/flow.ts:601](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L601)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

###### op4

[`AnyOp`](#anyop)\<`D`, `E`\>

###### op5

[`AnyOp`](#anyop)\<`E`, `F`\>

###### op6

[`AnyOp`](#anyop)\<`F`, `G`\>

###### op7

[`AnyOp`](#anyop)\<`G`, `H`\>

###### op8

[`AnyOp`](#anyop)\<`H`, `I`\>

###### op9

[`AnyOp`](#anyop)\<`I`, `J`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`J`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K`\>(`source`, `op1`, `op2`, `op3`, `op4`, `op5`, `op6`, `op7`, `op8`, `op9`, `op10`): `Promise`\<[`ResultTuple`](#resulttuple)\<`K`\>\>

Defined in: [flow/flow.ts:613](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L613)

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

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`A`\>

###### op1

[`AnyOp`](#anyop)\<`A`, `B`\>

###### op2

[`AnyOp`](#anyop)\<`B`, `C`\>

###### op3

[`AnyOp`](#anyop)\<`C`, `D`\>

###### op4

[`AnyOp`](#anyop)\<`D`, `E`\>

###### op5

[`AnyOp`](#anyop)\<`E`, `F`\>

###### op6

[`AnyOp`](#anyop)\<`F`, `G`\>

###### op7

[`AnyOp`](#anyop)\<`G`, `H`\>

###### op8

[`AnyOp`](#anyop)\<`H`, `I`\>

###### op9

[`AnyOp`](#anyop)\<`I`, `J`\>

###### op10

[`AnyOp`](#anyop)\<`J`, `K`\>

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`K`\>\>

##### See

[pipe](#pipe) for the synchronous version

#### Call Signature

> **pipeAsync**(`source`, ...`ops`): `Promise`\<[`ResultTuple`](#resulttuple)\<`unknown`\>\>

Defined in: [flow/flow.ts:628](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/flow/flow.ts#L628)

Run synchronous and asynchronous stages over a result tuple or a promise of
one.

A rejected source enters the failure channel before the first stage, so a
later `onErr` stage can still recover. Typed through ten stages.

##### Parameters

###### source

[`AsyncSource`](#asyncsource)\<`unknown`\>

###### ops

...[`AnyOp`](#anyop)\<`any`, `any`\>[]

##### Returns

`Promise`\<[`ResultTuple`](#resulttuple)\<`unknown`\>\>

##### See

[pipe](#pipe) for the synchronous version
