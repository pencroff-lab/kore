# Docstring vs Logic Comparison (v2)

Scope:
- Only `src/**/*.ts` files were reviewed.
- `*.test.ts` files were excluded.
- No other folders/documents were used for comparison.

Summary:
- Files reviewed: 6
- Methods/functions reviewed: 59
- Correct: 48
- Logic mismatch: 3
- No docstring: 8

## Missed JSDoc by modifier

- Public without JSDoc: 0
- Private without JSDoc: 8
- Protected without JSDoc: 0

Public symbols missing JSDoc:
- None

## Mismatch details

- src/types/err.ts:1486 `Err.toString`: The `maxDepth` example shows `... (2 more causes)` for a 4-item chain with `maxDepth: 2`, but code reports one remaining cause at cutoff (`... (1 more cause)`). Refs: src/types/err.ts:1483, src/types/err.ts:1532, src/types/err.ts:1534
- src/types/outcome.ts:484 `Outcome.fromTuple`: Class-level doc says all Outcome instances are immutable, but `fromTuple` stores caller tuple by reference (`new Outcome(tuple)`), so later tuple mutation is observable. Refs: src/types/outcome.ts:131, src/types/outcome.ts:484, src/types/outcome.ts:485
- src/types/outcome.ts:579 `Outcome.all`: Doc says any failure returns aggregated errors via `Err.aggregate()`, but implementation returns the single original error directly when exactly one failure exists. Refs: src/types/outcome.ts:529, src/types/outcome.ts:593, src/types/outcome.ts:598

## Per-file review

### src/types/err.ts
| Symbol | Kind | Modifier | Line | Status | Details |
|---|---|---|---:|---|---|
| `Err.from` | method | public static | 449 | Correct | Implementation signature is documented via preceding overload JSDoc and behavior aligns. |
| `Err.wrap` | method | public static | 538 | Correct | Docstring and implementation behavior are aligned. |
| `Err.aggregate` | method | public static | 594 | Correct | Docstring and implementation behavior are aligned. |
| `Err.fromJSON` | method | public static | 642 | Correct | Docstring and implementation behavior are aligned. |
| `Err.isErr` | method | public static | 748 | Correct | Docstring and implementation behavior are aligned. |
| `Err.wrap` | method | public | 806 | Correct | Docstring and implementation behavior are aligned. |
| `Err.withCode` | method | public | 833 | Correct | Docstring and implementation behavior are aligned. |
| `Err.withMetadata` | method | public | 863 | Correct | Docstring and implementation behavior are aligned. |
| `Err.add` | method | public | 900 | Correct | Docstring and implementation behavior are aligned. |
| `Err.addAll` | method | public | 932 | Correct | Docstring and implementation behavior are aligned. |
| `Err.unwrap` | method | public | 1042 | Correct | Docstring and implementation behavior are aligned. |
| `Err.chain` | method | public | 1073 | Correct | Docstring and implementation behavior are aligned. |
| `Err.flatten` | method | public | 1109 | Correct | Docstring and implementation behavior are aligned. |
| `Err.hasCode` | method | public | 1138 | Correct | Docstring and implementation behavior are aligned. |
| `Err.hasCodePrefix` | method | public | 1189 | Correct | Docstring and implementation behavior are aligned. |
| `Err.find` | method | public | 1222 | Correct | Docstring and implementation behavior are aligned. |
| `Err.filter` | method | public | 1255 | Correct | Docstring and implementation behavior are aligned. |
| `Err.toJSON` | method | public | 1320 | Correct | Docstring and implementation behavior are aligned. |
| `Err._searchCode` | method | private | 1341 | Correct | Docstring and implementation behavior are aligned. |
| `Err._filterInternalFrames` | method | private static | 1362 | Correct | Docstring and implementation behavior are aligned. |
| `Err._getStackFrames` | method | private | 1389 | Correct | Docstring and implementation behavior are aligned. |
| `Err._countRemainingCauses` | method | private | 1412 | Correct | Docstring and implementation behavior are aligned. |
| `Err.toString` | method | public | 1486 | Logic mismatch | The `maxDepth` example shows `... (2 more causes)` for a 4-item chain with `maxDepth: 2`, but code reports one remaining cause at cutoff (`... (1 more cause)`). Refs: src/types/err.ts:1483, src/types/err.ts:1532, src/types/err.ts:1534 |
| `Err._toStringInternal` | method | private | 1494 | Correct | Docstring and implementation behavior are aligned. |
| `Err.toError` | method | public | 1586 | Correct | Docstring and implementation behavior are aligned. |

