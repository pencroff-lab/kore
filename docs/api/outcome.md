[@pencroff-lab/kore](README.md) / outcome

# outcome

Monadic container for safe success/error propagation using tuple-first design.

`Outcome<T>` wraps a `ResultTuple<T>` — either `[T, null]` (success) or
`[null, Err]` (error) — and provides chainable transforms (`map`, `flatMap`,
`pipe`), combinators (`all`, `any`), and terminal operations (`toTuple`,
`defaultTo`, `either`).

**Key concepts:**
- **Tuple-first** — `toTuple()` is the primary extraction; destructure as `[val, err]`.
- **Immutability** — every transform returns a new `Outcome`, never mutates.
- **map vs flatMap** — `map` takes `(T) => U` and cannot fail; `flatMap` takes
  `(T) => Outcome<U>` and can. Tuple/`Err` returns are data in `map`, never control flow.
- **Value protocol** — in `from`/`fromAsync`, `flatMap`, `mapErr` and `pipe` a returned
  `Err` is a failure, a returned `Outcome` passes through, and anything else is the
  success value. Use `Outcome.ok(x)` to carry an `Err` or an `Outcome` as a value.
- **Tuple protocol** — `fromTuple`/`fromTupleAsync` are the only entry points that read
  `[value, error]` as control flow; everywhere else a tuple is an ordinary array value.
- **Auto-catch** — `from`, `fromTuple`, `map`, `flatMap` and `pipe` catch thrown exceptions and wrap them as `Err`.
- **Combinators** — `all` collects every error (non-short-circuit), `any` short-circuits on first success.

**Deprecated since v0.7.0.** The class tier is frozen from v0.7.0 onward; the
`flow` tier is the supported API. v0.7.0 itself changed this class — see the
changelog's breaking changes before upgrading from v0.6.x. `flow` works on
the same `ResultTuple` with free functions, so migration is call-site local:
see the migration map in the README.

## See

[outcome.examples.test.ts](../examples/outcome.md) for usage patterns

## Classes

### ~~Outcome~~

Defined in: [types/outcome.ts:60](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L60)

A monadic container for handling success and error states.
Uses tuples as the primary interface; `toTuple()` is the sole extraction.

The container is immutable — every transform returns a new instance. The value
it carries is yours: it is never copied or frozen, so mutating it after
wrapping is visible through the `Outcome`. (`Err.metadata` is copied and frozen
because errors are a cold path; `T` is not.)

#### Deprecated

since v0.7.0 — superseded by the `flow` tier. The class stays
exported and its shape is frozen from v0.7.0 onward, but v0.7.0 is itself a
breaking release for it: removed accessors, the callback protocol split, and
nominal `Err` recognition. Check the changelog when upgrading from v0.6.x.
Move to the free functions over `ResultTuple` (`ok`, `fail`, `map`, `flatMap`,
`mapErr`, `pipe`, `all`, `any`, `defaultTo`, `either`); `toTuple()` is the bridge.

#### Type Parameters

##### T

`T`

The type of the success value

#### Methods

##### ~~defaultTo()~~

###### Call Signature

> **defaultTo**(`fallback`): `T`

Defined in: [types/outcome.ts:574](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L574)

Extract the success value, or use a fallback value on error.

###### Parameters

###### fallback

`T`

The fallback value to use if in error state

###### Returns

`T`

The success value or the fallback

###### Throws

If the outcome is an error and computing fallback throws

###### Call Signature

> **defaultTo**(`handler`): `T`

Defined in: [types/outcome.ts:583](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L583)

Extract the success value, or compute a fallback from the error.

###### Parameters

###### handler

(`error`) => `T`

Function to compute fallback from error

###### Returns

`T`

The success value or computed fallback

###### Throws

If the handler throws, the exception propagates to the caller

###### Call Signature

> **defaultTo**(`fallback`, `asValue`): `T`

Defined in: [types/outcome.ts:594](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L594)

Extract the success value, or use the provided fallback value.

Use `asValue: true` when T is a function type to avoid treating it as a handler.

###### Parameters

###### fallback

`T`

The fallback value to use when error

###### asValue

`true`

Must be `true` to use this overload

###### Returns

`T`

The success value or the fallback

##### ~~effect()~~

> **effect**(`fn`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:534](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L534)

Execute a side effect with access to the full tuple.

Returns `this` unchanged for chaining.
If the callback throws, the exception is caught and the Outcome becomes an error.

