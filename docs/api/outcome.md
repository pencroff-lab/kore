[**@pencroff-lab/kore**](README.md)

***

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
- **CallbackReturn** — tuple, `null` (void success) or bare `Err` shorthand; accepted
  by `from`/`fromAsync`, `mapErr` and `pipe`, where wrapping Go-style functions is the job.
- **Auto-catch** — `from`, `map`, `flatMap` and `pipe` catch thrown exceptions and wrap them as `Err`.
- **Combinators** — `all` collects every error (non-short-circuit), `any` short-circuits on first success.

## See

[outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) for usage patterns

## Classes

### Outcome

Defined in: [types/outcome.ts:40](../../src/types/outcome.ts#L40)

A monadic container for handling success and error states.
Uses tuples as the primary interface. All instances are immutable.

#### Type Parameters

##### T

`T`

The type of the success value

#### Properties

##### isOk

> `readonly` **isOk**: `boolean`

Defined in: [types/outcome.ts:45](../../src/types/outcome.ts#L45)

Discriminator property for type narrowing.
`true` for success outcomes, `false` for error outcomes.

#### Accessors

##### error

###### Get Signature

> **get** **error**(): [`Err`](err.md#err) \| `null`

Defined in: [types/outcome.ts:80](../../src/types/outcome.ts#L80)

The error, or null if in success state.

###### Returns

[`Err`](err.md#err) \| `null`

##### isErr

###### Get Signature

> **get** **isErr**(): `boolean`

Defined in: [types/outcome.ts:62](../../src/types/outcome.ts#L62)

Whether this Outcome is in error state.

###### Returns

`boolean`

##### value

###### Get Signature

> **get** **value**(): `T` \| `null`

Defined in: [types/outcome.ts:73](../../src/types/outcome.ts#L73)

The success value, or null if in error state.

###### Returns

`T` \| `null`

#### Methods

##### defaultTo()

###### Call Signature

> **defaultTo**(`fallback`): `T`

Defined in: [types/outcome.ts:602](../../src/types/outcome.ts#L602)

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

Defined in: [types/outcome.ts:611](../../src/types/outcome.ts#L611)

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

Defined in: [types/outcome.ts:622](../../src/types/outcome.ts#L622)

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

##### effect()

> **effect**(`fn`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:561](../../src/types/outcome.ts#L561)

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

##### effectAsync()

> **effectAsync**(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Defined in: [types/outcome.ts:579](../../src/types/outcome.ts#L579)

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

##### either()

> **either**\<`U`\>(`onOk`, `onErr`): `U`

Defined in: [types/outcome.ts:646](../../src/types/outcome.ts#L646)

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

##### flatMap()

> **flatMap**\<`U`\>(`fn`): [`Outcome`](#outcome)\<`U`\>

Defined in: [types/outcome.ts:467](../../src/types/outcome.ts#L467)

Chain a callback that returns an `Outcome`, flattening the result.

Only called if successful. Errors pass through unchanged.
If the callback throws, the exception is caught and wrapped.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`value`) => [`Outcome`](#outcome)\<`U`\>

Function receiving the success value, returning an Outcome

###### Returns

[`Outcome`](#outcome)\<`U`\>

The Outcome returned by the callback, or the original error

###### See

 - [flatMapAsync](#flatmapasync) for the async version
 - [map](#map) for callbacks that return a plain value

##### flatMapAsync()

> **flatMapAsync**\<`U`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Defined in: [types/outcome.ts:486](../../src/types/outcome.ts#L486)

Async version of `flatMap()`.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`value`) => `Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Async function returning a Promise of an Outcome

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Promise of the flattened Outcome

###### See

[flatMap](#flatmap) for the synchronous version

##### map()

> **map**\<`U`\>(`fn`): [`Outcome`](#outcome)\<`U`\>

Defined in: [types/outcome.ts:425](../../src/types/outcome.ts#L425)

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

##### mapAsync()

> **mapAsync**\<`U`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`U`\>\>

Defined in: [types/outcome.ts:444](../../src/types/outcome.ts#L444)

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

##### mapErr()

> **mapErr**\<`U`\>(`fn`): [`Outcome`](#outcome)\<`T` \| `U`\>

Defined in: [types/outcome.ts:510](../../src/types/outcome.ts#L510)

Transform or recover from an error using a callback.

Only called if in error state. Success passes through unchanged.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`error`) => [`CallbackReturn`](#callbackreturn)\<`U`\>

Function receiving the error

###### Returns

[`Outcome`](#outcome)\<`T` \| `U`\>

New Outcome with transformed error or recovered value

###### See

 - [mapErrAsync](#maperrasync) for the async version
 - [map](#map) for transforming success values

##### mapErrAsync()

> **mapErrAsync**\<`U`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T` \| `U`\>\>

Defined in: [types/outcome.ts:531](../../src/types/outcome.ts#L531)

Async version of `mapErr()`.

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`error`) => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`U`\>\>

Async function receiving the error

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T` \| `U`\>\>

Promise of new Outcome

###### See

[mapErr](#maperr) for the synchronous version

##### pipe()

###### Call Signature

> **pipe**\<`A`\>(`f1`): [`Outcome`](#outcome)\<`A`\>

Defined in: [types/outcome.ts:667](../../src/types/outcome.ts#L667)

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

Defined in: [types/outcome.ts:668](../../src/types/outcome.ts#L668)

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

Defined in: [types/outcome.ts:669](../../src/types/outcome.ts#L669)

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

Defined in: [types/outcome.ts:674](../../src/types/outcome.ts#L674)

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

Defined in: [types/outcome.ts:680](../../src/types/outcome.ts#L680)

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

Defined in: [types/outcome.ts:687](../../src/types/outcome.ts#L687)

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

Defined in: [types/outcome.ts:695](../../src/types/outcome.ts#L695)

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

Defined in: [types/outcome.ts:704](../../src/types/outcome.ts#L704)

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

Defined in: [types/outcome.ts:714](../../src/types/outcome.ts#L714)

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

Defined in: [types/outcome.ts:725](../../src/types/outcome.ts#L725)

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

##### pipeAsync()

###### Call Signature

> **pipeAsync**\<`A`\>(`f1`): `Promise`\<[`Outcome`](#outcome)\<`A`\>\>

Defined in: [types/outcome.ts:767](../../src/types/outcome.ts#L767)

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

Defined in: [types/outcome.ts:768](../../src/types/outcome.ts#L768)

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

Defined in: [types/outcome.ts:772](../../src/types/outcome.ts#L772)

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

Defined in: [types/outcome.ts:777](../../src/types/outcome.ts#L777)

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

Defined in: [types/outcome.ts:783](../../src/types/outcome.ts#L783)

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

Defined in: [types/outcome.ts:790](../../src/types/outcome.ts#L790)

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

Defined in: [types/outcome.ts:798](../../src/types/outcome.ts#L798)

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

Defined in: [types/outcome.ts:807](../../src/types/outcome.ts#L807)

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

Defined in: [types/outcome.ts:817](../../src/types/outcome.ts#L817)

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

Defined in: [types/outcome.ts:828](../../src/types/outcome.ts#L828)

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

##### toJSON()

> **toJSON**(): \[`T`, `null`\] \| \[`null`, [`ErrJSON`](err.md#errjson)\]

Defined in: [types/outcome.ts:884](../../src/types/outcome.ts#L884)

Convert to JSON-serializable tuple.

###### Returns

\[`T`, `null`\] \| \[`null`, [`ErrJSON`](err.md#errjson)\]

JSON-serializable representation

###### See

[fromJSON](#fromjson) for deserializing an Outcome from JSON

##### toString()

> **toString**(): `string`

Defined in: [types/outcome.ts:896](../../src/types/outcome.ts#L896)

Convert to a human-readable string.

###### Returns

`string`

String representation

##### toTuple()

> **toTuple**(): [`ResultTuple`](#resulttuple)\<`T`\>

Defined in: [types/outcome.ts:872](../../src/types/outcome.ts#L872)

Extract the internal tuple.

###### Returns

[`ResultTuple`](#resulttuple)\<`T`\>

The internal ResultTuple<T>

###### See

[fromTuple](#fromtuple) for creating an Outcome from a tuple

##### all()

> `static` **all**\<`T`\>(`outcomes`): [`Outcome`](#outcome)\<`T`[]\>

Defined in: [types/outcome.ts:287](../../src/types/outcome.ts#L287)

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

##### any()

> `static` **any**\<`T`\>(`outcomes`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:317](../../src/types/outcome.ts#L317)

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

##### err()

###### Call Signature

> `static` **err**(`error`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:118](../../src/types/outcome.ts#L118)

Create an error Outcome from an existing Err.

###### Parameters

###### error

[`Err`](err.md#err)

The Err instance

###### Returns

[`Outcome`](#outcome)\<`never`\>

Outcome in error state

###### Call Signature

> `static` **err**(`message`, `code?`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:127](../../src/types/outcome.ts#L127)

Create an error Outcome from a message with optional code.

###### Parameters

###### message

`string`

Error message

###### code?

`string`

Optional error code

###### Returns

[`Outcome`](#outcome)\<`never`\>

Outcome in error state

###### Call Signature

> `static` **err**(`message`, `options`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:136](../../src/types/outcome.ts#L136)

Create an error Outcome from a message with options.

###### Parameters

###### message

`string`

Error message

###### options

[`ErrOptions`](err.md#erroptions)

Error options (code, metadata)

###### Returns

[`Outcome`](#outcome)\<`never`\>

Outcome in error state

###### Call Signature

> `static` **err**(`message`, `error`, `options?`): [`Outcome`](#outcome)\<`never`\>

Defined in: [types/outcome.ts:146](../../src/types/outcome.ts#L146)

Create an error Outcome by wrapping another error.

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

[`Outcome`](#outcome)\<`never`\>

Outcome in error state with wrapped cause

##### from()

> `static` **from**\<`T`\>(`fn`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:201](../../src/types/outcome.ts#L201)

Create an Outcome from a callback that returns `CallbackReturn<T>`.

If the callback throws, the exception is caught and wrapped in an error Outcome.

###### Type Parameters

###### T

`T`

###### Parameters

###### fn

() => [`CallbackReturn`](#callbackreturn)\<`T`\>

Callback returning CallbackReturn<T>

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome<T>

###### See

[fromAsync](#fromasync) for the async version

##### fromAsync()

> `static` **fromAsync**\<`T`\>(`fn`): `Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Defined in: [types/outcome.ts:218](../../src/types/outcome.ts#L218)

Create an Outcome from an async callback that returns `Promise<CallbackReturn<T>>`.

###### Type Parameters

###### T

`T`

###### Parameters

###### fn

() => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`T`\>\>

Async callback returning Promise<CallbackReturn<T>>

###### Returns

`Promise`\<[`Outcome`](#outcome)\<`T`\>\>

Promise<Outcome<T>>

###### See

[from](#from) for the synchronous version

##### fromJSON()

> `static` **fromJSON**\<`T`\>(`payload`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:255](../../src/types/outcome.ts#L255)

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

##### fromTuple()

> `static` **fromTuple**\<`T`\>(`tuple`): [`Outcome`](#outcome)\<`T`\>

Defined in: [types/outcome.ts:237](../../src/types/outcome.ts#L237)

Create an Outcome from an existing ResultTuple.

###### Type Parameters

###### T

`T`

###### Parameters

###### tuple

[`ResultTuple`](#resulttuple)\<`T`\>

A ResultTuple<T>

###### Returns

[`Outcome`](#outcome)\<`T`\>

Outcome<T>

###### See

[toTuple](#totuple) for extracting the tuple from an Outcome

##### ok()

###### Call Signature

> `static` **ok**(): [`Outcome`](#outcome)\<`void`\>

Defined in: [types/outcome.ts:89](../../src/types/outcome.ts#L89)

Create a success Outcome with no value (void success).

###### Returns

[`Outcome`](#outcome)\<`void`\>

Outcome<void> carrying `undefined`

###### Call Signature

> `static` **ok**(`value`): [`Outcome`](#outcome)\<`null`\>

Defined in: [types/outcome.ts:97](../../src/types/outcome.ts#L97)

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

Defined in: [types/outcome.ts:105](../../src/types/outcome.ts#L105)

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

##### ~~unit()~~

> `static` **unit**(): [`Outcome`](#outcome)\<`null`\>

Defined in: [types/outcome.ts:187](../../src/types/outcome.ts#L187)

Create a success Outcome with null value (void success).

###### Returns

[`Outcome`](#outcome)\<`null`\>

Outcome<null> representing void success

###### Deprecated

Since v0.6.0 — use `Outcome.ok(null)` instead (`Outcome.ok()`
carries `undefined`, not `null`). Removed in v0.7.0.

## Type Aliases

### CallbackReturn

> **CallbackReturn**\<`T`\> = [`ResultTuple`](#resulttuple)\<`T`\> \| [`NullErr`](#nullerr)

Defined in: [types/outcome.types.ts:25](../../src/types/outcome.types.ts#L25)

Combined callback return type for `Outcome.from()` and `Outcome.fromAsync()`.
Supports tuple, null (void success), and Err (shorthand) patterns.

Discrimination order: `Err.isErr()` → `=== null` → destructure tuple

#### Type Parameters

##### T

`T`

***

### NullErr

> **NullErr** = `null` \| [`Err`](err.md#err)

Defined in: [types/outcome.types.ts:10](../../src/types/outcome.types.ts#L10)

Direct return types for errors or void success.
- `null`: void success (function completed, no value to return)
- `Err`: error (shorthand for `[null, Err]`)

***

### PipeFn()

> **PipeFn**\<`In`, `Out`\> = (`tuple`) => [`CallbackReturn`](#callbackreturn)\<`Out`\>

Defined in: [types/outcome.types.ts:36](../../src/types/outcome.types.ts#L36)

Synchronous pipe function type.
Receives a ResultTuple and returns a CallbackReturn.

#### Type Parameters

##### In

`In`

Input value type

##### Out

`Out`

Output value type

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

#### Returns

[`CallbackReturn`](#callbackreturn)\<`Out`\>

***

### PipeFnAsync()

> **PipeFnAsync**\<`In`, `Out`\> = (`tuple`) => `Promise`\<[`CallbackReturn`](#callbackreturn)\<`Out`\>\>

Defined in: [types/outcome.types.ts:45](../../src/types/outcome.types.ts#L45)

Asynchronous pipe function type.
Receives a ResultTuple and returns a Promise of CallbackReturn.

#### Type Parameters

##### In

`In`

Input value type

##### Out

`Out`

Output value type

#### Parameters

##### tuple

[`ResultTuple`](#resulttuple)\<`In`\>

#### Returns

`Promise`\<[`CallbackReturn`](#callbackreturn)\<`Out`\>\>

***

### ResultTuple

> **ResultTuple**\<`T`\> = \[`T`, `null`\] \| \[`null`, [`Err`](err.md#err)\]

Defined in: [types/outcome.types.ts:17](../../src/types/outcome.types.ts#L17)

Tuple-based result with positional semantics.
- `[T, null]`: success with value
- `[null, Err]`: error

#### Type Parameters

##### T

`T`
