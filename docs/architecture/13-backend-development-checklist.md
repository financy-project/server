# 13. Backend Development Checklist (Implementer Guide)

This checklist is for whoever implements a feature — human or agent — **during implementation**. Verify each step as you create files, not after. Follow layer-by-layer; each layer should satisfy its checklist before moving to the next.

---

## Pre-Implementation: Module Setup

- [ ] **Module structure created** matching [01. Module Structure](01-module-structure.md)
- [ ] **Spec and plan reviewed**, DoR blueprints present (`docs/features/PM-NNN/plan.md`, see [11. DoR](11-dor.md))
- [ ] **TDD: Write failing tests first** before any implementation

---

## Layer 1: Types & Enums (Foundational)

```typescript
// src/modules/<name>/types/index.ts
export type <Name>Props = { id: string /* ...all fields */ }
export type Create<Name>Props = Omit<<Name>Props, 'id'>
```

```typescript
// src/modules/<name>/enums/<name>.enum.ts
import { registerEnumType } from 'type-graphql'

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

registerEnumType(UserStatus, { name: 'UserStatus' }) // only if exposed on the schema
```

**Checklist:**

- [ ] Types are in `types/index.ts` only (not mixed with enums or entities)
- [ ] Enums live in `enums/`, not `types/`, keys `SCREAMING_SNAKE_CASE`
- [ ] `registerEnumType()` called exactly once, next to the enum definition — only if the enum is schema-exposed

---

## Layer 2: Entity (Business Logic)

See [02. Entities](02-entities.md) for the full pattern.

**Checklist:**

- [ ] Constructor is `private`
- [ ] All properties are `readonly`
- [ ] Static `create()` and `fromRepository()` methods
- [ ] No side effects, **no `type-graphql` or `class-validator` decorators**
- [ ] Entity file ≤ 100 lines
- [ ] **Test FIRST:** Entity unit tests in `__tests__/unit/entity/`

---

## Layer 3: Errors (Domain)

See [04. Errors & i18n](04-errors-and-i18n.md) for the full pattern.

**Checklist:**

- [ ] Each error extends `DomainError`
- [ ] Error receives an i18n key (or uses default)
- [ ] `code: DomainErrorCode` set (not an HTTP status — GraphQL has none per-error)
- [ ] `Object.setPrototypeOf()` set for instanceof checks
- [ ] Error name matches class name

---

## Layer 4: GraphQL Input/Args Types & Validation

See [05. Validation](05-validation.md) and [06. GraphQL Types](06-graphql-types.md) for the full pattern.

**Checklist:**

- [ ] `@InputType()`/`@ArgsType()` class carries both `@Field()` and `class-validator` decorators — one class, one source of truth
- [ ] Every decorator's `message` is an i18n key, not English text
- [ ] Validation wrapper (`<action>.validation.ts`) calls `validateInput()`
- [ ] **Test FIRST:** Validation unit tests in `__tests__/unit/validation/`

---

## Layer 5: Repository (Data Access)

See [03. Repository](03-repository.md) for the full pattern.

**Checklist:**

- [ ] Prisma imported internally (never as parameter)
- [ ] Uses `findUnique + validation` (not `findUniqueOrThrow`)
- [ ] Returns entities via `.fromRepository()`
- [ ] `findManyByIds` (or similar batch method) added if a DataLoader will need it
- [ ] **NO unit tests** — integration tests only
- [ ] **Test FIRST:** Integration tests in `__tests__/integration/repository/`

---

## Layer 6: Use-Case (Business Orchestration)

See [07. Use-Cases & Resolvers](07-use-cases-and-resolvers.md) for the full pattern.

**Checklist:**

- [ ] Pure business logic only (no GraphQL concerns)
- [ ] Returns entities/domain types only — **never** a GraphQL type
- [ ] Throws custom domain errors
- [ ] Events emitted without await (fire-and-forget)
- [ ] Use-case file ≤ 200 lines
- [ ] **Test FIRST:** Unit tests in `__tests__/unit/use-cases/` with mocked repos

---

## Layer 7: GraphQL Object Type & Mapper

See [06. GraphQL Types](06-graphql-types.md) for the full pattern.

```typescript
// src/modules/user/graphql/object-types/user.object-type.ts
@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string

  @Field()
  email!: string
}
```

```typescript
// src/modules/user/mappers/user.mapper.ts
export const toUserType = (user: User): UserType => {
  const type = new UserType()
  type.id = user.id
  type.email = user.email
  return type
}
```

**Checklist:**

- [ ] `@ObjectType()` carries no validation decorators
- [ ] Mapper is a pure function, one per entity
- [ ] Every field returned by a resolver has passed through the mapper
- [ ] **Test FIRST:** Mapper unit tests in `__tests__/unit/mappers/`

---

## Layer 8: Resolver

See [07. Use-Cases & Resolvers](07-use-cases-and-resolvers.md) for the full pattern.

```typescript
// src/modules/user/resolvers/user.resolver.ts
@Resolver(() => UserType)
export class UserResolver {
  @Mutation(() => UserType)
  async registerUser(
    @Arg('input') input: RegisterUserInput,
  ): Promise<UserType> {
    const validated = await RegisterUserValidation.validate(input)
    const user = await RegisterUserUseCase.registerUser(validated)
    return toUserType(user)
  }
}
```

**Checklist:**

