# 7. Use-Cases & Resolvers

Use-cases contain business logic. Resolvers bind that logic to the GraphQL schema. They work together: resolver validates input, delegates to use-case, maps the result. This replaces the REST reference project's Controller + Router pair — TypeGraphQL resolvers absorb both responsibilities.

## Use-Case Pattern

Use-cases are pure business logic with no GraphQL concerns — this layer is **identical** to a REST project, it never imports anything from `type-graphql` or a module's `graphql/` folder.

```typescript
// src/modules/auth/use-cases/register-user.use-case.ts
import {
  User,
  UserRepository,
  UserStatus,
  UserAlreadyExistsError,
} from '@/modules/user'
import { Auth, AuthRepository } from '@/modules/auth'
import { HashService } from '@/services/hash.service'
import { EventEmitter } from '@/lib/event-emitter'
import { CreateUserWithAuthRepository } from '@/shared/database/create-user-with-auth'

import type { RegisterUserInput } from '../types'

const registerUser = async (input: RegisterUserInput): Promise<User> => {
  // Check if user already exists
  const existing = await UserRepository.findByEmailOrNull(input.email)
  if (existing) {
    throw new UserAlreadyExistsError(input.email)
  }

  // Create domain entities
  const user = User.create({
    email: input.email,
    name: input.name,
    statusId: UserStatus.ACTIVE,
  })
  const hashedPassword = await HashService.hash(input.password)
  const auth = Auth.create({ userId: user.id, password: hashedPassword })

  // Persist both together (atomic operation)
  await CreateUserWithAuthRepository.createUserWithAuth({ user, auth })

  // Emit event (fire and forget - no await needed)
  EventEmitter.emit('user.created', {
    userId: user.id,
    email: user.email,
    name: user.name,
  })

  return user
}

export const RegisterUserUseCase = {
  registerUser,
}
```

## Use-Case Key Rules

### 1. Pure Business Logic, No GraphQL Types

```typescript
// ✅ Good - returns the domain entity
const registerUser = async (input: RegisterUserInput): Promise<User> => {
  /* ... */
}

// ❌ Bad - returns a GraphQL type; mapping is the resolver's job
const registerUser = async (input: RegisterUserInput): Promise<UserType> => {
  /* ... */
}
```

### 2. No Unnecessary Async

```typescript
// ✅ Good
EventEmitter.emit('user.created', data) // Fire-and-forget

// ❌ Bad
await EventEmitter.emit('user.created', data) // Unnecessary
```

### 3. Orchestrate Domain Objects

```typescript
// ✅ Good - coordinates user and auth creation
const user = User.create(/* ... */)
const auth = Auth.create(/* ... */)
await CreateUserWithAuthRepository.createUserWithAuth({ user, auth })
```

### 4. Exported as Object with Named Functions

```typescript
const registerUser = async (input: RegisterUserInput): Promise<User> => {
  /* ... */
}
export const RegisterUserUseCase = { registerUser }
```

### 5. Input Type Doubles as Use-Case Input

Because the `@InputType()` class already carries the validated shape (see [05. Validation](05-validation.md)), the use-case can accept it directly instead of a separate plain type — but the use-case must still only depend on the **fields**, never on anything GraphQL-specific about the class.

## Use-Case Testing

```typescript
// src/modules/auth/__tests__/unit/use-cases/register-user-describe.test.ts
import { RegisterUserUseCase } from '../../../use-cases/register-user.use-case'
import { UserRepository } from '@/modules/user'
import { UserAlreadyExistsError } from '@/modules/user/errors/user-errors'
import { UserFactory } from '../../factories/user.factory'

jest.mock('@/modules/user')

describe('RegisterUserUseCase.registerUser', () => {
  it('creates user when email does not exist', async () => {
    const input = {
      email: 'new@example.com',
      name: 'New User',
      password: 'ValidPassword123',
    }
    jest.mocked(UserRepository.findByEmailOrNull).mockResolvedValueOnce(null)

    const result = await RegisterUserUseCase.registerUser(input)

    expect(result.email).toBe(input.email)
  })

  it('throws UserAlreadyExistsError when email exists', async () => {
    const input = {
      email: 'existing@example.com',
      name: 'User',
      password: 'ValidPassword123',
    }
    jest
      .mocked(UserRepository.findByEmailOrNull)
      .mockResolvedValueOnce(UserFactory.create({ email: input.email }))

    await expect(RegisterUserUseCase.registerUser(input)).rejects.toThrow(
      UserAlreadyExistsError,
    )
  })
})
```

