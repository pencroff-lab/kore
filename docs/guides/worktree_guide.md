# Git Worktree Guide for Agentic Workflows

Git worktrees let you check out multiple branches simultaneously in separate directories —
without cloning the repo again. Each worktree shares the same `.git` history but has its
own working tree, making them ideal for parallel agentic workflows.

## Quick Reference

```bash
# Create a worktree with a new branch
git worktree add ../repo-name -b branch-name

# Create a worktree from an existing branch
git worktree add ../repo-name existing-branch

# List active worktrees
git worktree list

# Remove a worktree (keeps the branch)
git worktree remove ../repo-name

# Delete the branch after removing the worktree
git branch -D branch-name
```

## A/B Model Comparison

Compare two AI coding models on the same task by giving each an identical starting point
and isolated workspace.

### Setup

```bash
# Ensure you're on the correct starting commit
git log --oneline -1

# Create one worktree per model
git worktree add ../project-model-a -b compare/model-a
git worktree add ../project-model-b -b compare/model-b
```

### Run the comparison

Open each worktree in a separate editor window:

```bash
zed ../project-model-a
zed ../project-model-b
```

Give each model the **identical prompt** — copy-paste the exact same task description.
Let both run to completion independently.

### Evaluate

```bash
# High-level overview of differences
git diff --stat compare/model-a..compare/model-b

# Full diff between the two results
git diff compare/model-a..compare/model-b

# Diff each against the common starting point
git diff HEAD..compare/model-a
git diff HEAD..compare/model-b

# Run tests in both
(cd ../project-model-a && bun test)
(cd ../project-model-b && bun test)

# Compare coverage
(cd ../project-model-a && bun run test:coverage)
(cd ../project-model-b && bun run test:coverage)
```

### Cleanup

```bash
git worktree remove ../project-model-a
git worktree remove ../project-model-b
git branch -D compare/model-a compare/model-b
```

### Fairness checklist

- Same starting commit for both worktrees
- Identical task prompt (copy-paste, no rephrasing)
- Same agentic framework and tooling (IDE, agent mode, MCP servers)
- Same context available (files, docs, CLAUDE.md)
- Compare models in the same weight class (e.g. Sonnet vs Mercury, not Haiku vs Opus)

## Parallel Feature Development

Work on two features simultaneously without branch switching.

```bash
git worktree add ../project-feature-auth -b feature/auth
git worktree add ../project-feature-cache -b feature/cache
```

Each worktree has its own `node_modules` after running `bun install`, so builds and tests
are fully independent. Commit in each worktree separately, then merge both into main.

## Reviewing Pull Requests Locally

Check out a PR without disturbing your current work:

```bash
# Fetch the PR branch
git fetch origin pull/42/head:pr-42

# Create a worktree for review
git worktree add ../project-pr-42 pr-42

# Open and review
zed ../project-pr-42

# Cleanup after review
git worktree remove ../project-pr-42
git branch -D pr-42
```

## Safe Experimentation

Try a risky refactor without touching your working branch:

```bash
git worktree add ../project-experiment -b experiment/new-parser

# If the experiment fails — clean discard
git worktree remove ../project-experiment
git branch -D experiment/new-parser

# If the experiment succeeds — merge it
git checkout main
git merge experiment/new-parser
git worktree remove ../project-experiment
git branch -d experiment/new-parser
```

## Things to Know

| Behavior | Detail |
|----------|--------|
| Shared history | All worktrees share `.git` — commits are visible everywhere |
| Branch lock | A branch checked out in one worktree cannot be checked out in another |
| Dependencies | Each worktree needs its own `bun install` |
| `worktree remove` | Deletes the directory, keeps the branch |
| `branch -D` | Deletes the branch — do this after removing the worktree |
| Pruning | `git worktree prune` cleans up stale entries if a directory was deleted manually |
