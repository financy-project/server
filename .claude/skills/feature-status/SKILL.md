---
name: feature-status
id: feature-status
version: 1.0.0
type: utility
---

# Skill: Show Feature Status

Display task progress for the current feature.

## Usage

```bash
/feature-status
/feature-status PM-001
```

## What it does

1. Auto-detects current feature from git branch (e.g. `PM-001/transaction-categorization`)
   - OR accepts explicit feature ID as argument
2. Reads `docs/features/PM-NNN-*/tasks.md` and `test-cases.md` (and, if present, each `phases/phase-N-slug/tasks.md`)
3. Counts `[x]` (done) vs `[ ]` (pending)
4. Shows progress, broken down by phase if `phases/` exists

## Output

```
Feature: PM-001: Transaction Categorization

Overall:  4/11  ████░░░░░░ 36%

Phase 1: Foundation   3/3  ██████████ 100%
Phase 2: Features     1/6  ██░░░░░░░░ 17%
Phase 3: Polish        0/2  ░░░░░░░░░░ 0%

Test Cases: 2/5  ████░░░░░░ 40%
```

## Requirements

- Must be on a feature branch (auto-detect), OR provide feature ID
- `tasks.md` must exist in the feature's `docs/features/PM-NNN-*/` directory

## See Also

- `/feature-new` — create a feature
- `/feature-task` — generate task files