---

## Resolver Pattern

Resolvers bind a `@Query`/`@Mutation`/`@FieldResolver` to the schema, validate input, delegate to the use-case, and map the result. They are the one place per module allowed to be a class (alongside entities, errors, and the GraphQL types themselves — see [constitution.md](../../constitution.md)).

```typescript
// src/modules/auth/resolvers/auth.resolver.ts
import { Arg, Mutation, Resolver } from 'type-graphql'
import { UserType } from '@/modules/user'
import { toUserType } from '@/modules/user/mappers/user.mapper'
import { RegisterUserInput } from '../graphql/input-types/register-user.input'
import { RegisterUserValidation } from '../validation/register-user.validation'
import { RegisterUserUseCase } from '../use-cases/register-user.use-case'

@Resolver()
export class AuthResolver {
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

## Resolver Key Rules

### 1. Validate Input First

```typescript
const validated = await RegisterUserValidation.validate(input)
```

### 2. Delegate to Use-Case — No Business Logic in the Resolver

```typescript
const user = await RegisterUserUseCase.registerUser(validated)
```

### 3. Always Map Before Returning

```typescript
return toUserType(user)
```

### 4. Let Domain Errors Bubble Unmodified

```typescript
// ✅ Good — no try/catch, formatError handles translation (see 04-errors-and-i18n.md)
@Mutation(() => UserType)
async registerUser(@Arg('input') input: RegisterUserInput): Promise<UserType> {
  const validated = await RegisterUserValidation.validate(input)
  return toUserType(await RegisterUserUseCase.registerUser(validated))
}

// ❌ Bad — resolver reformatting errors itself
async registerUser(@Arg('input') input: RegisterUserInput): Promise<UserType> {
  try {
    /* ... */
  } catch (error) {
    return { error: error.message } as any // never do this
  }
}
```

### 5. FieldResolver for Relations — Always Through a Loader

```typescript
@Resolver(() => UserType)
export class UserResolver {
  @FieldResolver(() => [OrderType])
  async orders(
    @Root() user: UserType,
    @Ctx() ctx: GraphQLContext,
  ): Promise<OrderType[]> {
    const orders = await ctx.loaders.ordersByUserId.load(user.id)
    return orders.map(toOrderType)
  }
}
```

**Never** call the repository directly inside a `@FieldResolver` — see [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md) for why this is an N+1 query trap.

## Schema Registration

Resolvers are registered once, in the schema builder — there is no per-module routes file or route registrator:

```typescript
// src/schema/build-schema.ts
import { buildSchema } from 'type-graphql'
import { AuthResolver } from '@/modules/auth'
import { UserResolver } from '@/modules/user'

export const buildAppSchema = () =>
  buildSchema({
    resolvers: [AuthResolver, UserResolver],
    validate: false,
  })
```

## Error Flow

```
GraphQL Operation
   ↓
Resolver validates input
   ↓ (invalid)
ValidationError thrown → formatError → GraphQLError { extensions.code: 'BAD_USER_INPUT' }
   ↓ (valid)
Use-case executes
   ↓ (business error)
DomainError thrown → formatError → GraphQLError { extensions.code: ... }
   ↓ (success)
Resolver maps entity → GraphQL type → returned in `data`
```

## Common Mistakes

| ❌ Mistake                                       | ✅ Solution                                   |
| ------------------------------------------------ | --------------------------------------------- |
| Business logic in the resolver                   | Move to use-case                              |
| Use-case returning a GraphQL type                | Use-case returns entities only; resolver maps |
| Hardcoded messages anywhere in this layer        | Use i18n service                              |
| Not validating input before calling the use-case | Validate in the resolver                      |
| Passing Prisma to the use-case                   | Use the repository internally                 |
| Class syntax for use-cases                       | Use the const-object-of-functions pattern     |
| `@FieldResolver` calling the repository directly | Batch through a `DataLoader` from context     |
| Resolver catching and reshaping errors           | Let `formatError` be the only translator      |

---

Next: [Testing](08-testing.md)
