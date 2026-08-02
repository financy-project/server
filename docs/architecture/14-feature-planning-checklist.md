# 14. Feature Planning Checklist

Comprehensive checklist for planning new features. Before writing `plan.md`, ensure all applicable areas are addressed — including the three GraphQL-specific additions folded into sections 5, 11, and 13 below.

---

## 1. Scope & Requirements

Define what the feature is, what it's not, and success criteria.

**Key Questions:**

- What is the core user need/problem being solved?
- What are the acceptance criteria (testable conditions)?
- What is explicitly OUT of scope?
- Any backward compatibility constraints?

**Anti-Pattern:**

- Vague acceptance criteria ("user can log in")
- No clear scope boundary

**Example (login feature):**

- ✅ "Users can log in with email/password and receive a JWT token valid for 7 days"
- ❌ "Auth system" (too vague)

---

## 2. Data & State

Define what data is created, modified, persisted, and how state changes flow.

**Key Questions:**

- What new entities/records are created?
- Which existing entities are modified?
- How long is data retained? Eventually deleted or archived?
- Constraints on data (uniqueness, foreign keys)?

**Anti-Pattern:**

- Creating data with no clear lifecycle
- Missing constraints leading to invalid states

---

## 3. User Experience

How users interact with the feature, error handling, and accessibility.

**Key Questions:**

