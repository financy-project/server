---
name: grill-me
id: grill-me
version: 1.0.0
type: planning
---

# Skill: Grill Me

Ask probing questions about a feature to validate the plan and uncover edge cases.

## Usage

```bash
/grill-me
```

## What it does

Interactively asks clarifying questions about the current feature being planned, covering all 13 areas from [docs/architecture/14-feature-planning-checklist.md](../../../docs/architecture/14-feature-planning-checklist.md).

## Always-Asked Areas (all features)

1. **Scope & Requirements**
   - What are the success criteria?
   - What is explicitly out of scope?
   - Any backward compatibility constraints?

2. **Data & State**
   - What new entities/records are created?
   - Which existing entities modified?
   - Data lifecycle (retention, deletion, archival)?
   - Constraints (uniqueness, foreign keys)?

3. **User Experience**
   - What's the happy-path interaction?
   - What error message (and `extensions.code`) does the client see for each failure?
   - Any GraphQL-client ergonomics to consider (nullability choices, field naming)?

4. **Testing & Validation**
   - Unit, integration, e2e test strategy?
   - Happy-path and sad-path test cases?
   - Security test cases?

5. **Implementation Details**
   - Which modules/layers involved?
   - Dependencies to add?
   - Existing utilities to reuse?
   - Breaking changes to the schema?
   - **Does this add a relational field? Does it need a `DataLoader`?**
   - **Does this add a list-returning or deeply-nested field? What `complexity` value?**
   - Does `schema.graphql` need regenerating as part of this PR?

6. **Security Considerations** ⚠️ (always asked)
   - Authentication/authorization strategy? Checked per-operation, not just per-request?
   - Password handling (hash algorithm)?
   - Session/token lifecycle and expiration?
   - Rate limiting or query complexity limits for sensitive/expensive operations?
   - Timing-safe comparisons (prevent user enumeration)?

7. **Cross-Cutting Concerns** ⚠️ (always asked)
   - Logging strategy (what, where, level)?
   - Caching needed (where, TTL)?
   - Monitoring/metrics (operation latency, error rate by `extensions.code`)?
   - Request correlation IDs threaded through context?

8. **Error Scenarios & Failure Modes** ⚠️ (always asked)
   - What if the database is down?
   - What if external services fail?
   - Race condition scenarios (concurrent mutations)?
   - Rollback strategy on partial failures?
   - Retry logic (how many, backoff)?
   - Timeout strategy?

## Optional Areas (triggered by keywords in spec)

9. **Complex Workflows** (triggered if spec mentions: async, queue, saga, multi-step, long-running)
   - Is this multi-step or async?
   - State machine or saga pattern needed?
   - Compensation/rollback logic?
   - Timeout strategy?

10. **Performance & Scale** (triggered if spec mentions: bulk, high-volume, throughput, latency)
    - Expected throughput (ops/sec)?
    - Latency requirements?
    - Database indexes needed?
    - Cursor-based pagination strategy for list fields?
    - Caching layer for repeated queries?

11. **Module Composition** (triggered if spec spans multiple modules or touches multiple layers)
    - Should this be 1 module or multiple?
    - Inter-module communication (events, ports/adapters/gateways)?
    - Which module owns the resolver for a field spanning two modules?

12. **Deployment & Operations** ⚠️ (always asked)
    - Database migrations needed?
    - Data migration strategy for existing records?
    - Rollback plan?
    - Feature flags for gradual rollout of a new field/mutation?
    - Monitoring after deployment?

13. **Backward Compatibility** (triggered if spec touches an existing schema field/type)
    - Breaking changes to the schema (removed field, changed nullability, renamed type)?
    - `@deprecated(reason: "...")` period before removal?
    - Old clients need to keep working against the same schema?

## Output

- Comprehensive list of answered questions
- Identified gaps or assumptions
- Action items to clarify before coding

## Example

```
/grill-me
? Feature name: Transaction Categorization
? Success criteria: Users can assign a category to a transaction via a mutation
? Does this add a relational field? → Transaction.category, needs a DataLoader (categoryById)
? Complexity cost for Transaction.category? → default (1), it's a single-object lookup, not a list
? What about removing the old `categoryLabel` string field? → mark @deprecated first, remove next release
...
```
