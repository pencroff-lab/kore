# Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to generate changelogs with [git-cliff](https://git-cliff.org/).

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Only the first line appears in the changelog.** Keep it under 72 characters.

## Types

| Type | Changelog Group | When to Use |
|------|----------------|-------------|
| `feat` | Features | New functionality or capability |
| `fix` | Bug Fixes | Bug fix |
| `doc` | Documentation | Documentation-only changes |
| `perf` | Performance | Performance improvement |
| `refactor` | Refactor | Code change that neither fixes a bug nor adds a feature |
| `chore` | *(skipped)* | Maintenance tasks (deps, config, tooling) |
| `ci` | *(skipped)* | CI/CD pipeline changes |

Commits without a recognized type prefix go into the "Other" group.

## Scope (optional)

Scope narrows what the change affects. Use short, lowercase identifiers:

```
feat(err): add aggregate error support
fix(outcome): handle null in mapErr chain
doc(logger): update transport DI examples
refactor(utils): extract dtStamp formatting
```

Common scopes: `err`, `outcome`, `logger`, `utils`, `build`, `ci`.

## Examples

```
feat: add git-cliff changelog generation
feat(outcome): add pipeAsync for async transformations
fix(err): preserve cause chain during JSON roundtrip
doc: add commit convention guide
refactor(logger): simplify transport resolution
perf(err): reduce allocation in hierarchical code lookup
chore: bump typescript to 5.7
ci: add publish step to GitHub Actions
```

## Breaking Changes

Add `!` after the type/scope, and include a `BREAKING CHANGE:` footer:

```
feat(outcome)!: rename flatMap to pipe

BREAKING CHANGE: `flatMap` method removed, use `pipe` instead.
```

## What Makes a Good Changelog Entry

The first line of your commit becomes the changelog entry. Write it so that a **user of the library** understands the change:

- **Do:** `feat(err): add withMetadata for attaching context to errors`
- **Don't:** `feat(err): add new method`
- **Do:** `fix(outcome): return Err when map callback throws`
- **Don't:** `fix: fix bug`

## Merge Commits

Merge commits (e.g., from GitHub PRs) that don't follow the convention are placed in the "Other" group. Prefer **squash merges** with a conventional commit message for cleaner changelogs.

## Generating the Changelog

```bash
# Preview changelog for unreleased changes
bunx git-cliff --unreleased

# Generate full changelog
bunx git-cliff -o CHANGELOG.md

# Generate changelog from a specific tag
bunx git-cliff --latest
```

Configuration is in `cliff.toml`.