- What's the happy path interaction?
- What error message (and `extensions.code`) does the client see for each failure mode?
- Is this accessible (a GraphQL API's "accessibility" is mostly about client ergonomics: clear field names, sensible nullability)?

**Anti-Pattern:**

- No consideration for error cases
- Generic error messages with no `extensions.code` a client can branch on

**Example:**

- ✅ Login fails with `extensions.code: 'UNAUTHENTICATED'` and a message that doesn't leak which field was wrong
- ❌ A bare `"Error"` string with no `extensions.code`

---

## 4. Testing & Validation

Test strategy across all layers (unit, integration, e2e).

**Key Questions:**

- What are the happy-path and sad-path test cases?
- How is this tested end-to-end (real GraphQL operations via `executeOperation()`)?
- Security test cases (can users bypass authorization)?

**Anti-Pattern:**

- Only testing the happy path
- No e2e test asserting on `errors[].extensions.code`

---

## 5. Implementation Details

Architecture decisions, dependencies, code organization — **including GraphQL-specific ones**.

**Key Questions:**

- Which modules/layers does this touch?
- New dependencies to add (packages)?
- Existing utilities/functions to reuse?
- Breaking changes to the existing schema?
- **Does this add a relational field?** If so, does it need a new `DataLoader` (see [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md))?
- **Does this add a list-returning or deeply-nested field?** If so, what `complexity` value does it declare?
- Does `schema.graphql` need to be regenerated and committed as part of this PR?

**Anti-Pattern:**

- Adding new packages without considering existing solutions
- A new relational field with no DataLoader plan — this is how N+1 bugs ship
- Shipping a schema change without regenerating `schema.graphql`

---

## 6. Security Considerations

Authentication, authorization, secrets, timing attacks, data protection.

**Key Questions:**

- Authentication mechanism (JWT via context, sessions)?
- Authorization — checked in the resolver or use-case for _this specific_ operation?
- Timing-safe comparisons (prevent user enumeration)?
- Rate limiting or query complexity limits on sensitive/expensive operations?

**Anti-Pattern:**

- Hardcoded secrets
- Timing-unsafe auth failures (user enumeration)
- Assuming `ctx.currentUser` being non-null is sufficient authorization for every field/mutation

---

## 7. Complex Workflows

Multi-step operations, async processing, state machines, sagas.

**Key Questions:**

- Is this a single atomic operation or multi-step?
- Can steps fail independently? Compensation/rollback logic if step N fails?

**Anti-Pattern:**

- Assuming all steps always succeed
- No rollback strategy when steps fail

---

## 8. Cross-Cutting Concerns

Logging, caching, monitoring, observability, request tracing.

**Key Questions:**

- What needs to be logged (and at what level)?
- Should this be cached? Where, and for how long (TTL)?
- What metrics should be recorded (operation latency, error rates by `extensions.code`)?
- Request correlation IDs for tracing (threaded through `ctx`)?

**Anti-Pattern:**

- No logging (can't debug production issues)
- Logging secrets, tokens, or PII

---

## 9. Error Scenarios & Failure Modes

What happens when things go wrong: rollbacks, retries, race conditions.

**Key Questions:**

- What if the database is down?
- What if an external service fails?
- Race condition scenarios (concurrent mutations)?
- Retry logic, timeout strategy?

**Anti-Pattern:**

- Assuming operations always succeed
- No rollback on partial failures

---

## 10. Performance & Scale

Throughput, latency, indexes, caching, pagination.

**Key Questions:**

- Expected throughput?
- Latency requirements?
- Database indexes needed?
- Pagination strategy — cursor-based is strongly preferred for GraphQL lists (stable under concurrent inserts, and pairs naturally with `@FieldResolver` + `DataLoader`)?

**Anti-Pattern:**

- No indexes on frequently queried columns
- An unbounded list field with no pagination and no `complexity` declared

---

## 11. Module Composition

Whether to create one module or multiple, dependencies, isolation.

**Key Questions:**

- Should this be 1 module or multiple?
- How do modules communicate (events, ports/adapters/gateways)?
- Which module owns the resolver for a field that spans two modules' data (usually the module that owns the parent type)?

**Anti-Pattern:**

- One massive module doing everything
- Direct imports between modules (violates isolation)
- A `@FieldResolver` reaching into another module's repository instead of going through a port/adapter/gateway

---

## 12. Deployment & Operations

Migrations, rollback strategy, feature flags, canary deployment.

**Key Questions:**

- Database migrations needed?
- Rollback plan?
- Feature flags for gradual rollout of a new mutation/field?
- Monitoring after deployment (error rate by `extensions.code`)?

**Anti-Pattern:**

- No rollback plan
- Migrations that can't be rolled back

---

## 13. Backward Compatibility

Schema evolution, deprecation, old client support — **the GraphQL equivalent of API versioning**.

**Key Questions:**

- Is this a breaking change to the schema (removed field/argument, changed nullability, renamed type)?
- If a field is being retired, is it marked `@deprecated(reason: "...")` first, with a real deprecation window, instead of removed outright?
- Do old clients need to keep working against the same schema?
- Communication plan (schema diff in the PR, changelog)?

**Anti-Pattern:**

- Removing or renaming a field without a `@deprecated` period first
- Changing a field from nullable to non-nullable (or vice versa) without checking existing client queries
- Changing an argument's type in place instead of adding a new one

**Example:**

- ✅ Add `fullName` as a new field, mark `name` `@deprecated(reason: "use fullName")`, remove `name` in a later, separately-communicated release
- ❌ Rename `name` to `fullName` in place — every existing client query breaks immediately

---

## Workflow

1. **Read this checklist** — understand all 13 areas
2. **Answer the questions** for every applicable area (a `/grill-me`-style pass, once that tooling exists)
3. **Write `plan.md`** — include a section for each applicable area (or "Not Applicable" with justification), plus the [DoR Blueprints](11-dor.md) (Entities, Repositories, Use-Cases, GraphQL Blueprint, Domain Events)
4. **Verify coverage** — double-check no critical area is missing
5. **Break into tasks** — layer-by-layer, following [13. Backend Development Checklist](13-backend-development-checklist.md)

---

## Checklist Summary

- [ ] 1. Scope & Requirements
- [ ] 2. Data & State
- [ ] 3. User Experience — error codes clients can branch on
- [ ] 4. Testing & Validation — unit, integration, e2e coverage
- [ ] 5. Implementation Details — module boundaries, **DataLoader needs, complexity budget, schema.graphql regeneration**
- [ ] 6. Security Considerations — auth, secrets, timing-safe, per-operation authorization
- [ ] 7. Complex Workflows — (if applicable) multi-step, async, rollback strategy
- [ ] 8. Cross-Cutting Concerns — logging, caching, monitoring, tracing
- [ ] 9. Error Scenarios — rollbacks, retries, race conditions, timeouts
- [ ] 10. Performance & Scale — throughput, indexes, **cursor pagination**
- [ ] 11. Module Composition — boundaries, dependencies, **field ownership across modules**
- [ ] 12. Deployment & Operations — migrations, rollback, feature flags, monitoring
- [ ] 13. Backward Compatibility — **`@deprecated` before removal, nullability changes checked**

---

Next: [Checklist](checklist.md) — the pre-PR version of this document.