###### Parameters

###### fn

(`tuple`) => `void`

Side effect function receiving the tuple

###### Returns

[`Outcome`](#outcome)\<`T`\>

This Outcome (for chaining), or error Outcome if callback throws

###### See

[effectAsync](#effectasync) for the async version

##### ~~effectAsync()~~

> **effectAsync**(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Defined in: [types/outcome.ts:551](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L551)

Async version of `effect()`.

###### Parameters

###### fn

(`tuple`) => `Promise`\<`void`\>

Async side effect function

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Promise of this Outcome

###### See

[effect](#effect) for the synchronous version

##### ~~either()~~

> **either**\<`U`\>(`onOk`, `onErr`): `U`

Defined in: [types/outcome.ts:618](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L618)

Transform the Outcome into a final value by handling both cases.

###### Type Parameters

###### U

`U`

###### Parameters

###### onOk

(`value`) => `U`

Function to transform success value into final result

###### onErr

(`error`) => `U`

Function to transform error into final result

###### Returns

`U`

The transformed value (not wrapped in Outcome)

###### Throws

If either callback throws, the exception propagates to the caller

##### ~~flatMap()~~

> **flatMap**\<`R`\>(`fn`): [`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>

Defined in: [types/outcome.ts:444](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L444)

Chain a callback that can fail, flattening the result.

Follows the value protocol: a returned `Outcome` is flattened, a returned
`Err` becomes the failure, anything else is the success value. Only called if
successful; errors pass through unchanged and a throw is caught and wrapped.

###### Type Parameters

###### R

`R`

###### Parameters

###### fn

(`value`) => `R`

Function receiving the success value, returning an Outcome

###### Returns

[`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>

The Outcome returned by the callback, or the original error

###### See

 - [flatMapAsync](#flatmapasync) for the async version
 - [map](#map) for a total callback whose return is never inspected

##### ~~flatMapAsync()~~

> **flatMapAsync**\<`R`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>\>

Defined in: [types/outcome.ts:462](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L462)

Async version of `flatMap()`.

###### Type Parameters

###### R

`R`

###### Parameters

###### fn

(`value`) => `Promise`\<`R`\>

Async function returning a Promise of an Outcome

###### Returns

`Promise`\<[`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>\>

Promise of the flattened Outcome

###### See

[flatMap](#flatmap) for the synchronous version

##### ~~map()~~

> **map**\<`U`\>(`fn`): [`Outcome`](#outcome)\<`U`\>

Defined in: [types/outcome.ts:403](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L403)

Transform the success value with a plain function.

The return value is carried as-is — a tuple, an `Err`, or `null` stays the
success value. Use [flatMap](#flatmap) to return an `Outcome` that can fail.

Only called if successful. Errors pass through unchanged.
If the callback throws, the exception is caught and wrapped.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`value`) => `U`

Transformation function receiving the success value

###### Returns

[`Outcome`](#outcome)\<`U`\>

New Outcome with the transformed value, or the original error

###### See

 - [mapAsync](#mapasync) for the async version
 - [flatMap](#flatmap) for callbacks that return an Outcome
 - [mapErr](#maperr) for transforming or recovering from errors

##### ~~mapAsync()~~

> **mapAsync**\<`U`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Defined in: [types/outcome.ts:421](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L421)

Async version of `map()`.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`value`) => `Promise`\<`U`\>

Async transformation function

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Promise of new Outcome

###### See

[map](#map) for the synchronous version

##### ~~mapErr()~~

> **mapErr**\<`R`\>(`fn`): [`Outcome`](#outcome)\<`T` \| [`ValueOf`](#valueof)\<`R`\>\>

Defined in: [types/outcome.ts:487](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L487)

Transform or recover from an error using a callback.

Follows the value protocol, so returning an `Err` re-fails and returning
anything else recovers. Only called if in error state; success passes through
unchanged.

###### Type Parameters

###### R

`R`

###### Parameters

###### fn

(`error`) => `R`

Function receiving the error

###### Returns

[`Outcome`](#outcome)\<`T` \| [`ValueOf`](#valueof)\<`R`\>\>

New Outcome with transformed error or recovered value

###### See

 - [mapErrAsync](#maperrasync) for the async version
 - [map](#map) for transforming success values

##### ~~mapErrAsync()~~

> **mapErrAsync**\<`R`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T` \| [`ValueOf`](#valueof)\<`R`\>\>\>

Defined in: [types/outcome.ts:506](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L506)

Async version of `mapErr()`.

###### Type Parameters

###### R

`R`

###### Parameters

###### fn

(`error`) => `Promise`\<`R`\>

Async function receiving the error

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T` \| [`ValueOf`](#valueof)\<`R`\>\>\>

Promise of new Outcome

###### See

[mapErr](#maperr) for the synchronous version

##### ~~pipe()~~

###### Call Signature

> **pipe**\<`A`\>(`f1`): [`Outcome`](#outcome)\<`A`\>

Defined in: [types/outcome.ts:638](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L638)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### Returns

[`Outcome`](#outcome)\<`A`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`\>(`f1`, `f2`): [`Outcome`](#outcome)\<`B`\>

Defined in: [types/outcome.ts:639](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L639)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### Returns

[`Outcome`](#outcome)\<`B`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`\>(`f1`, `f2`, `f3`): [`Outcome`](#outcome)\<`C`\>

Defined in: [types/outcome.ts:640](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L640)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### Returns

[`Outcome`](#outcome)\<`C`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`\>(`f1`, `f2`, `f3`, `f4`): [`Outcome`](#outcome)\<`D`\>

Defined in: [types/outcome.ts:645](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L645)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### Returns

[`Outcome`](#outcome)\<`D`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`\>(`f1`, `f2`, `f3`, `f4`, `f5`): [`Outcome`](#outcome)\<`E`\>

Defined in: [types/outcome.ts:651](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L651)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### Returns

[`Outcome`](#outcome)\<`E`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`): [`Outcome`](#outcome)\<`F`\>

Defined in: [types/outcome.ts:658](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L658)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### Returns

[`Outcome`](#outcome)\<`F`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`): [`Outcome`](#outcome)\<`G`\>

Defined in: [types/outcome.ts:666](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L666)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### Returns

[`Outcome`](#outcome)\<`G`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`): [`Outcome`](#outcome)\<`H`\>

Defined in: [types/outcome.ts:675](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L675)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### f8

[`PipeFn`](#pipefn)\<`G`, `H`\>

###### Returns

[`Outcome`](#outcome)\<`H`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`): [`Outcome`](#outcome)\<`I`\>

Defined in: [types/outcome.ts:685](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L685)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### f8

[`PipeFn`](#pipefn)\<`G`, `H`\>

###### f9

[`PipeFn`](#pipefn)\<`H`, `I`\>

###### Returns

[`Outcome`](#outcome)\<`I`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

###### Call Signature

> **pipe**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`, `f10`): [`Outcome`](#outcome)\<`J`\>

Defined in: [types/outcome.ts:696](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L696)

Chain synchronous transformations using tuple-based predicates.

Each predicate receives `ResultTuple<T>` and returns `CallbackReturn<U>`,
enabling mid-chain recovery or conditional transformations.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFn`](#pipefn)\<`T`, `A`\>

###### f2

[`PipeFn`](#pipefn)\<`A`, `B`\>

###### f3

[`PipeFn`](#pipefn)\<`B`, `C`\>

###### f4

[`PipeFn`](#pipefn)\<`C`, `D`\>

###### f5

[`PipeFn`](#pipefn)\<`D`, `E`\>

###### f6

[`PipeFn`](#pipefn)\<`E`, `F`\>

###### f7

[`PipeFn`](#pipefn)\<`F`, `G`\>

###### f8

[`PipeFn`](#pipefn)\<`G`, `H`\>

###### f9

[`PipeFn`](#pipefn)\<`H`, `I`\>

###### f10

[`PipeFn`](#pipefn)\<`I`, `J`\>

###### Returns

[`Outcome`](#outcome)\<`J`\>

###### See

 - [pipeAsync](#pipeasync) for async transformations
 - [map](#map) for simple success-only transformation
 - [mapErr](#maperr) for error-only transformation

##### ~~pipeAsync()~~

###### Call Signature

> **pipeAsync**\<`A`\>(`f1`): `Promise`\<[`Outcome`](#outcome)\<`A`\>\>

Defined in: [types/outcome.ts:737](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L737)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`A`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`\>(`f1`, `f2`): `Promise`\<[`Outcome`](#outcome)\<`B`\>\>

Defined in: [types/outcome.ts:738](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L738)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`B`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`\>(`f1`, `f2`, `f3`): `Promise`\<[`Outcome`](#outcome)\<`C`\>\>

Defined in: [types/outcome.ts:742](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L742)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`C`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`\>(`f1`, `f2`, `f3`, `f4`): `Promise`\<[`Outcome`](#outcome)\<`D`\>\>

Defined in: [types/outcome.ts:747](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L747)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

###### A

`A`

###### B

`B`

###### C

`C`

###### D

`D`

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`D`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`\>(`f1`, `f2`, `f3`, `f4`, `f5`): `Promise`\<[`Outcome`](#outcome)\<`E`\>\>

Defined in: [types/outcome.ts:753](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L753)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`E`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`): `Promise`\<[`Outcome`](#outcome)\<`F`\>\>

Defined in: [types/outcome.ts:760](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L760)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`F`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`): `Promise`\<[`Outcome`](#outcome)\<`G`\>\>

Defined in: [types/outcome.ts:768](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L768)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`G`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`): `Promise`\<[`Outcome`](#outcome)\<`H`\>\>

Defined in: [types/outcome.ts:777](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L777)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### f8

[`PipeFnAsync`](#pipefnasync)\<`G`, `H`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`H`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`): `Promise`\<[`Outcome`](#outcome)\<`I`\>\>

Defined in: [types/outcome.ts:787](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L787)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### f8

[`PipeFnAsync`](#pipefnasync)\<`G`, `H`\>

###### f9

[`PipeFnAsync`](#pipefnasync)\<`H`, `I`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`I`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

###### Call Signature

> **pipeAsync**\<`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`\>(`f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`, `f10`): `Promise`\<[`Outcome`](#outcome)\<`J`\>\>

Defined in: [types/outcome.ts:798](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L798)

Chain asynchronous transformations using tuple-based predicates.

Predicates are executed sequentially, each awaiting the previous result.

###### Type Parameters

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

###### Parameters

###### f1

[`PipeFnAsync`](#pipefnasync)\<`T`, `A`\>

###### f2

[`PipeFnAsync`](#pipefnasync)\<`A`, `B`\>

###### f3

[`PipeFnAsync`](#pipefnasync)\<`B`, `C`\>

###### f4

[`PipeFnAsync`](#pipefnasync)\<`C`, `D`\>

###### f5

[`PipeFnAsync`](#pipefnasync)\<`D`, `E`\>

###### f6

[`PipeFnAsync`](#pipefnasync)\<`E`, `F`\>

###### f7

[`PipeFnAsync`](#pipefnasync)\<`F`, `G`\>

###### f8

[`PipeFnAsync`](#pipefnasync)\<`G`, `H`\>

###### f9

[`PipeFnAsync`](#pipefnasync)\<`H`, `I`\>

###### f10

[`PipeFnAsync`](#pipefnasync)\<`I`, `J`\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`J`\>\>

###### See

 - [pipe](#pipe) for synchronous transformations
 - [mapAsync](#mapasync) for simple async success-only transformation
 - [mapErrAsync](#maperrasync) for async error-only transformation

##### ~~toJSON()~~

> **toJSON**(): \[`T`, `null`\] \| \[`null`, [`ErrJSON`](err.md#errjson)\]

Defined in: [types/outcome.ts:852](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L852)

Convert to JSON-serializable tuple.

###### Returns

\[`T`, `null`\] \| \[`null`, [`ErrJSON`](err.md#errjson)\]

JSON-serializable representation

###### See

[fromJSON](#fromjson) for deserializing an Outcome from JSON

##### ~~toString()~~

> **toString**(): `string`

Defined in: [types/outcome.ts:864](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L864)

Convert to a human-readable string.

###### Returns

`string`

String representation

##### ~~toTuple()~~

> **toTuple**(): [`ResultTuple`](flow.md#resulttuple)\<`T`\>

Defined in: [types/outcome.ts:841](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L841)

Extract the internal tuple.

###### Returns

[`ResultTuple`](flow.md#resulttuple)\<`T`\>

The internal ResultTuple<T>

###### See

[fromTuple](#fromtuple) for creating an Outcome from a tuple

##### ~~all()~~

> `static` **all**\<`T`\>(`outcomes`): [`Outcome`](#outcome)\<`T`[]\>

Defined in: [types/outcome.ts:305](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L305)

Combines multiple Outcomes, succeeding if all succeed with an array of values.

Non-short-circuiting: collects all errors via `addAll()`.
For empty arrays, returns `Outcome.ok([])`.

###### Type Parameters

###### T

`T`

###### Parameters

###### outcomes

[`Outcome`](#outcome)\<`T`\>[]

Array of Outcomes to combine

###### Returns

[`Outcome`](#outcome)\<`T`[]\>

Outcome containing array of all success values, or aggregate error

##### ~~any()~~

> `static` **any**\<`T`\>(`outcomes`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:335](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L335)

Return the first successful Outcome from an array.

Short-circuits on first success. Returns an aggregate error if all fail.
For empty arrays, returns an error with code `EMPTY_INPUT`.

###### Type Parameters

###### T

`T`

###### Parameters

###### outcomes

[`Outcome`](#outcome)\<`T`\>[]

Array of Outcomes to check

###### Returns

[`Outcome`](#outcome)\<`T`\>

First successful Outcome, or aggregate of all errors

##### ~~err()~~

###### Call Signature

> `static` **err**\<`T`\>(`error`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:121](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L121)

Create an error Outcome from an existing Err.

###### Type Parameters

###### T

`T` = `never`

Success type to claim, so the result chains (defaults to `never`)

###### Parameters

###### error

[`Err`](err.md#err)

The Err instance

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome in error state

###### Call Signature

> `static` **err**\<`T`\>(`message`, `code?`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:130](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L130)

Create an error Outcome from a message with optional code.

###### Type Parameters

###### T

`T` = `never`

###### Parameters

###### message

`string`

Error message

###### code?

`string`

Optional error code

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome in error state

###### Call Signature

> `static` **err**\<`T`\>(`message`, `options`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:139](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L139)

Create an error Outcome from a message with options.

###### Type Parameters

###### T

`T` = `never`

###### Parameters

###### message

`string`

Error message

###### options

[`ErrOptions`](err.md#erroptions)

Error options (code, metadata)

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome in error state

###### Call Signature

> `static` **err**\<`T`\>(`message`, `error`, `options?`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:149](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L149)

Create an error Outcome by wrapping another error.

###### Type Parameters

###### T

`T` = `never`

###### Parameters

###### message

`string`

Context message

###### error

Original error to wrap

[`Err`](err.md#err) | `Error`

###### options?

[`ErrOptions`](err.md#erroptions)

Optional additional options

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome in error state with wrapped cause

##### ~~from()~~

> `static` **from**\<`R`\>(`fn`): [`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>

Defined in: [types/outcome.ts:195](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L195)

Create an Outcome from a callback, under the value protocol.

An `Err`-valued success cannot be expressed here: `from(() => someErr)` is a
failure typed `Outcome<never>`. Use `Outcome.ok(someErr)` instead.

###### Type Parameters

###### R

`R`

###### Parameters

###### fn

() => `R`

Callback returning the success value, an `Err` or an `Outcome`

###### Returns

[`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>

Outcome carrying the resolved success value

###### See

 - [fromAsync](#fromasync) for the async version
 - [fromTuple](#fromtuple) for callbacks returning a `[value, error]` tuple
 - [err](#err) for an unconditional failure

##### ~~fromAsync()~~

> `static` **fromAsync**\<`R`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>\>

Defined in: [types/outcome.ts:211](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L211)

Create an Outcome from an async callback, under the value protocol.

###### Type Parameters

###### R

`R`

###### Parameters

###### fn

() => `Promise`\<`R`\>

Async callback returning the success value, an `Err` or an `Outcome`

###### Returns

`Promise`\<[`Outcome`](#outcome)\<[`ValueOf`](#valueof)\<`R`\>\>\>

Promise of an Outcome carrying the resolved success value

###### See

 - [from](#from) for the synchronous version
 - [fromTupleAsync](#fromtupleasync) for callbacks returning a `[value, error]` tuple

##### ~~fromJSON()~~

> `static` **fromJSON**\<`T`\>(`payload`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:273](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L273)

Create an Outcome from a JSON tuple produced by `toJSON()`.

Invalid payloads return an error Outcome rather than throwing.

###### Type Parameters

###### T

`T`

###### Parameters

###### payload

JSON tuple from `Outcome.toJSON()`

\[`null`, [`ErrJSON`](err.md#errjson)\] | \[`T`, `null`\]

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome<T>

###### See

[toJSON](#tojson) for serializing an Outcome to JSON

##### ~~fromTuple()~~

> `static` **fromTuple**\<`T`\>(`src`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:232](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L232)

Create an Outcome from a ResultTuple, or from a callback producing one.

This is the only entry point that reads `[value, error]` as control flow. The
callback form runs inside try/catch, so a throw becomes an error Outcome.

###### Type Parameters

###### T

`T`

###### Parameters

###### src

A ResultTuple<T>, or a callback returning one

[`ResultTuple`](flow.md#resulttuple)\<`T`\> | () => [`ResultTuple`](flow.md#resulttuple)\<`T`\>

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome<T>

###### See

 - [toTuple](#totuple) for extracting the tuple from an Outcome
 - [from](#from) for the value protocol

##### ~~fromTupleAsync()~~

> `static` **fromTupleAsync**\<`T`\>(`src`): `Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Defined in: [types/outcome.ts:253](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L253)

Async counterpart of `fromTuple()`.

###### Type Parameters

###### T

`T`

###### Parameters

###### src

A Promise of a ResultTuple<T>, or a callback returning one

`Promise`\<[`ResultTuple`](flow.md#resulttuple)\<`T`\>\> | () => `Promise`\<[`ResultTuple`](flow.md#resulttuple)\<`T`\>\>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Promise<Outcome<T>>

###### See

[fromTuple](#fromtuple) for the synchronous version

##### ~~ok()~~

###### Call Signature

> `static` **ok**(): [`Outcome`](#outcome)\<`void`\>

Defined in: [types/outcome.ts:91](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L91)

Create a success Outcome with no value (void success).

###### Returns

[`Outcome`](#outcome)\<`void`\>

Outcome<void> carrying `undefined`

###### Call Signature

> `static` **ok**(`value`): [`Outcome`](#outcome)\<`null`\>

Defined in: [types/outcome.ts:99](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L99)

Create a success Outcome carrying an explicit `null` value.

###### Parameters

###### value

`null`

The literal `null`

###### Returns

[`Outcome`](#outcome)\<`null`\>

Outcome<null>

###### Call Signature

> `static` **ok**\<`T`\>(`value`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:107](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.ts#L107)

Create a success Outcome with the given value.

###### Type Parameters

###### T

`T`

###### Parameters

###### value

`T`

The success value

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome containing the success value

## Type Aliases

### CallbackReturn

> **CallbackReturn**\<`T`\> = `T` \| [`Err`](err.md#err) \| [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.types.ts:16](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.types.ts#L16)

Callback return under the value protocol.
- `Err`: failure
- `Outcome<T>`: passed through unchanged
- anything else: the success value

#### Type Parameters

##### T

`T`

***

### PipeFn()

> **PipeFn**\<`In`, `Out`\> = (`tuple`) => [`CallbackReturn`](#callbackreturn)\<`Out`\>

Defined in: [types/outcome.types.ts:38](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.types.ts#L38)

Synchronous pipe function type.
Receives a ResultTuple and returns a value-protocol result.

#### Type Parameters

##### In

`In`

Input value type

##### Out

`Out`

Output value type

#### Parameters

##### tuple

[`ResultTuple`](flow.md#resulttuple)\<`In`\>

#### Returns

[`CallbackReturn`](#callbackreturn)\<`Out`\>

***

### PipeFnAsync()

> **PipeFnAsync**\<`In`, `Out`\> = (`tuple`) => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`Out`\>\>

Defined in: [types/outcome.types.ts:47](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.types.ts#L47)

Asynchronous pipe function type.
Receives a ResultTuple and returns a Promise of a value-protocol result.

#### Type Parameters

##### In

`In`

Input value type

##### Out

`Out`

Output value type

#### Parameters

##### tuple

[`ResultTuple`](flow.md#resulttuple)\<`In`\>

#### Returns

`Promise`\<[`CallbackReturn`](#callbackreturn)\<`Out`\>\>

***

### ValueOf

> **ValueOf**\<`R`\> = `R` *extends* [`Err`](err.md#err) ? `never` : `R` *extends* [`Outcome`](#outcome)\<infer V\> ? `V` : `R`

Defined in: [types/outcome.types.ts:23](https://github.com/pencroff-lab/kore/blob/v0.7.0/src/types/outcome.types.ts#L23)

Success value a value-protocol callback return resolves to.

Distributes over unions, so `42 | Err` resolves to `42`.

#### Type Parameters

##### R

`R`

## References

### ResultTuple

Re-exports [ResultTuple](flow.md#resulttuple)
