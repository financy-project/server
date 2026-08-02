# Skill: Write Test

**ID**: write-test

**Version**: 1.0.0

**Type**: quality

**Applicable Packages**: backend

## Description

Ensures test files are located next to source files and have proper structure with one `describe` block per file, following the project's unit/integration/e2e split.

Workflow:

1. Scans modified source files (excluding tests)
2. Finds or creates corresponding test file in `__tests__/` directory
3. Ensures one `describe` block per source file
4. Validates test structure and organization

## Usage

```bash
# Scan project for test file organization issues
python .claude/skills/write-test/write_test.py

# Or as a skill
/write-test
```

## Test File Structure (Architecture-Aligned)

Tests must follow the module's layer structure with **one describe block per file** — see [docs/architecture/08-testing.md](../../../docs/architecture/08-testing.md):

```
src/modules/<module>/__tests__/
├── unit/
│   ├── entity/
│   │   ├── <name>-create-describe.test.ts       ← one describe: "<Name>.create"
│   │   └── <name>-update-describe.test.ts        ← one describe: "<Name>.update"
│   ├── validation/
│   │   └── <action>-validation-describe.test.ts  ← one describe: "<Action>Validation.validate"
│   ├── use-cases/
│   │   └── <action>-describe.test.ts             ← one describe: "<Action>UseCase.<method>"
│   └── mappers/
│       └── <name>-mapper-describe.test.ts        ← one describe: "to<Name>Type"
├── integration/
│   ├── repository/
│   │   └── <name>-repository-describe.test.ts    ← one describe: "<Name>Repository (integration)"
│   └── e2e/
│       └── <action>-describe.test.ts             ← one describe: "<operationName> (e2e)"
└── factories/
    └── <name>.factory.ts
```

## ⚠️ Critical Rule: One File = One Describe Block

**EVERY test file must have EXACTLY ONE top-level `describe` block.** If you have multiple describes, split into multiple files.

```typescript
// ❌ WRONG: Two describes in one file
describe("Transaction.create", () => { ... })
describe("Transaction.update", () => { ... })  // ← Split into separate file!

// ✓ CORRECT: One describe per file
// src/modules/transaction/__tests__/unit/entity/transaction-create-describe.test.ts
describe("Transaction.create", () => {
  it("creates a transaction with provided data", () => { ... })
  it("generates unique id", () => { ... })
})

// src/modules/transaction/__tests__/unit/entity/transaction-update-describe.test.ts
describe("Transaction.update", () => {
  it("updates transaction amount", () => { ... })
})
```

## Test File Naming Convention

Format: `<subject>-<action>-describe.test.ts`

Examples:

- `transaction-create-describe.test.ts`
- `create-transaction-validation-describe.test.ts`
- `create-transaction-describe.test.ts` (use-case)
- `transaction-mapper-describe.test.ts`
- `transaction-repository-describe.test.ts`
- `create-transaction-describe.test.ts` (e2e, under `integration/e2e/`)

## Features

- ✅ Locates missing test files
- ✅ Verifies test file location (adjacent to source, inside `__tests__/`)
- ✅ Checks for `describe` block structure
- ✅ Generates template test file if missing (Jest-flavored, matching the layer it's for)
- ✅ Reports violations and remediation steps

## Exit Codes

- `0`: Success - all test files properly organized
- `1`: Test organization issues found (reported but non-fatal)
- `2`: Missing required environment variable
- `3`: File access error

## Output

Example output:

```
ANALYSIS RESULTS
================

✓ src/modules/transaction/entity/transaction.entity.ts
  → test: src/modules/transaction/__tests__/unit/entity/transaction-create-describe.test.ts (OK)

⚠ src/shared/utils/uuid.ts
  → MISSING TEST FILE
  → Suggested: src/shared/utils/__tests__/uuid.test.ts

✗ src/modules/transaction/resolvers/transaction.resolver.ts
  → test: src/modules/transaction/__tests__/transaction.resolver.test.ts (WRONG LOCATION)
  → Should be under __tests__/unit/ or __tests__/integration/e2e/, not the module root

SUMMARY
=======
Files checked: 12
- OK: 8
- Missing tests: 2
- Wrong location: 2
```

## Environment Variables

- `WORKSPACE_ROOT` (optional): Root directory for git operations
- `PACKAGE_NAME` (optional): Check specific package only
