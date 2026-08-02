# Skill: Semantic & Atomic Commit

**ID**: commit

**Version**: 1.0.0

**Type**: utility

**Applicable Packages**: all

## Description

Creates semantic, atomic commits that keep source files and their tests together.

Workflow:

1. Detects changed files via `git diff --name-only`
2. Groups source files with their corresponding tests
3. Stages grouped files together
4. Prompts user for commit type (feat, fix, test, refactor, docs, chore, perf, style)
5. Creates commit with semantic message: `<type>(<scope>): <subject>`

## Usage

```bash
# After making changes to code and tests
python .claude/skills/commit/commit.py
```

## Behavior

**Example scenario:**

You modified:

- `src/modules/transaction/use-cases/create-transaction.use-case.ts`
- `src/modules/transaction/__tests__/unit/use-cases/create-transaction-describe.test.ts`
- `src/shared/utils/uuid.ts`
- `src/shared/utils/__tests__/uuid.test.ts`

Skill will:

1. Detect 4 changed files
2. Group into 2 atomic units:
   - `create-transaction.use-case.ts` + its test
   - `uuid.ts` + its test
3. For each group, ask: "Commit type? (feat/fix/test/refactor/docs/chore/perf/style)"
4. Create two commits:
   - `feat(transaction): add create-transaction use-case`
   - `refactor(utils): improve uuid generation`

Scope is inferred from the file path — `src/modules/<name>/...` → scope `<name>`; otherwise falls back to the top-level folder under `src/` (`shared`, `services`, `lib`, etc.).

## Exit Codes

- `0`: Success - all commits created
- `1`: Git error or commit failed
- `2`: No changes to commit
- `3`: User cancelled

## Environment Variables

- `WORKSPACE_ROOT` (optional): Root directory for git operations
