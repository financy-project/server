---
name: feature-new
id: feature-new
version: 1.0.0
type: utility
---

# Skill: Create New Feature

Create a new feature with PM-NNN numbering (PM-001, PM-002, ...), with optional GitHub integration.

> Like the sibling REST project this workflow was adapted from, features are tracked centrally in the dedicated **[financy-project/features](https://github.com/financy-project/features)** repository — issues and milestones for every project in the org (server, client, ...) live there, sharing a single PM-NNN sequence. The `spec.md`/`plan.md`/`tasks.md` files still live locally in each project's `docs/features/`, next to the code that implements them. The tracking repo is hardcoded as `TRACKING_REPO` at the top of `feature-new.sh` (and referenced the same way in `feature-plan` and `feature-task`).

## Usage

```bash
/feature-new "Feature Name"
/feature-new "Feature Name" --milestone "v1.0"
/feature-new "Feature Name" --milestone "Sprint-05"
```

## What it does

1. Finds next available PM number by scanning `docs/features/` locally, and the `financy-project/features` repo's GitHub issues if `gh` is authenticated
2. Creates `docs/features/PM-NNN-slug/` with `spec.md` and `plan.md` in **this** repository
3. If `--milestone` provided and `gh` is configured:
   - Creates a GitHub milestone in `financy-project/features` if it doesn't exist
   - Creates a GitHub issue there, linked to the milestone, pointing back at this repo/branch/files
4. Creates git branch: `PM-NNN/slug`

## Example

```bash
/feature-new "Transaction Categorization" --milestone "v1.0"

# Creates:
#   docs/features/PM-001-transaction-categorization/   (in this repo)
#   ├── spec.md
#   ├── plan.md
#
# GitHub (in financy-project/features, if gh is configured):
#   - Milestone: "v1.0" (if not exists)
#   - Issue: "PM-001: Transaction Categorization" (linked to milestone)
#
# Git: branch PM-001/transaction-categorization checked out (in this repo)
```

## Next Steps

1. Fill out `spec.md` with feature description and acceptance criteria
2. Run `/feature-plan` to write `plan.md` and run grill-me
3. Run `/feature-task` to generate `tasks.md`
4. Start implementing!
