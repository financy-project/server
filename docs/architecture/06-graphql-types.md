# 6. GraphQL Types

Three decorated class shapes make up the schema boundary, plus one pure mapper function per entity. This layer has no equivalent in the REST reference project — it exists entirely because TypeGraphQL builds the schema from decorated classes, and because [02. Entities](02-entities.md) mandates that the domain entity never carries those decorators itself.

## The Three Shapes

| Shape       | Decorator       | Direction               | Validated?                                                           |
| ----------- | --------------- | ----------------------- | -------------------------------------------------------------------- |
| Object Type | `@ObjectType()` | Output only             | No — never accepts user input                                        |
| Input Type  | `@InputType()`  | Input                   | Yes — via `class-validator` (see [05. Validation](05-validation.md)) |
| Args Type   | `@ArgsType()`   | Input (grouped scalars) | Yes — same as Input Type                                             |

## Object Type

```typescript
// src/modules/user/graphql/object-types/user.object-type.ts
import { Field, ID, ObjectType } from 'type-graphql'

@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string

  @Field()
  email!: string

  @Field()
  name!: string

  @Field()
  emailVerified!: boolean
}
```

- Fields expose exactly what API consumers are promised — not necessarily every entity property
- Never put `class-validator` decorators here — this class is never the target of user input
- Relational fields (e.g., `orders: OrderType[]`) are added via `@FieldResolver()` on the module's resolver, not as a plain `@Field()` here, so they can go through a `DataLoader` (see [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md))

## Input Type

Covered in depth in [05. Validation](05-validation.md) — the short version:

```typescript
@InputType()
export class RegisterUserInput {
  @Field()
  @IsEmail({}, { message: 'validations.email' })
  email!: string
}
```

## Args Type

```typescript
// src/modules/user/graphql/args/find-user.args.ts
import { ArgsType, Field, ID } from 'type-graphql'
import { IsUUID } from 'class-validator'

@ArgsType()
export class FindUserArgs {
  @Field(() => ID)
  @IsUUID()
  id!: string
}
```

Use `@ArgsType()` when a query takes several independent scalar arguments (`user(id: ID!)`); use `@InputType()` when a mutation takes one structured object (`registerUser(input: RegisterUserInput!)`).

## The Mapper

A pure function, one per entity, living in `mappers/<name>.mapper.ts`:

```typescript
// src/modules/user/mappers/user.mapper.ts
import { User } from '../entity/user.entity'
import { UserType } from '../graphql/object-types/user.object-type'

export const toUserType = (user: User): UserType => {
  const type = new UserType()
  type.id = user.id
  type.email = user.email
  type.name = user.name
  type.emailVerified = user.emailVerified
  return type
}
```

- Mappers are **pure** — no I/O, no async, no side effects
- Mappers are the **only** place an entity's shape is translated to a GraphQL type
- A resolver calls the mapper on every value it returns — it never returns an entity directly

```typescript
// ✅ Correct — resolver maps before returning
@Mutation(() => UserType)
async registerUser(@Arg('input') input: RegisterUserInput): Promise<UserType> {
  const validated = await RegisterUserValidation.validate(input)
  const user = await RegisterUserUseCase.registerUser(validated)
  return toUserType(user)
}

// ❌ Forbidden — entity returned directly, TypeGraphQL can't even do this since User has no @ObjectType()
async registerUser(@Arg('input') input: RegisterUserInput): Promise<User> {
  return RegisterUserUseCase.registerUser(input)
}
```

## Enums on the Schema

Domain enums live in `enums/` per [01. Module Structure](01-module-structure.md). Only register them with TypeGraphQL if they're actually exposed on the schema:

```typescript
// src/modules/user/enums/user-status.enum.ts
import { registerEnumType } from 'type-graphql'

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'The lifecycle status of a user account',
})
```

`registerEnumType` must run exactly once per enum, at module load time — call it in the same file the enum is defined, not in the resolver.

## Mapper Testing

```typescript
// src/modules/user/__tests__/unit/mappers/user-mapper-describe.test.ts
import { toUserType } from '../../../mappers/user.mapper'
import { UserFactory } from '../../factories/user.factory'

describe('toUserType', () => {
  it('maps every schema-exposed field from the entity', () => {
    const user = UserFactory.create({ email: 'test@example.com' })

    const type = toUserType(user)

    expect(type.id).toBe(user.id)
    expect(type.email).toBe('test@example.com')
  })
})
```

## Common Mistakes

| ❌ Mistake                                                          | ✅ Solution                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Entity decorated with `@ObjectType()`                               | Always a separate class, connected via a mapper — see [02. Entities](02-entities.md)                               |
| `class-validator` decorators on an `@ObjectType()`                  | Output types are never validated — only Input/Args types                                                           |
| Resolver returning an entity directly                               | Always map through `toXType()` first                                                                               |
| Relational field as a plain `@Field()` resolving via the repository | Use `@FieldResolver()` + `DataLoader` — see [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md) |
| `registerEnumType()` called more than once, or from the resolver    | Call it once, next to the enum's `export enum`                                                                     |
| Mapper doing async work or calling a repository                     | Mappers are pure — fetch everything before mapping                                                                 |

---

Next: [Use-Cases & Resolvers](07-use-cases-and-resolvers.md)
