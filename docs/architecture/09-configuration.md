# 9. Configuration & Shared Utilities

Configuration is centralized with type-safe validation. Shared utilities are reusable functions across modules. This layer is transport-agnostic — identical in shape to a REST project, since environment variables have nothing to do with GraphQL.

## Environment Configuration

All environment variables go in `config/environments.ts`, validated with Zod (Zod is used here for env parsing specifically — not for GraphQL input validation, which is `class-validator`'s job, see [05. Validation](05-validation.md)).

```typescript
// src/config/environments.ts
import { z } from 'zod'

const environmentSchema = z.object({
  // App
  NODE_ENV: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(['DEVELOPMENT', 'TEST', 'PRODUCTION']))
    .default('DEVELOPMENT'),
  PORT: z.coerce.number().default(4000),

  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('7d'),

  // GraphQL
  GRAPHQL_COMPLEXITY_LIMIT: z.coerce.number().default(1000),
  GRAPHQL_DEPTH_LIMIT: z.coerce.number().default(10),

  // Localization
  LOCALE: z.enum(['en', 'pt-br']).default('pt-br'),
})

type Environment = z.infer<typeof environmentSchema>

const env: Environment = environmentSchema.parse({
  NODE_ENV: process.env['NODE_ENV'],
  PORT: process.env['PORT'],
  DATABASE_URL: process.env['DATABASE_URL'],
  JWT_SECRET: process.env['JWT_SECRET'],
  JWT_EXPIRY: process.env['JWT_EXPIRY'],
  GRAPHQL_COMPLEXITY_LIMIT: process.env['GRAPHQL_COMPLEXITY_LIMIT'],
  GRAPHQL_DEPTH_LIMIT: process.env['GRAPHQL_DEPTH_LIMIT'],
  LOCALE: process.env['LOCALE'],
})

export const Environments = {
  get isDevelopment(): boolean {
    return env.NODE_ENV === 'DEVELOPMENT'
  },
  get isProduction(): boolean {
    return env.NODE_ENV === 'PRODUCTION'
  },
  get isTest(): boolean {
    return env.NODE_ENV === 'TEST'
  },
  get port(): number {
    return env.PORT
  },
  get databaseUrl(): string {
    return env.DATABASE_URL
  },
  get jwtSecret(): string {
    return env.JWT_SECRET
  },
  get jwtExpiry(): string {
    return env.JWT_EXPIRY
  },
  get graphqlComplexityLimit(): number {
    return env.GRAPHQL_COMPLEXITY_LIMIT
  },
  get graphqlDepthLimit(): number {
    return env.GRAPHQL_DEPTH_LIMIT
  },
  get locale(): string {
    return env.LOCALE
  },
}
```

## Configuration Key Rules

### 1. Use Bracket Notation for process.env

```typescript
// ✅ Good
const url = process.env['DATABASE_URL']

// ❌ Bad
const url = process.env.DATABASE_URL
```

**Why?** TypeScript's `noUncheckedIndexedAccess` requires bracket notation.

### 2. Validate with Zod

```typescript
// ✅ Good
PORT: z.coerce.number().default(4000)

// ❌ Bad
const port = parseInt(process.env.PORT || '4000')
```

### 3. Export via Getter Methods

```typescript
// ✅ Good
get port(): number {
  return env.PORT
}

// ❌ Bad
export const PORT = process.env.PORT
```

**Why?** Allows lazy loading, better for testing (each environment's `.env.*` file is read at process start, not import time).

## Using Configuration

```typescript
import { Environments } from '@/config/environments'

if (Environments.isProduction) {
  // Production-only logic
}
```

## Shared Utilities

Common functions live in `src/shared/utils/`.

```typescript
// src/shared/utils/uuid.ts
import { uuidv7 } from 'uuidv7'

export function generateUUID(): string {
  return uuidv7()
}
```

```typescript
// src/shared/utils/validate-input.ts
// See 05-validation.md for the full implementation
export async function validateInput<T extends object>(
  InputClass: new () => T,
  data: unknown,
): Promise<T> {
  /* ... */
}
```

```typescript
// src/shared/utils/index.ts
export { generateUUID } from './uuid'
export { validateInput } from './validate-input'
```

## Services

Reusable services for cross-cutting concerns — unchanged from a REST project.

```typescript
// src/services/hash.service.ts
import * as bcrypt from 'bcrypt'

const hash = async (password: string): Promise<string> =>
  bcrypt.hash(password, 10)
const compare = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => bcrypt.compare(password, hashedPassword)

export const HashService = { hash, compare }
```

```typescript
// src/services/i18n.service.ts
// See 04-errors-and-i18n.md for the full implementation
```

## Library Imports

Core libraries are centralized:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

```typescript
// src/lib/event-emitter.ts
import { EventEmitter as NodeEventEmitter } from 'events'

const emitter = new NodeEventEmitter()

export const EventEmitter = {
  emit(event: string, data: unknown): void {
    emitter.emit(event, data)
  },
  on(event: string, callback: (data: unknown) => void): void {
    emitter.on(event, callback)
  },
}
```

## File Organization

```
src/
├── config/
│   └── environments.ts          # All env vars, Zod validated
├── schema/
│   └── build-schema.ts          # TypeGraphQL buildSchema(), lists every resolver
├── lib/
│   ├── prisma.ts                # Prisma client
│   └── event-emitter.ts         # Event handling
├── services/
│   ├── hash.service.ts
│   ├── i18n.service.ts
│   └── index.ts                 # Barrel (optional)
├── shared/
│   ├── database/
│   │   └── create-user-with-auth.ts
│   ├── utils/
│   │   ├── uuid.ts
│   │   ├── validate-input.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── domain-error.ts
│   │   ├── validation-error.ts
│   │   └── index.ts
│   └── index.ts
├── plugins/
│   └── format-error.ts          # Apollo formatError — see 04-errors-and-i18n.md
└── modules/
    ├── user/
    ├── auth/
    └── ...
```

---

Next: [Cross-Module Communication](10-cross-module-communication.md)
