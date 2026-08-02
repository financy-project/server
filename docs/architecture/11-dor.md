# 11. Definition of Ready (DoR) for Planning

This document defines the **Definition of Ready (DoR) for Planning**, tailored for our GraphQL/Apollo/TypeGraphQL/Prisma architecture. Before any implementation plan (`plan.md`) is considered ready to be converted into actionable tasks, it must explicitly outline the structural blueprints for each layer.

## Required Blueprints in `plan.md`

All blueprint sub-sections below must be wrapped in a single top-level heading, written **exactly** as `## Definition of Ready (DoR) Blueprints`. A future `/feature-task` skill is expected to extract everything between that heading and the next `## ` heading verbatim into per-phase blueprint files — the exact string match is what would make that extraction reliable, so don't rename or reword it even before that tooling exists.

Your plan must use explicit markdown headings (e.g., `### Entity Blueprint`) and define the following structures:

### 1. Entities

Define the domain models and their core business logic.

- **Entity Name**
- **Properties block:** an actual TypeScript type, not a prose list — copy-paste ready for the entity's `Props` type. All properties are implicitly `readonly` per our entity pattern (see [02. Entities](02-entities.md)); do not restate that per field.
  ```ts
  type ActivationCodeProps = {
    id: string
    userId: string
    code: string
    createdAt: Date
    expiresAt: Date
  }
  ```
- **Methods** (business rules, validations, state transitions) — exact method names + signatures, e.g. `isExpired(): boolean`, `matches(candidate: string): boolean`

### 2. Repositories

Define the data access contract.

- **Repository Name**
- **Methods:** required database queries/mutations (e.g., `findByEmail`, `save`), including any `findManyByIds` needed to back a `DataLoader` (see [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md))
- **Data Mapping:** any specific Prisma conversions needed

### 3. Use-Cases

Define the orchestrator logic.

- **Use-Case Name**
- **Inputs/Outputs:** what data it accepts and returns (entities, never GraphQL types)
- **Orchestration Steps:** the sequence of calls to repositories, external services, or entities — numbered, each step naming the exact function called
- **Decision Table (required whenever the use-case branches on more than one condition):** an explicit `condition → outcome` table covering every combination, not narrative prose

  _Example (from `ActivateAccountUseCase`):_

  | Condition                       | Outcome                            |
  | ------------------------------- | ---------------------------------- |
  | `!user \|\| !activationCode`    | throw `InvalidActivationCodeError` |
  | expired, code matches           | throw `ActivationCodeExpiredError` |
  | not expired, code matches       | proceed to activation              |
  | not expired, code doesn't match | throw `InvalidActivationCodeError` |

- **Emitted Events:** any domain events fired by this use-case — event name + exact payload shape (see Domain Events Blueprint below if any subscriber needs to be wired)

### 4. GraphQL Blueprint

Define the schema boundary — this replaces the REST reference project's "Controllers" blueprint.

- **Object Type(s):** name + exact `@Field()` list (name, GraphQL type, nullable?) — copy-paste ready for the `@ObjectType()` class
- **Input Type / Args Type:** name + exact `@Field()` + `class-validator` decorator list per field (see [05. Validation](05-validation.md)) — this is also the validation spec, don't write it twice
- **Resolver Name & Operation:** `@Query`/`@Mutation`/`@FieldResolver`, exact GraphQL operation name and signature
- **Mapper:** confirm a `toXType()` mapper exists or needs to be created for every entity this feature returns
- **DataLoader needed?** State explicitly yes/no. If yes: which relation, which module owns the loader, and the repository method it batches through (e.g., `findManyByIds`)
- **Complexity cost:** for any list-returning or deeply-nested field, state the `complexity` value to declare (see [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md)) — default is fine for simple scalar fields, but say so explicitly rather than leaving it unstated

### 5. Domain Events

Required whenever a Use-Case Blueprint lists an **Emitted Event**, or the feature reacts to an event emitted elsewhere. Omit only if the feature emits and consumes no events.

