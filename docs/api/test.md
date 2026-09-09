[**@pencroff-lab/kore**](README.md)

***

[@pencroff-lab/kore](README.md) / test

# test

Assertion helpers for result tuples, published as `@pencroff-lab/kore/test`.

Both helpers narrow a `ResultTuple` to one branch and return its payload, so
a test asserts on a value instead of guarding and casting. Failure is a plain
thrown `Error`: this module imports no test framework and adds no runtime
dependency, so it works in any runner.

## See

[test.examples.test.ts](../../src/flow/test.examples.test.ts) for usage patterns

## Functions

### expectErr()

> **expectErr**\<`T`\>(`tuple`): [`Err`](err.md#err)

Defined in: [flow/test.ts:48](../../src/flow/test.ts#L48)

Assert the tuple failed and return its error.

#### Type Parameters

##### T

`T`

#### Parameters

##### tuple

[`ResultTuple`](flow.md#resulttuple)\<`T`\>

Result to unwrap

#### Returns

[`Err`](err.md#err)

The `Err`

#### Throws

Error if the tuple holds a success value

***

### expectOk()

> **expectOk**\<`T`\>(`tuple`): `T`

Defined in: [flow/test.ts:34](../../src/flow/test.ts#L34)

Assert the tuple succeeded and return its value.

#### Type Parameters

##### T

`T`

#### Parameters

##### tuple

[`ResultTuple`](flow.md#resulttuple)\<`T`\>

Result to unwrap

#### Returns

`T`

The success value

#### Throws

Error if the tuple holds an error
