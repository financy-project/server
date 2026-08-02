---
name: feature-plan
id: feature-plan
version: 1.0.0
type: planning
---

# Skill: Plan Feature

Write the implementation plan for a feature by clarifying requirements with grill-me.

## Usage

```bash
/feature-plan
```

## What it does

1. Auto-detects current feature from git branch (e.g. `PM-001/transaction-categorization`)
2. Reads `spec.md` for feature context
3. **Reads planning checklist**: `docs/architecture/14-feature-planning-checklist.md` to understand all 13 planning areas
4. **Invokes `/grill-me`** (which covers all 13 areas: 8 always-asked + 5 optional/triggered, plus the GraphQL-specific additions folded into areas 5, 11, and 13) to surface edge cases and clarify requirements
5. Writes `plan.md` based on spec + grill-me answers
   - **Must follow the DoR:** `docs/architecture/11-dor.md` requires explicit blueprints for:
     - **Types & Enums** — domain data structures
     - **Entity** — business logic (or "Omitted" + justification)
     - **Errors & Error Families** — domain errors (or "Omitted" + justification)
     - **Repository** — data access layer (or "Omitted" + justification)
     - **Use-Cases** — orchestration and business flows, with a Decision Table for any branching logic (or "Omitted" + justification)
     - **GraphQL Blueprint** — Object/Input/Args types, resolver signature, mapper, DataLoader need, complexity cost (or "Omitted" + justification) — this replaces the REST reference project's "Controller" blueprint
     - **Domain Events** — event name, payload type, emitter, subscriber, and `listenersRegistrator.ts` wiring status (required if any Use-Case emits/consumes an event; "Omitted" otherwise)
   - **Architectural Decisions section** covers all 13 areas from the planning checklist, each either fully specified or marked "Not Applicable" with justification
   - **Implementation Phases section** breaks the Blueprints down into `B-NNN`-ready bullets — each one carrying an exact file path, exact symbol/signature or field list, and exact test cases, per `docs/architecture/11-dor.md`'s granularity rule. `/feature-task` copies these bullets verbatim into `tasks.md` with zero elaboration, so anything left vague here stays vague for whoever implements it.
   - **Test Cases section** — sibling to Implementation Phases, same `### Phase N:` grouping (identical phase names), one checkbox per test case traceable to a Decision Table row / Entity method / GraphQL Blueprint response case already in the Blueprints.
6. If this repository has a matching GitHub issue for the feature (see `/feature-new`), comments the full content of `plan.md` on it
7. Prompts user to run `/feature-task` to break down into layer-by-layer tasks (including error handling, migrations, observability, DataLoader/complexity where applicable)

## Requirements

- Must be on a feature branch: `PM-NNN/slug`
- `spec.md` must exist with feature description
- `gh` CLI installed and authenticated (optional — plan.md is still written locally if GitHub is unavailable; only the issue comment step is skipped)

## Output

- `plan.md` — architecture and design decisions
- A comment on the matching GitHub issue with the implementation plan, if one exists and `gh` is available
- User prompted to run `/feature-task` next

## Execution Instructions for AI Assistant

1. Detect the feature ID (e.g., `PM-001`) from the current git branch name.
2. Follow the `/grill-me` workflow and write `plan.md`.
   - **Before writing:** Read `docs/architecture/11-dor.md` to understand the DoR requirements
   - **While writing:** Ensure the plan includes all Blueprint sections (Entity, Repository, Use-Case, GraphQL, Domain Events), each either fully specified or marked `**Omitted:**` with justification. Entity Properties and Domain Event Payloads must be actual TypeScript type blocks, not prose. Use-Cases with more than one branching condition must include a Decision Table. The GraphQL Blueprint must state explicitly whether a DataLoader is needed and what complexity cost applies.
   - **While writing the Implementation Phases section:** every bullet must be traceable to a Blueprint above and carry its exact file path, exact symbol/signature or field list, and exact test cases inline.
   - **While writing the Test Cases section:** use the exact same `### Phase N: <name>` headings as Implementation Phases.
   - **After writing:** Verify every blueprint has the required sub-fields per the DoR, verify every Implementation Phases bullet meets the granularity bar, and verify the Test Cases section's phase headings match Implementation Phases exactly.
3. If a GitHub remote is configured and `gh` is authenticated, locate the corresponding issue by searching for the feature ID:
   ```bash
   ISSUE_NUMBER=$(gh issue list --search "$FEATURE_ID" --state all --json number --jq '.[0].number')
   ```
4. If found, post the content of `plan.md` as a comment on that issue:
   ```bash
   gh issue comment "$ISSUE_NUMBER" --body-file "docs/features/$FEATURE_DIR/plan.md"
   ```
5. Confirm to the user that the plan has been saved, and whether the GitHub comment step ran or was skipped.

## Example

```bash
git checkout PM-001/transaction-categorization
/feature-plan

# Reads: docs/features/PM-001-transaction-categorization/spec.md
# Invokes: /grill-me (user answers questions)
# Writes: docs/features/PM-001-transaction-categorization/plan.md
# Comments on the matching GitHub issue, if one exists
# Says: "Run /feature-task to generate task files"
```

## See Also

- `/feature-new` — create a new feature
- `/feature-task` — generate task files from plan
