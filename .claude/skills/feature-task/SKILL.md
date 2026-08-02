---
name: feature-task
id: feature-task
version: 1.0.0
type: planning
---

# Skill: Generate Feature Tasks

Break down the implementation plan into a flat, phase-organized task file.

## Usage

```bash
/feature-task
```

## What it does

1. Auto-detects current feature from git branch
2. **Validates `plan.md` against DoR** — before generating tasks, verify the plan contains all architectural sections required by `docs/architecture/11-dor.md`:
   - **Entity & Types** ✓
   - **Enums** (if domain-specific states/values needed) ✓
   - **Errors** (domain errors and error families) ✓
   - **Repository** ✓
   - **Use-Cases** (with a Decision Table for any branching logic) ✓
   - **GraphQL Blueprint** (Object/Input/Args types, resolver, mapper, DataLoader need, complexity cost) ✓
   - **Domain Events** (required if any Use-Case emits/consumes an event) ✓
   - Each section either fully specified or explicitly marked `**Omitted:**`. If any required section is missing entirely (not even marked Omitted), stop and report which section(s) are missing.
3. Reads `plan.md` to understand what work needs to be done
4. Generates task file: `tasks.md` with tasks `B-NNN`, organized by implementation layers. This step is purely mechanical — it copies each `## Implementation Phases` bullet from `plan.md` **verbatim**, prefixed with a `B-NNN` id. No elaboration happens here.
   - **Soft granularity check:** after generating `tasks.md`, warns (does not block) on any task with no backtick-quoted file path/symbol.
5. Generates `test-cases.md` the same mechanical way, from `plan.md`'s `## Test Cases` section, with `T-NNN` ids. Comments it on the matching GitHub issue if one exists and `gh` is available.
6. **Slices `tasks.md` and `test-cases.md` by phase** into `docs/features/PM-NNN-*/phases/phase-N-slug/{tasks.md,test-cases.md}`.
7. **Copies the `## Definition of Ready (DoR) Blueprints` section verbatim into every phase folder** as `phases/phase-N-slug/blueprint.md` — identical content in every phase, since Blueprints are organized by layer, not by phase. Byte-identical across phases by design, so it hits Anthropic's prompt cache from the second phase onward.
8. Each task: `- [ ] B-NNN: Description` (B = backend, NNN = sequence number)
9. **Task layers** must follow this order:
   - Enums (if needed)
   - Types
   - Entity + Entity Tests
   - Errors
   - GraphQL Input/Args Types + Validation + Validation Tests
   - Repository + Repository Integration Tests
   - Use-Cases + Use-Case Unit Tests
   - GraphQL Object Type + Mapper + Mapper Tests
   - Resolver
   - Loaders (if the GraphQL Blueprint isn't marked Omitted for DataLoader needs)
   - Domain Events (receivers + explicit `listenersRegistrator.ts` wiring task, if the Domain Events Blueprint isn't marked Omitted)
   - E2E Tests
   - i18n keys
   - `schema.graphql` regeneration (if the schema changed)

## Requirements

- Must be on a feature branch: `PM-NNN/slug`
- `plan.md` must exist and describe the changes
- `plan.md` must meet the Definition of Ready (DoR): see `docs/architecture/11-dor.md` for blueprint requirements

## Output

- `tasks.md` and `test-cases.md` in the feature directory (flat, all phases — `test-cases.md` also commented on the matching GitHub issue, if any)
- `phases/phase-N-slug/tasks.md`, `test-cases.md`, and `blueprint.md` — per-phase slices `/workflow` reads instead of the flat files
- Each task ready to implement

## Example

```bash
git checkout PM-001/transaction-categorization
/feature-task

# Reads: docs/features/PM-001-transaction-categorization/plan.md
# Creates:
#   docs/features/PM-001-transaction-categorization/tasks.md
#   docs/features/PM-001-transaction-categorization/test-cases.md
#   docs/features/PM-001-transaction-categorization/phases/phase-1-foundation/{tasks.md,test-cases.md,blueprint.md}
#   ... one phases/phase-N-slug/ folder per phase
#
# tasks.md contains:
#   - [ ] B-001: Implement `TransactionCategory` enum
#   - [ ] B-002: Implement `assignCategory` use-case
#   - [ ] B-003: Add `categoryById` DataLoader
#   - [ ] B-004: Write E2E test for `assignCategory` mutation
#
# test-cases.md contains:
#   - [ ] T-001: assignCategory mutation returns NOT_FOUND for unknown transaction id
#   - [ ] T-002: assignCategory use-case throws CategoryNotFoundError when missing
```

## See Also

- `/feature-plan` — write the implementation plan
- `/feature-status` — view task progress
