# 8. Testing

Tests are organized by layer: unit, integration, and e2e. Each layer has specific rules — identical philosophy to a REST project, with e2e tests exercising real GraphQL documents instead of HTTP routes.

## Test Structure

**One describe per file** — each test file has a single describe block.

```
src/modules/<module>/__tests__/
├── factories/
│   └── <name>.factory.ts
├── unit/
│   ├── entity/
│   │   └── <name>-create-describe.test.ts
│   ├── validation/
│   │   └── <action>-validation-describe.test.ts
│   ├── use-cases/
│   │   └── <action>-describe.test.ts
│   └── mappers/
│       └── <name>-mapper-describe.test.ts
└── integration/
    ├── repository/
    │   └── <name>-repository-describe.test.ts
    └── e2e/
        └── <action>-describe.test.ts
```

## Unit Tests

Test isolated functions with mocked dependencies.

### Entity Unit Tests

See [02. Entities](02-entities.md#entity-testing) — unchanged from a REST project.

### Validation Unit Tests

See [05. Validation](05-validation.md#validation-testing).

### Mapper Unit Tests

```typescript
// src/modules/user/__tests__/unit/mappers/user-mapper-describe.test.ts
import { toUserType } from '../../../mappers/user.mapper'
import { UserFactory } from '../../factories/user.factory'

describe('toUserType', () => {
  it('maps entity fields onto the GraphQL type', () => {
    const user = UserFactory.create({ email: 'test@example.com' })

    const type = toUserType(user)

    expect(type.email).toBe('test@example.com')
  })
})
```

### Use-Case Unit Tests

Mock repositories to test business logic — see [07. Use-Cases & Resolvers](07-use-cases-and-resolvers.md#use-case-testing).

### Repository Unit Tests — DO NOT WRITE

**Repositories MUST NOT have unit tests.** Test repositories only via integration tests with a real database.

```typescript
// ❌ WRONG — Do not write unit tests for repositories
describe('UserRepository.create', () => {
  it('calls prisma.user.create', () => {
    jest.mock('@/lib/prisma')
    // This test can pass even if production fails — mocks diverge from reality
  })
})

// ✅ CORRECT — Test repositories with real database in integration suite
describe('UserRepository.create (integration)', () => {
  useDatabase()
  it('persists user to database', async () => {
    // Real database call — catches actual schema mismatches, constraint violations, etc.
  })
})
```

**Why:** Mocking Prisma makes tests pass while production breaks. Only integration tests with a real database ensure correctness.

**Rule:** If a test mocks Prisma or a database, it belongs in `__tests__/unit/`. If it touches the database, it belongs in `__tests__/integration/`.

## Integration Tests

Test against real dependencies — database, SMTP, or any other external service provisioned via docker-compose (see `docker-compose.dev/integration/e2e.yml`).

**Rule: no mocking in `__tests__/integration/`.** If a test file under `integration/` contains `jest.mock(...)` or a faked `jest.spyOn(...).mockImplementation/.mockResolvedValue/.mockRejectedValue(...)`, it doesn't belong there. The most common reason to reach for a mock in an integration test is forcing an error path — that case belongs in a **separate unit test** with full `jest.mock` isolation, not mixed into the integration file.

### Repository Integration Tests

```typescript
// src/modules/user/__tests__/integration/repository/user-repository-describe.test.ts
import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { UserRepository } from '../../../repository'
import { UserFactory } from '../../factories/user.factory'

describe('UserRepository (integration)', () => {
  useDatabase()

  it('persists user to database', async () => {
    const user = UserFactory.create()

    const created = await UserRepository.create(user)

    const found = await prisma.user.findUnique({ where: { id: created.id } })
    expect(found?.email).toBe(user.email)
  })
})
```

## E2E Tests

Test the full GraphQL request-response cycle by executing **real operations** (query/mutation documents as strings) against the built schema — no mocks, no calling resolver methods directly, and no asserting against internal types. This is the one layer that differs meaningfully from the REST reference project.

```typescript
// src/modules/auth/__tests__/integration/e2e/register-user-describe.test.ts
import { ApolloServer } from '@apollo/server'
import { buildAppSchema } from '@/schema/build-schema'
import { useDatabase } from '@/test/helpers/db'

describe('registerUser mutation (e2e)', () => {
  useDatabase()
  let server: ApolloServer

  beforeAll(async () => {
    server = new ApolloServer({ schema: await buildAppSchema() })
  })

  afterAll(async () => {
    await server.stop()
  })

  it('registers a new user successfully', async () => {
    const response = await server.executeOperation({
      query: `
        mutation RegisterUser($input: RegisterUserInput!) {
          registerUser(input: $input) { id email name }
        }
      `,
      variables: {
        input: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'ValidPassword123',
        },
      },
    })

    expect(response.body.kind).toBe('single')
    expect(response.body.singleResult.errors).toBeUndefined()
    expect(response.body.singleResult.data?.['registerUser']).toMatchObject({
      email: 'test@example.com',
    })
  })

  it('returns a CONFLICT error when email already exists', async () => {
    const variables = {
      input: {
        email: 'existing@example.com',
        name: 'User',
        password: 'ValidPassword123',
      },
    }
    const mutation = `
      mutation RegisterUser($input: RegisterUserInput!) {
        registerUser(input: $input) { id }
      }
    `

    await server.executeOperation({ query: mutation, variables })
    const response = await server.executeOperation({
      query: mutation,
      variables,
    })

    expect(response.body.kind).toBe('single')
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'CONFLICT',
    )
  })

  it('returns a BAD_USER_INPUT error on invalid email', async () => {
    const response = await server.executeOperation({
      query: `
        mutation RegisterUser($input: RegisterUserInput!) {
          registerUser(input: $input) { id }
        }
      `,
      variables: {
        input: {
          email: 'invalid-email',
          name: 'Test User',
          password: 'ValidPassword123',
        },
      },
    })

    expect(response.body.kind).toBe('single')
    expect(response.body.singleResult.errors?.[0]?.extensions?.['code']).toBe(
      'BAD_USER_INPUT',
    )
  })
})
```

**Key points:**

- Build the schema once per test file (`beforeAll`) and reuse it — building it per-test is unnecessarily slow
- Assert on the actual wire shape: `data`, `errors[].extensions.code` — never on an internal entity or use-case return value
- Runs against `docker-compose.e2e.yml` (isolated, volatile database)

## Factories

Generate consistent test data — unchanged in shape from a REST project:

```typescript
// src/modules/user/__tests__/factories/user.factory.ts
import { v4 as uuid } from 'uuid'
import type { PrismaClient } from '@/generated/prisma/client'
import { User } from '../../entity/user.entity'

export const UserFactory = {
  create(overrides?: Partial<Parameters<typeof User.create>[0]>): User {
    return User.create({
      email: overrides?.email || `user-${uuid()}@example.com`,
      name: overrides?.name || 'Test User',
      statusId: overrides?.statusId || 'ACTIVE',
      ...overrides,
    })
  },

  async createUserInDatabase(
    prisma: PrismaClient,
    overrides?: Partial<Parameters<typeof User.create>[0]>,
  ): Promise<User> {
    const user = this.create(overrides)
    await prisma.user.create({ data: { ...user } })
    return user
  },
}
```

## Test Pattern Rules

### Don't Use Try/Catch for Async Tests

```typescript
// ✅ Good
it('throws UserNotFoundError when user not found', async () => {
  await expect(repository.findByEmail('nonexistent')).rejects.toThrow(
    UserNotFoundError,
  )
})
```

### Test as Documentation

```typescript
// ✅ Good - documents which error is thrown
it('throws UserNotFoundError when user does not exist', async () => {
  await expect(repository.findByEmail('nonexistent')).rejects.toThrow(
    UserNotFoundError,
  )
})
```

## Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Single file
pnpm test --testPathPatterns=user.create

# Integration tests only
pnpm test --testPathPatterns=integration

# E2E tests only
pnpm test --testPathPatterns=e2e
```

---

Next: [Configuration](09-configuration.md)
