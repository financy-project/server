---
name: feature-new
id: feature-new
version: 1.0.0
type: utility
---

# Skill: Create New Feature

Create a new feature with PM-NNN numbering (PM-001, PM-002, ...), with optional GitHub integration.

> Unlike the sibling REST project this workflow was adapted from, this repo has **no separate centralized `features` repository** — milestones and issues are created in **this repository** by default. If your team later sets up a dedicated tracking repo, update the `-R` target in `feature-new.sh` (and the other `feature-*` scripts) accordingly.

## Usage

```bash
/feature-new "Feature Name"
/feature-new "Feature Name" --milestone "v1.0"
/feature-new "Feature Name" --milestone "Sprint-05"
```

## What it does

1. Finds next available PM number by scanning `docs/features/` locally, and this repository's GitHub issues if a remote is configured
2. Creates `docs/features/PM-NNN-slug/` with `spec.md` and `plan.md`
3. If `--milestone` provided and `gh` is configured:
   - Creates a GitHub milestone in this repository if it doesn't exist
   - Creates a GitHub issue linked to the milestone
4. Creates git branch: `PM-NNN/slug`

## Example

```bash
/feature-new "Transaction Categorization" --milestone "v1.0"

# Creates:
#   docs/features/PM-001-transaction-categorization/
#   ├── spec.md
#   ├── plan.md
#
# GitHub (if gh is configured):
#   - Milestone: "v1.0" (if not exists)
#   - Issue: "PM-001: Transaction Categorization" (linked to milestone)
#
# Git: branch PM-001/transaction-categorization checked out
```

## Next Steps

1. Fill out `spec.md` with feature description and acceptance criteria
2. Run `/feature-plan` to write `plan.md` and run grill-me
3. Run `/feature-task` to generate `tasks.md`
4. Start implementing!
