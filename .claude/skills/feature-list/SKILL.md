---
name: feature-list
id: feature-list
version: 1.0.0
type: utility
---

# Skill: List Features

List all features and their status.

## Usage

```bash
/feature-list
```

## What it does

1. Scans `docs/features/` for all `PM-NNN-*` directories (skipping `_templates/`)
2. Reads `tasks.md`/`test-cases.md` from each feature to compute completion %
3. Shows the matching GitHub issue status (open/closed) from the dedicated tracking repo (`financy-project/features`), if `gh` is authenticated: `gh issue list -R financy-project/features --search "$PM_NUM" --state all`
4. Displays feature details in a table

## Output

```
PM-001: Transaction Categorization
  Progress: 4/11 tasks (36%)
  Issue: #12 (open)

PM-002: Recurring Budgets
  Progress: 9/9 tasks (100%)
  Issue: #14 (closed)
```

## See Also

- `/feature-new` — create a new feature
- `/feature-status` — view current feature task progress