- **Event Name** (e.g. `user.activation-code.generated`)
- **Payload Shape:** an actual TypeScript type, same rule as the Entity Properties block
- **Emitted By:** which use-case, at which step
- **Subscribed By:** receiver name + module, or "none yet — event has no consumer in this feature"
- **Registration:** state explicitly whether `.subscribe()` is already wired in `src/utils/listenersRegistrator.ts` or is a **new task to add it there**. A receiver with no corresponding line in `listenersRegistrator.ts` is dead code that passes its own unit test while doing nothing in the running app — this field is mandatory, not optional.

## Test Cases

Every plan must include a `## Test Cases` section, sibling to `## Implementation Phases`, using the same `### Phase N: <name>` grouping. This is **not a second design surface** — every entry must already be traceable to something already decided in the Blueprints above: a Use-Case Decision Table row, an Entity method, a GraphQL Blueprint response case.

```markdown
## Test Cases

### Phase 1: Foundation

- [ ] `ActivationCode.create()` sets a 15-minute expiry and a 6-digit code
- [ ] `ActivationCode.isExpired()` returns true/false correctly

### Phase 2: Features

- [ ] `activateAccount` mutation happy path activates and emits `user.activated`
- [ ] `activateAccount` mutation wrong code → `extensions.code: 'BAD_USER_INPUT'`
- [ ] `activateAccount` mutation expired-but-correct code → `extensions.code: 'BAD_USER_INPUT'` with `ActivationCodeExpiredError` message
```

May be omitted only if the feature has no Entity, Use-Case, or GraphQL Blueprint requiring test coverage (e.g. a pure config/infra change) — state `**Omitted:**` with justification, same as any other blueprint.

---

## 🛑 The Critical Omission Rule

**Not every feature requires every architectural layer.** If a component typically required by our architecture is **NOT** needed for the feature being planned, you **MUST explicitly state "Omitted"** in the plan and provide a brief justification.

_Example:_

> ### GraphQL Blueprint
>
> **Omitted:** This feature only changes internal business logic in `RegisterUserUseCase`; no new fields, types, or operations are exposed on the schema.

## Implementation Phases Must Match Task Granularity

`## Implementation Phases` is not a summary — a future `/feature-task` skill is expected to copy its bullets **verbatim** into `tasks.md`, one bullet per `B-NNN` task, with zero elaboration in between. Whatever granularity you write here is exactly what an implementer (human or agent) receives as its only instruction for that task.

Each phase bullet must therefore be traceable to its Blueprint above and include, inline:

- **Exact file path** (e.g. `src/modules/auth/entity/activation-code.entity.ts`)
- **Exact symbol name + signature or field list** (method names, params, return type — pulled straight from the Blueprint, not paraphrased)
- **Exact test location + enumerated cases**, when the item needs tests

_Weak (rejected — leaves the implementer to invent the shape):_

> - [ ] `ActivationCode` entity (+ unit tests)

_Correct (implementer just implements, doesn't decide):_

> - [ ] Implement `ActivationCode` entity (`src/modules/auth/entity/activation-code.entity.ts`): `create({ userId })`, `fromRepository(props)`, `isExpired()`, `matches(candidate)` (constant-time via `crypto.timingSafeEqual`)
> - [ ] Unit tests for `ActivationCode` entity: `create` sets a 15-minute expiry and a 6-digit code, `isExpired` true/false, `matches` correct/incorrect code

If a bullet can't be written this concretely yet, the Blueprint it comes from is incomplete — finish the Blueprint before writing the phase breakdown.

## Why This Is Required

These blueprints act as a strict guide for whoever executes the tasks. Providing explicit signatures — including exact GraphQL field lists and `class-validator` decorators — prevents hallucinated schema shapes, stops architectural drift, and ensures a clean, predictable implementation phase.

---

Next: [GraphQL Operational Concerns](12-graphql-operational-concerns.md)
