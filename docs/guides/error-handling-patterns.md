# Error Handling Patterns

How `Err` and `Outcome` compose in practice within `@pencroff-lab/kore`.

## When to use `Err` directly vs `Outcome`

| Scenario | Use |
|----------|-----|
| Returning `[value, null] \| [null, Err]` tuples from functions | `Err` directly |
| Chaining transformations, recovery, or combinators | `Outcome` |
| Validation collecting multiple errors | `Err.aggregate()` |
| Wrapping third-party code that throws | `Outcome.from()` / `Outcome.fromAsync()` |

**Rule of thumb:** Use raw tuples at module boundaries (simple, no overhead). Use `Outcome` when you need to chain operations or combine results.

## Propagation through call stacks

Wrap errors at each layer to build a cause chain:

```typescript
// Repository layer
function findUser(id: string): [User, null] | [null, Err] {
  const [row, err] = db.query("SELECT ...", [id]);
  if (err) return [null, err.wrap("findUser failed")];
  return [row, null];
}

// Service layer
function getProfile(id: string): Outcome<Profile> {
  return Outcome.from(() => {
    const [user, err] = findUser(id);
    if (err) return err.wrap("getProfile failed").withCode("PROFILE_ERROR");
    return [{ ...user, displayName: user.name }, null];
  });
}

// Handler layer
function handleRequest(id: string): HttpResponse {
  return getProfile(id).either(
    (profile) => ({ status: 200, body: profile }),
    (err) => ({
      status: err.hasCode("NOT_FOUND") ? 404 : 500,
      body: { error: err.message },
    }),
  );
}
```

The cause chain is preserved: `handleRequest` can inspect the root cause via `err.root` or `err.chain()`.

## Real-world scenarios

### API handler with validation

```typescript
function createOrder(input: OrderInput): Outcome<Order> {
  return Outcome.from(() => {
    let errors = Err.aggregate("Validation failed");
    if (!input.items?.length) errors = errors.add("Items required");
    if (!input.address) errors = errors.add("Address required");

    if (errors.count > 0) {
      return errors.withCode("VALIDATION_ERROR");
    }

    return [{ id: generateId(), ...input, status: "pending" }, null];
  });
}

// Usage
const response = createOrder(body).either(
  (order) => ({ status: 201, body: order }),
  (err) => ({ status: 422, body: err.toJSON({ stack: false }) }),
);
```

### File processing pipeline

```typescript
async function processFile(path: string): Promise<Outcome<Report>> {
  return Outcome.fromAsync(async () => {
    const [content, readErr] = await readFile(path);
    if (readErr) return readErr.wrap("processFile: read failed");

    const [parsed, parseErr] = parse(content);
    if (parseErr) return parseErr.wrap("processFile: parse failed");

    const [report, genErr] = await generateReport(parsed);
    if (genErr) return genErr.wrap("processFile: report failed");

    return [report, null];
  });
}
```

Or with `pipeAsync` for a more declarative style:

```typescript
async function processFile(path: string): Promise<Outcome<Report>> {
  return Outcome.ok(path).pipeAsync(
    async ([p, err]) => {
      if (err) return err;
      return await readFile(p);
    },
    async ([content, err]) => {
      if (err) return err;
      return parse(content);
    },
    async ([parsed, err]) => {
      if (err) return err;
      return await generateReport(parsed);
    },
  );
}
```

## Key patterns

- **`Err.wrap(message, cause)`** — static factory to wrap a native Error with context
- **`err.wrap(message)`** — instance method to add context to an existing Err
- **`Outcome.from(fn)`** — catches throws from synchronous code
- **`Outcome.fromAsync(fn)`** — catches throws from async code
- **`outcome.either(onOk, onErr)`** — terminal fold into a single type
- **`outcome.defaultTo(fallback)`** — extract value with a fallback on error
- **`Outcome.all(outcomes)`** — succeed only if all succeed, aggregate errors
- **`Outcome.any(outcomes)`** — succeed if any succeeds

## See also

- [err.examples.test.ts](../../src/types/err.examples.test.ts) — Err usage examples
- [outcome.examples.test.ts](../../src/types/outcome.examples.test.ts) — Outcome usage examples
