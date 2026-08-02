---
name: fix-pr-review
id: fix-pr-review
version: 1.0.0
type: automation
---

# Skill: Fix PR Review

Automatically check out a Pull Request branch, stash local work, apply review fixes (manually or autonomously), commit changes, rebase onto the base branch, and safely force-push.

## Usage

```bash
/fix-pr-review <PR_NUMBER> ["review description/comments"]
```

## Examples

```bash
# Manual mode: checkout branch and stash local work
/fix-pr-review 12

# Autonomous mode: switch, apply fixes, test, commit, rebase, push and restore state automatically
/fix-pr-review 12 "add a DataLoader for Transaction.category and update the E2E test's extensions.code assertion"
```

## Modes

1. **Manual Mode** (`/fix-pr-review <PR_NUMBER>`):
   - Prepares the branch by stashing local changes.
   - Checks out the PR branch.
   - Displays clear next steps for the developer.
2. **Autonomous Mode** (`/fix-pr-review <PR_NUMBER> "description"`):
   - Swaps to the PR branch.
   - Spawns a Claude sub-agent with the `backend-engineer` persona to apply the requested changes.
   - Runs build and tests (auto-detects pnpm/yarn/npm).
   - Commits changes using the `/commit` skill.
   - Rebases the PR branch onto the PR's target base branch.
   - Force-pushes to origin with `--force-with-lease`.
   - Returns to the original branch and restores stashed changes automatically.

## Requirements

- GitHub CLI (`gh`) authenticated and configured in the repository.
- Git configured.
- Claude Code CLI available (for autonomous mode).

## Error Handling

- **Rebase Conflicts**: If conflicts arise during rebase, the script aborts, leaving the workspace in the PR branch for manual conflict resolution.
- **Stash Safety**: Always stashes uncommitted changes before checkout and restores them at the end.