### src/types/index.ts
- No method/function implementations in this file.

### src/types/outcome.ts
| Symbol | Kind | Modifier | Line | Status | Details                                                                                                                                                                                                                                                                                                                                             |
|---|---|---|---:|---|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `Outcome._processCallbackReturn` | method | private static | 190 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.ok` | method | public static | 232 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.err` | method | public static | 307 | Correct | Implementation signature is documented via preceding overload JSDoc and behavior aligns.                                                                                                                                                                                                                                                            |
| `Outcome.unit` | method | public static | 355 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.from` | method | public static | 400 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.fromAsync` | method | public static | 447 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.fromTuple` | method | public static | 484 | Logic mismatch | Class-level doc says all Outcome instances are immutable, but `fromTuple` stores caller tuple by reference (`new Outcome(tuple)`), so later tuple mutation is observable. Refs: src/types/outcome.ts:131, src/types/outcome.ts:484, src/types/outcome.ts:485, fix - Clone input tuple in `fromTuple()` (`return new Outcome([tuple[0], tuple[1]])`) |
| `Outcome.fromJSON` | method | public static | 508 | Correct | Implementation signature is documented via preceding overload JSDoc and behavior aligns. Fix: Doc string - add a short “Invalid payload” note with example output.                                                                                                                                                                                  |
| `Outcome.all` | method | public static | 579 | Logic mismatch | Doc says any failure returns aggregated errors via `Err.aggregate()`, but implementation returns the single original error directly when exactly one failure exists. Refs: src/types/outcome.ts:529, src/types/outcome.ts:593, src/types/outcome.ts:598. Fix - always array even for one error, update types                                        |
| `Outcome.any` | method | public static | 648 | Correct | Docstring and implementation behavior are aligned. Update doc strings about empty input - message, code                                                                                                                                                                                                                                             |
| `Outcome.map` | method | public | 763 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.mapAsync` | method | public | 792 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.mapErr` | method | public | 846 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.mapErrAsync` | method | public | 877 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.effect` | method | public | 929 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.effectAsync` | method | public | 955 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.defaultTo` | method | public | 1043 | Correct | Implementation signature is documented via preceding overload JSDoc and behavior aligns.                                                                                                                                                                                                                                                            |
| `Outcome.either` | method | public | 1108 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.pipe` | method | public | 1236 | Correct | Implementation signature is documented via preceding overload JSDoc and behavior aligns.                                                                                                                                                                                                                                                            |
| `Outcome.pipeAsync` | method | public | 1372 | Correct | Implementation signature is documented via preceding overload JSDoc and behavior aligns.                                                                                                                                                                                                                                                            |
| `Outcome.toTuple` | method | public | 1415 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.toJSON` | method | public | 1440 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `Outcome.toString` | method | public | 1461 | Correct | Docstring and implementation behavior are aligned.                                                                                                                                                                                                                                                                                                  |
| `fmt` | function | private | 1469 | No docstring | No direct JSDoc on this implementation to compare against logic.                                                                                                                                                                                                                                                                                    |

### src/utils/format_dt.ts
| Symbol | Kind | Modifier | Line | Status | Details |
|---|---|---|---:|---|---|
| `dtStamp` | function | public | 83 | Correct | Docstring and implementation behavior are aligned. |

### src/utils/index.ts
- No method/function implementations in this file.

### src/utils/logger.ts
| Symbol | Kind | Modifier | Line | Status | Details |
|---|---|---|---:|---|---|
| `isLevel` | function | private | 251 | No docstring | No direct JSDoc on this implementation to compare against logic. |
| `normalizeContext` | function | private | 258 | No docstring | No direct JSDoc on this implementation to compare against logic. |
| `resolveCall` | function | private | 266 | No docstring | No direct JSDoc on this implementation to compare against logic. |
| `getLogLevel` | function | private | 305 | No docstring | No direct JSDoc on this implementation to compare against logic. |
| `formatShortTimestamp` | function | private | 312 | No docstring | No direct JSDoc on this implementation to compare against logic. |
| `prettyTransport` | function | public | 338 | Correct | Docstring and implementation behavior are aligned. |
| `formatTimestamp` | function | private | 348 | No docstring | No direct JSDoc on this implementation to compare against logic. |
| `buildLogger` | function | private | 401 | No docstring | No direct JSDoc on this implementation to compare against logic. |
| `createLogger` | function | public | 481 | Correct | Docstring and implementation behavior are aligned. |
