# Implementation Plan: Err Metadata Methods

Branch: `5-methods-metadata`
Source: `.workspace/brainstorm/metadata-methods.md`
File: `src/types/err.ts`
Tests: `src/types/err.test.ts`

---

## 1. API

### 1.1 `hasMetadata(key, options?)`

```typescript
hasMetadata(key: string, options?: { keyCheck?: boolean }): boolean
```

Place in Err class after `withMetadata()` method (~line 872), in a new section "Metadata Access".

### 1.2 `getMetadata<T>(key, defaultValue?)`

Two overload signatures + implementation:

```typescript
getMetadata<T = unknown>(key: string): T | undefined;
getMetadata<T = unknown>(key: string, defaultValue: T): T;
getMetadata<T = unknown>(key: string, defaultValue?: T): T | undefined {
  // implementation
}
```

Place after `hasMetadata`.

### 1.3 `omitMetadata(key | key[])`

```typescript
omitMetadata(key: string | string[]): Err
```

Place after `getMetadata`. Follows the same `new Err(this.message, { ... })` pattern as `withCode` and `withMetadata` (preserves cause, errors, stack, timestamp).

---

## 2. Behavior

### 2.1 `hasMetadata`

- If `this.metadata` is `undefined` → return `false`
- If key not in `this.metadata` → return `false`
- Default mode: return `true` only if value is not `null` and not `undefined`
- With `{ keyCheck: true }`: return `true` if key exists in object (use `key in this.metadata`)
- Operates on current instance only — no cause chain traversal

### 2.2 `getMetadata`

- If `this.metadata` is `undefined` → return `defaultValue ?? undefined`
- If key not in `this.metadata` → return `defaultValue ?? undefined`
- If key exists → return `this.metadata[key] as T`
- When `defaultValue` provided, return type is `T` (never undefined)
- When no `defaultValue`, return type is `T | undefined`
- No runtime type validation — cast only
- Operates on current instance only

### 2.3 `omitMetadata`

- Normalize input: if `string`, convert to `[string]`
- Build new metadata object by copying `this.metadata` and deleting specified keys
- If resulting object has zero keys → set metadata to `undefined`
- If `this.metadata` is `undefined` → return new Err with `undefined` metadata (no-op safe)
- Returns new `Err` instance via `new Err(this.message, { ... })` preserving:
  - `code`, `cause`, `errors` (spread copy), `stack`, `timestamp`
- Original instance unchanged (immutability)

---

## 3. Test Cases

File: `src/types/err.test.ts`
Add new `describe` blocks within the existing test structure.

### 3.1 `hasMetadata`

**Default mode (value check):**
- Returns `true` for key with non-null value
- Returns `false` for key with `null` value
- Returns `false` for key with `undefined` value
- Returns `false` for missing key
- Returns `false` when no metadata on Err

**keyCheck mode:**
- Returns `true` for key with `null` value
- Returns `true` for key with `undefined` value
- Returns `false` for missing key
- Returns `false` when no metadata on Err

**Falsy values (default mode):**
- Returns `true` for `0`, `""`, `false` — these are not null/undefined

**Scope:**
- Does not search cause chain

### 3.2 `getMetadata`

**Basic retrieval:**
- Returns value for existing key
- Returns `undefined` for missing key
- Returns `undefined` when no metadata on Err

**Default value:**
- Returns default for missing key
- Returns existing value over default
- Returns default when no metadata on Err

**Null/undefined stored values:**
- Returns `null` for key with `null` value
- Returns `undefined` for key with `undefined` value
- Returns `null` even when default provided (key exists, returns stored value)

**Falsy values:**
- Returns `0`, `""`, `false` over provided defaults

**Complex types:**
- Returns object value
- Returns array value

**Scope:**
- Does not search cause chain

### 3.3 `omitMetadata`

**Single key:**
- Removes a single key from metadata
- Returns new instance (not same reference)
- Does not mutate original

**Multiple keys:**
- Removes multiple keys from array

**All keys removed:**
- Returns `undefined` metadata when single key removed leaves empty
- Returns `undefined` metadata when array removes all keys

**No-op cases:**
- Handles non-existent key gracefully (metadata unchanged)
- Handles `undefined` metadata gracefully
- Handles empty array gracefully

**Preservation:**
- Preserves cause chain
- Preserves code
- Preserves timestamp
- Preserves stack
- Preserves aggregated errors

**Scope:**
- Does not affect cause chain metadata

### 3.4 Composability with `find`/`filter`

- `find` locates error with specific metadata in cause chain
- `filter` collects errors with metadata in aggregate
