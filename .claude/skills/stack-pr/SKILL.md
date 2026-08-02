---
name: stack-pr
description: Create and manage stacked pull requests using the Graphite CLI (gt)
tags: [git, pull-request, graphite, workflow]
---

# Skill: Stack PR with Graphite

Guide the user through creating, managing, and submitting stacked pull requests using the [Graphite CLI](https://graphite.dev/docs/graphite-cli).

## Prerequisites

Before starting, verify Graphite CLI is installed:

```bash
which gt || echo "MISSING: install with 'npm install -g @withgraphite/graphite-cli'"
gt --version
```

If missing, prompt the user to install it:

```bash
npm install -g @withgraphite/graphite-cli
gt auth          # authenticate with GitHub via browser
gt repo init     # initialize Graphite in the repository (run once per repo)
```

## Core Concepts

A **stack** is a chain of branches where each one is based on the previous:

```
main
 └── feat/transaction-entity     (branch 1 — domain layer)
      └── feat/transaction-usecase (branch 2 — business logic)
           └── feat/transaction-resolver (branch 3 — GraphQL API)
```

Each branch gets its own PR. GitHub shows them in dependency order. Reviewers can review each slice independently.

## Workflow

### 1 — Start the stack from an up-to-date base

```bash
git checkout main && git pull
gt repo sync           # sync Graphite metadata with remote
```

### 2 — Create the first branch in the stack

```bash
gt branch create feat/<scope>-<layer>
# Example:
gt branch create feat/transaction-model
```

Make changes, then stage and commit:

```bash
gt add -A                                    # stage all (or stage selectively)
gt commit create -m "feat(transaction): add domain entity"
# OR use the project commit skill:
# python .claude/skills/commit/commit.py
```

### 3 — Add another branch on top

While still on `feat/transaction-model`:

```bash
gt branch create feat/transaction-graphql
# ... make changes ...
gt add -A
gt commit create -m "feat(transaction): expose GraphQL mutation"
```

Repeat for as many layers as needed.

### 4 — Submit the entire stack to GitHub

```bash
gt stack submit
# Flags:
#   --no-edit       skip PR body editor
#   --draft         open PRs as drafts
#   --publish       publish draft PRs
```

Graphite creates one PR per branch and links them automatically.

### 5 — Navigate the stack

```bash
gt branch up          # move to child branch
gt branch down        # move to parent branch
gt log                # visualise the full stack
gt log short          # compact one-line view
```

### 6 — After a review: amend a branch mid-stack

```bash
gt branch checkout feat/transaction-model
# ... fix the review comment ...
gt add -A
gt commit amend --no-edit          # amend without changing the commit message
gt stack restack                   # rebase all descendant branches onto the fix
gt stack submit                    # push the updated stack
```

### 7 — Sync after main moves forward

```bash
gt repo sync           # fetches main and restacks the full stack
# If conflicts appear, resolve them then:
git add .
gt continue
```

### 8 — Merge and clean up

When a PR is merged via Graphite:

```bash
gt repo sync           # marks the merged branch as landed and rebases the rest
```

## Branch Naming Convention

Follow the project's `<type>/<scope>-<detail>` convention:

| Layer                                       | Example                    |
| ------------------------------------------- | -------------------------- |
| Domain model                                | `feat/transaction-entity`  |
| Use-case / business logic                   | `feat/transaction-usecase` |
| GraphQL types + resolver                    | `feat/transaction-graphql` |
| DataLoader (if the feature adds a relation) | `feat/transaction-loader`  |

## Common Commands Cheatsheet

| Intent             | Command                       |
| ------------------ | ----------------------------- |
| Create branch      | `gt branch create <name>`     |
| Stage all          | `gt add -A`                   |
| Commit             | `gt commit create -m "<msg>"` |
| Amend last commit  | `gt commit amend`             |
| Submit/update PRs  | `gt stack submit`             |
| Restack after edit | `gt stack restack`            |
| View stack         | `gt log`                      |
| Sync with remote   | `gt repo sync`                |
| Navigate up        | `gt branch up`                |
| Navigate down      | `gt branch down`              |
| Checkout by name   | `gt branch checkout <name>`   |

## Integration with Project Skills

- **After `gt commit create`**: the `commit` skill is not needed — `gt commit create` handles the commit.
- **Before `gt stack submit`**: run `pnpm lint` and `pnpm test` to ensure CI passes.
- **Commit message format**: follow the project convention — `<type>(<scope>): <subject>` (no semicolons, English).

## Troubleshooting

### "Branch is not tracked by Graphite"

```bash
gt branch track --parent main   # manually declare the parent
```

### Restack conflict mid-way

```bash
# Resolve conflicts in editor, then:
git add .
gt continue
```

### Wrong parent branch

```bash
gt branch rename --parent <correct-parent>
gt stack restack
```

### PR submitted to wrong base

Graphite auto-corrects the PR base when you run `gt stack submit` after a restack.

## Exit Criteria

This skill is complete when:

- [ ] All feature branches are created and committed
- [ ] `gt log` shows the expected stack shape
- [ ] `gt stack submit` exits with `0` and all PRs are open on GitHub
- [ ] Each PR targets the correct parent branch (not `main`), except the bottom of the stack