- [ ] Validates input, delegates to use-case, maps output — no business logic
- [ ] Errors bubble up unmodified (no try/catch reformatting)
- [ ] Registered in `src/schema/build-schema.ts`
- [ ] Resolver file ≤ 100 lines

---

## Layer 9: Loaders (If the Module Exposes Relations)

See [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md) for the full pattern.

**Checklist:**

- [ ] `DataLoader` factory function, not an instance — built fresh per request
- [ ] Wired into `createContext`, exposed as `ctx.loaders.<name>`
- [ ] Batch function preserves key order (`keys.map(...)`, never `Promise.all` per key)
- [ ] Every relational `@FieldResolver` uses the loader — no direct repository calls

---

## Layer 10: Barrel Exports (Public API)

```typescript
// src/modules/user/index.ts
export { User } from './entity/user.entity'
export type { UserProps } from './entity/user.entity'
export { UserStatus } from './enums/user-status.enum'
export { UserRepository } from './repository/user.repository'
export { UserNotFoundError, UserAlreadyExistsError } from './errors/user-errors'
export { UserResolver } from './resolvers/user.resolver'
```

**Checklist:**

- [ ] Entities, types, enums, errors, repository, resolver exported
- [ ] **NOT exported:** use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders
- [ ] Consumers import from `@/modules/<name>` only

---

## Layer 11: i18n

Add every user-facing key to both locales.

**Checklist:**

- [ ] All error messages in i18n
- [ ] All validation messages in i18n
- [ ] Both locales (`en`, `pt-br`) included
- [ ] Keys organized by domain (`errors.*`, `validations.*`)

---

## Testing: Complete Coverage

See [08. Testing](08-testing.md) for the full pattern per layer. Summary:

- **Unit** (mocked): entity, validation, use-case, mapper — one `describe` per file
- **Integration** (real DB, no mocks): repository
- **E2E** (real schema, `server.executeOperation()`): success case, `BAD_USER_INPUT`, and every domain error the operation can throw

---

## Pre-PR Validation

- [ ] **All tests passing:** `pnpm test`
- [ ] **No TypeScript errors:** `pnpm build`
- [ ] **Code formatted:** `pnpm format`
- [ ] **No console.log** except in scripts
- [ ] **No hardcoded messages** — use i18n
- [ ] **Barrel files clean** — no mixed concerns
- [ ] **Resolver registered** in `src/schema/build-schema.ts`
- [ ] **`schema.graphql` regenerated and committed** if this feature changed the schema
- [ ] **Event listeners/receivers wired** — every new `.subscribe()` receiver is called from `src/utils/listenersRegistrator.ts`
- [ ] **Checklist items complete** (see [checklist.md](checklist.md))

---

## Critical Security Patterns

### Timing-Safe Authentication

```typescript
// ❌ WRONG — short-circuits on user-not-found
const login = async (email: string, password: string) => {
  const user = await UserRepository.findByEmail(email)
  const isValid = await HashService.compare(password, user.passwordHash)
  if (!isValid) throw new InvalidCredentialsError()
}

// ✅ CORRECT — timing-safe
const login = async (email: string, password: string): Promise<User> => {
  const user = await UserRepository.findByEmailOrNull(email)
  const passwordHash = user?.passwordHash ?? 'dummy-hash-for-constant-time'
  const isValid = await HashService.compare(password, passwordHash)

  if (!user || !isValid) throw new InvalidCredentialsError()
  return user
}
```

**Checklist:**

- [ ] Login never short-circuits on user-not-found
- [ ] Password hashing always runs
- [ ] Same error for "user not found" and "wrong password"

---

## Common Mistakes to Avoid

| ❌ Mistake                                           | ✅ Solution                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Entity with public constructor                       | Use `private` + static `create()`                                    |
| Repository with Prisma parameter                     | Import Prisma internally                                             |
| Entity decorated with `@ObjectType()`                | Always a separate class + mapper                                     |
| `@FieldResolver` calling the repository directly     | Batch through a `DataLoader`                                         |
| DataLoader as a module-level singleton               | Build it fresh in `createContext` per request                        |
| Resolver catching/reformatting errors                | Let `formatError` be the only translator                             |
| Unit tests for repositories                          | Integration tests only, with real DB                                 |
| Receiver/listener defined but never subscribed       | Call `.subscribe()` from `listenersRegistrator.ts`                   |
| Mocking a dependency inside `__tests__/integration/` | Real dependency only; split the forced-failure case into a unit test |
| Hardcoded error messages                             | Always use i18n service                                              |
| Enums in `types/`                                    | Place in `enums/` with SCREAMING_SNAKE_CASE                          |

---

## Reference Links

- [Constitution](../../constitution.md) — Principles and philosophy
- [01. Module Structure](01-module-structure.md)
- [02. Entities](02-entities.md)
- [03. Repository](03-repository.md)
- [04. Errors & i18n](04-errors-and-i18n.md)
- [05. Validation](05-validation.md)
- [06. GraphQL Types](06-graphql-types.md)
- [07. Use-Cases & Resolvers](07-use-cases-and-resolvers.md)
- [08. Testing](08-testing.md)
- [09. Configuration](09-configuration.md)
- [10. Cross-Module Communication](10-cross-module-communication.md)
- [11. Definition of Ready (DoR)](11-dor.md)
- [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md)
- [Checklist](checklist.md) — Pre-PR validation

---

**Remember:** Follow layer-by-layer, write tests first, and validate each step before moving to the next. If you skip a checklist item, you're creating future PR review work.
