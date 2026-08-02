# 3. Repository

Repository is the only layer that knows about Prisma. It abstracts data access and ensures the rest of the application never touches the database directly. This layer is identical whether the transport is REST or GraphQL — it has no idea a schema exists.

## Repository Pattern

### ✅ Correct Implementation

```typescript
// src/modules/user/repository/user.repository.ts
import { prisma } from '@/lib/prisma'
import { User } from '../entity/user.entity'
import { UserNotFoundError } from '../errors/user-errors'

const create = async (user: User): Promise<User> => {
  const created = await prisma.user.create({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      statusId: user.statusId,
      emailVerified: user.emailVerified,
    },
  })

  return User.fromRepository(created)
}

const findByEmail = async (email: string): Promise<User> => {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    throw new UserNotFoundError(email)
  }

  return User.fromRepository(user)
}

const findById = async (id: string): Promise<User> => {
  const user = await prisma.user.findUnique({ where: { id } })

  if (!user) {
    throw new UserNotFoundError(id)
  }

  return User.fromRepository(user)
}

const findManyByIds = async (ids: readonly string[]): Promise<User[]> => {
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } })

  return users.map(User.fromRepository)
}

export const UserRepository = {
  create,
  findByEmail,
  findById,
  findManyByIds,
}
```

`findManyByIds` above exists specifically to back a `DataLoader` batch function (see [12. GraphQL Operational Concerns](12-graphql-operational-concerns.md)) — GraphQL's nested-resolver shape makes batched lookups a repository method you'll need far more often than in a REST project.

## Key Rules

### 1. Prisma is ALWAYS Internal

```typescript
// ✅ Good - Prisma imported internally
import { prisma } from '@/lib/prisma'

const create = async (user: User): Promise<User> => {
  const created = await prisma.user.create({/* ... */})
  return User.fromRepository(created)
}
```

```typescript
// ❌ Bad - Prisma as parameter
const create = async (user: User, prisma: PrismaClient): Promise<User> => {
  // Don't do this - Prisma should be internal
}
```

**Why?** Repository owns the database connection. Callers shouldn't care about Prisma.

### 2. Throw Custom Domain Errors

```typescript
// ✅ Good
if (!user) {
  throw new UserNotFoundError(email)
}

// ❌ Bad - Generic or Prisma error
if (!user) {
  throw new Error('User not found')
}
```

**Why?** Custom errors are domain-aware and carry the i18n key + `DomainErrorCode` the GraphQL error formatter needs (see [04. Errors & i18n](04-errors-and-i18n.md)).

### 3. Use findUnique + Validation (Not findUniqueOrThrow)

```typescript
// ✅ Good
const user = await prisma.user.findUnique({ where: { email } })
if (!user) throw new UserNotFoundError(email)
```

```typescript
// ❌ Bad - Throws Prisma's generic error
const user = await prisma.user.findUniqueOrThrow({ where: { email } })
```

**Why?** We control error type and message. `findUniqueOrThrow` throws Prisma's generic error, which the formatter can't translate into a meaningful `extensions.code`.

### 4. Return Entity Objects

```typescript
// ✅ Good
return User.fromRepository(created)

// ❌ Bad - Returns raw Prisma data
return created
```

**Why?** Enforces type safety and entity invariants. Callers — use-cases, and eventually mappers — always get entities, never raw rows.

### 5. Exported as Object with Named Functions

```typescript
// ✅ Good
const create = async (user: User): Promise<User> => {
  /* ... */
}
const findByEmail = async (email: string): Promise<User> => {
  /* ... */
}

export const UserRepository = { create, findByEmail }
```

```typescript
// ❌ Bad - Class syntax
export class UserRepository {
  static async create(user: User): Promise<User> {
    /* ... */
  }
}
```

## Method Naming

| Method          | Purpose                       | Example                             |
| --------------- | ----------------------------- | ----------------------------------- |
| `create`        | Insert new record             | `UserRepository.create(user)`       |
| `findBy<Field>` | Find one by specific field    | `UserRepository.findByEmail(email)` |
| `findManyByIds` | Batch lookup (for DataLoader) | `UserRepository.findManyByIds(ids)` |
| `findAll`       | Get all records               | `UserRepository.findAll()`          |
| `update`        | Modify existing               | `UserRepository.update(id, data)`   |
| `remove`        | Remove record                 | `UserRepository.remove(id)`         |
| `count`         | Count records                 | `UserRepository.count()`            |

## Multi-Module Operations

When an operation spans multiple repositories, use a shared database function:

```typescript
// src/shared/database/create-user-with-auth.ts
import { prisma } from '@/lib/prisma'
import { User } from '@/modules/user'
import { Auth } from '@/modules/auth'

export const CreateUserWithAuthRepository = {
  async createUserWithAuth(input: {
    user: User
    auth: Auth
  }): Promise<{ user: User; auth: Auth }> {
    const [userRecord, authRecord] = await prisma.$transaction([
      prisma.user.create({ data: {/* ... */} }),
      prisma.auth.create({ data: {/* ... */} }),
    ])

    return {
      user: User.fromRepository(userRecord),
      auth: Auth.fromRepository(authRecord),
    }
  },
}
```

## Repository Testing

Repositories are tested via **integration tests only** (real database, via `docker-compose.integration.yml`):

```typescript
// src/modules/user/__tests__/integration/repository/user-repository-describe.test.ts
import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { UserRepository } from '../../../repository'
import { UserNotFoundError } from '../../../errors/user-errors'
import { UserFactory } from '../../factories/user.factory'

describe('UserRepository (integration)', () => {
  useDatabase()

  describe('findByEmail', () => {
    it('returns a User when found by email', async () => {
      const user = await UserFactory.createUserInDatabase(prisma, {
        email: 'test@example.com',
      })

      const result = await UserRepository.findByEmail('test@example.com')

      expect(result.email).toBe('test@example.com')
      expect(result.id).toBe(user.id)
    })

    it('throws UserNotFoundError when user does not exist', async () => {
      await expect(
        UserRepository.findByEmail('nonexistent@example.com'),
      ).rejects.toThrow(UserNotFoundError)
    })
  })
})
```

**No unit tests** for repositories. They need the real database to validate behavior — see [08. Testing](08-testing.md) for why mocking Prisma is explicitly forbidden.

## File Size

Keep repositories focused on a single entity. If exceeding 150 lines, split into multiple entities or move logic to the shared database layer.

---

Next: [Errors & i18n](04-errors-and-i18n.md)
