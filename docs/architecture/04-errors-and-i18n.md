# 4. Errors & i18n

All user-facing messages come from the i18n service. Custom domain errors extend `DomainError` and are translated into `GraphQLError` at exactly one place: the Apollo `formatError` function. Resolvers and use-cases never touch HTTP status codes or GraphQL error shaping directly.

## Error Hierarchy

```
Error (Built-in)
└── DomainError (src/shared/errors/domain-error.ts)
    ├── ValidationError (src/shared/errors/validation-error.ts)
    ├── UserNotFoundError (src/modules/user/errors/user-errors.ts)
    ├── UserAlreadyExistsError (src/modules/user/errors/user-errors.ts)
    ├── InvalidCredentialsError (src/modules/auth/errors/auth-errors.ts)
    └── [Module]-specific errors...
```

## Base DomainError

Unlike a REST project, a GraphQL error has no HTTP status code of its own — every response is `200 OK` with an `errors` array. `DomainError` carries a `code` string instead, which becomes `extensions.code` on the `GraphQLError`:

```typescript
// src/shared/errors/domain-error.ts
export type DomainErrorCode =
  | 'BAD_USER_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INTERNAL_SERVER_ERROR'

export class DomainError extends Error {
  private readonly _code: DomainErrorCode

  constructor(message: string, code: DomainErrorCode = 'BAD_USER_INPUT') {
    super(message)
    this.name = 'DomainError'
    this._code = code
    Object.setPrototypeOf(this, DomainError.prototype)
  }

  get code(): DomainErrorCode {
    return this._code
  }
}
```

## Custom Module Errors

Each module creates specific errors in `errors/<module>-errors.ts`. The constructor receives an **i18n key** (not translated text):

```typescript
// src/modules/user/errors/user-errors.ts
import { DomainError } from '@/shared/errors'

export class UserNotFoundError extends DomainError {
  constructor(message: string = 'errors.user_not_found') {
    super(message, 'NOT_FOUND')
    this.name = 'UserNotFoundError'
    Object.setPrototypeOf(this, UserNotFoundError.prototype)
  }
}

export class UserAlreadyExistsError extends DomainError {
  constructor(message: string = 'errors.user_already_exists') {
    super(message, 'CONFLICT')
    this.name = 'UserAlreadyExistsError'
    Object.setPrototypeOf(this, UserAlreadyExistsError.prototype)
  }
}
```

## Error Naming Convention

- Extend from `DomainError`
- Constructor receives an i18n key (with a sensible default), never pre-translated text
- Name describes the problem: `UserNotFoundError`, `UserAlreadyExistsError`, `InvalidCredentialsError`
- `code` must be one of the fixed `DomainErrorCode` values — don't invent new ones per error, group by family
- Set `Object.setPrototypeOf` for proper `instanceof` checks

## Error Handling via Apollo `formatError`

A single formatter is the only place a `DomainError` becomes a `GraphQLError`. Resolvers and use-cases let errors bubble up unmodified — they never `try/catch` and reformat.

```typescript
// src/plugins/format-error.ts
import { GraphQLFormattedError, GraphQLError } from 'graphql'
import { unwrapResolverError } from '@apollo/server/errors'
import { DomainError, ValidationError } from '@/shared/errors'
import { I18nService } from '@/services/i18n.service'

export const formatError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  const original = unwrapResolverError(error)

  if (original instanceof ValidationError) {
    return {
      ...formattedError,
      message: I18nService.translate('validations.failed'),
      extensions: {
        code: original.code,
        validationErrors: original.metadata?.['errors'],
      },
    }
  }

  if (original instanceof DomainError) {
    return {
      ...formattedError,
      message: I18nService.translate(original.message, original.metadata),
      extensions: { code: original.code },
    }
  }

  // Unexpected error — log server-side, never leak internals to the client
  console.error('Unexpected error:', original)

  return {
    ...formattedError,
    message: I18nService.translate('errors.internal_server_error'),
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  }
}
```

```typescript
// src/app.ts
import { ApolloServer } from '@apollo/server'
import { formatError } from './plugins/format-error'

const server = new ApolloServer({
  schema,
  formatError,
})
```

## i18n Service

The i18n service centralizes all user-facing messages — unchanged in shape from a REST project, since translation is a transport-agnostic concern:

```typescript
// src/services/i18n.service.ts
type Locale = 'en' | 'pt-br'

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'errors.user_not_found': 'User {{identifier}} not found',
    'errors.user_already_exists': 'User {{email}} already exists',
    'errors.invalid_credentials': 'Invalid email or password',
    'errors.internal_server_error': 'An unexpected error occurred',
    'validations.failed': 'Validation failed',
  },
  'pt-br': {
    'errors.user_not_found': 'Usuário {{identifier}} não encontrado',
    'errors.user_already_exists': 'Usuário {{email}} já existe',
    'errors.invalid_credentials': 'Email ou senha inválidos',
    'errors.internal_server_error': 'Um erro inesperado ocorreu',
    'validations.failed': 'Validação falhou',
  },
}

export const I18nService = {
  translate(key: string, params?: Record<string, unknown>): string {
    const locale = (process.env['LOCALE'] || 'pt-br') as Locale
    let message = translations[locale]?.[key] || key

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        message = message.replace(`{{${k}}}`, String(v))
      })
    }

    return message
  },
}
```

## Message Organization

```
errors.*          → Business logic errors
validations.*     → Input validation errors (class-validator custom messages, see 05-validation.md)
notifications.*   → Email/notification templates
```

`responses.*` from the REST reference project doesn't apply here — a GraphQL mutation's "success message" is just a field on the returned `@ObjectType`, not a wrapper envelope.

## ValidationError with Metadata

```typescript
// src/shared/errors/validation-error.ts
import { DomainError } from './domain-error'

export class ValidationError extends DomainError {
  readonly metadata?: Record<string, unknown>

  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'BAD_USER_INPUT')
    this.name = 'ValidationError'
    if (metadata) {
      this.metadata = metadata
    }
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}
```

Used to include field-level validation details (populated by `validateInput()`, see [05. Validation](05-validation.md)):

```typescript
throw new ValidationError('validations.failed', {
  errors: [
    { path: 'email', message: I18nService.translate('validations.email') },
    {
      path: 'password',
      message: I18nService.translate('validations.password_min', { min: 8 }),
    },
  ],
})
```

## Common Mistakes

| ❌ Mistake                                | ✅ Solution                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Hardcoded error messages                  | Use i18n service                                                                    |
| Generic Error class                       | Extend DomainError                                                                  |
| Prisma errors exposed                     | Catch and rethrow as DomainError                                                    |
| HTTP status code on the error             | Use `DomainErrorCode` (`code`), not a status code — GraphQL has no per-error status |
| Resolver catching and reformatting errors | Let it bubble; only `formatError` translates                                        |
| Error name doesn't match class            | Set `error.name = ClassName`                                                        |
| Not using `Object.setPrototypeOf`         | `instanceof` checks fail                                                            |

---

Next: [Validation](05-validation.md)
