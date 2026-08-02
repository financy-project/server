# 5. Validation

Validation uses `class-validator` decorators directly on the `@InputType()`/`@ArgsType()` classes, plus a shared validation wrapper for consistency. There is **one class, one source of truth** — the same class that defines the GraphQL schema shape also defines its validation rules.

## Why Not TypeGraphQL's Automatic Validation

`type-graphql`'s `buildSchema()` can run `class-validator` automatically before every resolver call. This project disables that (`buildSchema({ validate: false })`, see [01. Module Structure](01-module-structure.md)) and calls validation explicitly instead, for the same reason the REST reference project wraps Zod in `validateSchema()` rather than relying on framework auto-validation:

- A single choke point (`validateInput()`) is where i18n translation and `ValidationError` metadata get attached
- Automatic validation throws `type-graphql`'s own `ArgumentValidationError`, which is a different shape than our `DomainError` hierarchy and would need special-casing in `formatError` anyway
- Explicit validation makes the resolver's steps (validate → delegate → map) visible and testable in isolation

## Input Type Doubles as Validation Schema

```typescript
// src/modules/auth/graphql/input-types/register-user.input.ts
import { Field, InputType } from 'type-graphql'
import { IsEmail, Length, MinLength, Matches } from 'class-validator'

@InputType()
export class RegisterUserInput {
  @Field()
  @IsEmail({}, { message: 'validations.email' })
  email!: string

  @Field()
  @Length(1, 255, { message: 'validations.name_required' })
  name!: string

  @Field()
  @MinLength(8, { message: 'validations.password_min' })
  @Matches(/[A-Z]/, { message: 'validations.password_uppercase' })
  @Matches(/[0-9]/, { message: 'validations.password_number' })
  password!: string
}
```

**Note:** the `message` option on every decorator is an **i18n key**, not English text — identical convention to the REST project's Zod schemas.

## Validation Wrapper Pattern

```typescript
// src/modules/auth/validation/register-user.validation.ts
import { RegisterUserInput } from '../graphql/input-types/register-user.input'
import { validateInput } from '@/shared/utils/validate-input'

export const RegisterUserValidation = {
  validate(input: RegisterUserInput): Promise<RegisterUserInput> {
    return validateInput(RegisterUserInput, input)
  },
}
```

## Shared validateInput Utility

Runs `class-validator`, translates i18n keys from each constraint's `message`, and throws our own `ValidationError`:

```typescript
// src/shared/utils/validate-input.ts
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { ValidationError as OurValidationError } from '@/shared/errors'
import { I18nService } from '@/services/i18n.service'

export async function validateInput<T extends object>(
  InputClass: new () => T,
  data: unknown,
): Promise<T> {
  const instance = plainToInstance(InputClass, data)
  const violations = await validate(instance as object)

  if (violations.length > 0) {
    const errors = violations.map((violation) => ({
      path: violation.property,
      message: I18nService.translate(
        Object.values(violation.constraints ?? {})[0] ?? 'validations.failed',
      ),
    }))

    throw new OurValidationError('validations.failed', { errors })
  }

  return instance
}
```

## Using Validation in the Resolver

```typescript
// src/modules/auth/resolvers/auth.resolver.ts
@Resolver()
export class AuthResolver {
  @Mutation(() => UserType)
  async registerUser(
    @Arg('input') input: RegisterUserInput,
  ): Promise<UserType> {
    // Validation throws ValidationError if invalid
    const validated = await RegisterUserValidation.validate(input)

    // Use-case receives already-validated data
    const user = await RegisterUserUseCase.registerUser(validated)

    return toUserType(user)
  }
}
```

## Common class-validator Decorators

```typescript
@IsString()
@IsEmail()
@IsInt()
@IsBoolean()
@IsEnum(UserStatus)
@IsUUID()
@Length(min, max)
@MinLength(n)
@MaxLength(n)
@Min(n)
@Max(n)
@Matches(/regex/)
@IsOptional()          // Field may be undefined — pair with @Field({ nullable: true })
@ArrayMinSize(n)
@ValidateNested()       // For nested input objects — pair with @Type(() => NestedInput)
```

Every decorator's `message` option is an i18n key, exactly like the `email` example above.

## Args vs Input

Use `@InputType()` for a single structured argument (`registerUser(input: RegisterUserInput)`); use `@ArgsType()` when a query takes several independent scalar arguments:

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

`ArgsType` classes are validated the same way, through `validateInput(FindUserArgs, args)`.

## Validation Testing

```typescript
// src/modules/auth/__tests__/unit/validation/register-user-validation-describe.test.ts
import { RegisterUserValidation } from '../../../validation/register-user.validation'
import { ValidationError } from '@/shared/errors'

describe('RegisterUserValidation.validate', () => {
  it('returns the validated input on success', async () => {
    const input = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'ValidPassword123',
    }

    const result = await RegisterUserValidation.validate(
      input as RegisterUserInput,
    )

    expect(result.email).toBe(input.email)
  })

  it('throws ValidationError with metadata on invalid data', async () => {
    const input = {
      email: 'invalid-email',
      name: 'Test User',
      password: 'weak',
    }

    await expect(
      RegisterUserValidation.validate(input as RegisterUserInput),
    ).rejects.toThrow(ValidationError)
  })
})
```

## Input Type vs Validation File

### Input Type File (`register-user.input.ts`)

- `@InputType()` class with `@Field()` + `class-validator` decorators
- No business logic
- Same class is used to build the schema AND validate

### Validation File (`register-user.validation.ts`)

- Thin wrapper calling `validateInput()`
- Called from the resolver, never from the use-case

## Common Mistakes

| ❌ Mistake                                         | ✅ Solution                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A separate Zod schema alongside the `@InputType()` | One class, one source of truth — decorate the input type itself                               |
| Relying on `buildSchema({ validate: true })`       | Disable it; validate explicitly via `validateInput()` for consistent i18n + `ValidationError` |
| Validation messages in English                     | Use i18n keys in every decorator's `message` option                                           |
| Validating in the use-case                         | Validate in the resolver, before calling the use-case                                         |
| No error metadata                                  | Include field-level details in `ValidationError`                                              |
| `class-validator` decorators on the domain entity  | Never — see [02. Entities](02-entities.md)                                                    |

---

Next: [GraphQL Types](06-graphql-types.md)
