# 2. Entities

Entities are immutable value objects representing core domain concepts. They contain business rules and are never aware of persistence **or of GraphQL** — no `type-graphql` decorators, no `class-validator` decorators, ever end up on an entity class. See [06. GraphQL Types](06-graphql-types.md) for how an entity gets translated into something the schema can expose.

## Entity Pattern

### ✅ Correct Implementation

```typescript
// src/modules/user/entity/user.entity.ts
import { generateUUID } from '@/shared/utils/uuid'

export type UserProps = {
  id: string
  email: string
  name: string
  statusId: string
  emailVerified: boolean
}

export type CreateUserProps = Omit<UserProps, 'id' | 'emailVerified'> & {
  emailVerified?: boolean
}

export class User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly statusId: string
  readonly emailVerified: boolean

  // Constructor is PRIVATE
  private constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.name = props.name
    this.statusId = props.statusId
    this.emailVerified = props.emailVerified
  }

  // Factory for creating new entities
  static create(props: CreateUserProps): User {
    return new User({
      id: generateUUID(),
      emailVerified: props.emailVerified ?? false,
      ...props,
    })
  }

  // Factory for reconstructing from database
  static fromRepository(props: UserProps): User {
    return new User(props)
  }
}
```

## Pattern Explanation

### Private Constructor

```typescript
private constructor(props: UserProps) {
  // Can only be called via static methods
}
```

**Why?** Forces all entity creation through controlled factories (`.create()` or `.fromRepository()`), ensuring consistency.

### Static `.create()` — For New Entities

```typescript
const user = User.create({
  email: 'test@example.com',
  name: 'Test User',
  statusId: 'ACTIVE',
})
// Auto-generates: id (UUID), emailVerified (false)
```

**When?** When creating a new entity that doesn't exist in the database — typically from an already-validated `@InputType()` (see [05. Validation](05-validation.md)).

### Static `.fromRepository()` — For Existing Entities

```typescript
const user = User.fromRepository({
  id: 'existing-id',
  email: 'test@example.com',
  name: 'Test User',
  statusId: 'ACTIVE',
  emailVerified: true,
})
```

**When?** When reconstructing an entity loaded from the database.

## Readonly Properties

All entity properties must be `readonly`:

```typescript
export class User {
  readonly id: string // ✅ Good
  readonly email: string // ✅ Good
  name: string // ❌ Bad - mutable
}
```

**Why?** Entities are immutable. If you need to change state, create a new entity.

## Business Rules in Entities

Entities can contain business logic (value transformations), but NOT side effects:

```typescript
export class User {
  // ✅ Pure function - no side effects
  getDisplayName(): string {
    return this.name.toUpperCase()
  }

  // ✅ Pure validation
  isEmailVerified(): boolean {
    return this.emailVerified
  }

  // ❌ Side effects - belongs in use-case
  async sendWelcomeEmail(): Promise<void> {
    // Don't do this
  }
}
```

## No Framework Awareness — Ever

```typescript
// ❌ FORBIDDEN — entity decorated for GraphQL
@ObjectType()
export class User {
  @Field()
  readonly email: string
  // ...
}

// ❌ FORBIDDEN — entity decorated for validation
export class User {
  @IsEmail()
  readonly email: string
  // ...
}
```

**Why?** If the entity carries `@ObjectType()`/`@Field()` decorators, every domain refactor (renaming a field, splitting a value object) silently changes the public GraphQL schema — a breaking API change with no compiler signal, and no way to shape the entity differently from what the schema promises. The mapper in `mappers/<name>.mapper.ts` is the only bridge (see [06. GraphQL Types](06-graphql-types.md)).

## Entity Testing

Test entity creation and transformations — no GraphQL, no database, no mocks:

```typescript
// src/modules/user/__tests__/unit/entity/user-create-describe.test.ts
import { User } from '../../entity/user.entity'

describe('User.create', () => {
  it('creates a user with provided data', () => {
    const user = User.create({
      email: 'test@example.com',
      name: 'Test User',
      statusId: 'ACTIVE',
    })

    expect(user.email).toBe('test@example.com')
    expect(user.name).toBe('Test User')
    expect(user.statusId).toBe('ACTIVE')
    expect(user.id).toBeDefined()
    expect(user.emailVerified).toBe(false)
  })

  it('generates unique id for each user', () => {
    const user1 = User.create({
      email: 'user1@example.com',
      name: 'User 1',
      statusId: 'ACTIVE',
    })
    const user2 = User.create({
      email: 'user2@example.com',
      name: 'User 2',
      statusId: 'ACTIVE',
    })

    expect(user1.id).not.toBe(user2.id)
  })

  it('allows setting emailVerified on creation', () => {
    const user = User.create({
      email: 'test@example.com',
      name: 'Test User',
      statusId: 'ACTIVE',
      emailVerified: true,
    })

    expect(user.emailVerified).toBe(true)
  })
})
```

## Common Mistakes

| ❌ Mistake                                        | ✅ Solution                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Public constructor                                | Make it private, use static factories                                |
| Mutable properties                                | Mark all as `readonly`                                               |
| `@ObjectType()`/`@Field()` on the entity          | Keep the entity plain; add a separate `@ObjectType()` class + mapper |
| `class-validator` decorators on the entity        | Validate the `@InputType()`, not the entity                          |
| Business logic with side effects                  | Keep entities pure, move to use-cases                                |
| Accepting Prisma models directly                  | Transform to entity via `.fromRepository()`                          |
| Entities knowing about the database or the schema | Entities are pure domain logic only                                  |

---

Next: [Repository](03-repository.md)
