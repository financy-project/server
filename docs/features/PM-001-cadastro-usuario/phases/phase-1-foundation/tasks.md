## Phase 1: Foundation

- [x] B-001: Scaffold module skeletons: `node scripts/scaffold-module.js user` and `node scripts/scaffold-module.js auth`
- [x] B-002: Add `User` and `Auth` models to `prisma/schema.prisma`:
  ```prisma
  model User {
    id        String   @id
    email     String   @unique
    name      String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("users")
  }

  model Auth {
    id        String   @id
    userId    String   @unique
    password  String
    user      User     @relation(fields: [userId], references: [id])
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("auth")
  }
  ```
  Run `pnpm prisma:migrate:dev --name add_user_and_auth`, then `pnpm prisma:generate`.
- [x] B-003: Implement `User` entity (`src/modules/user/entity/user.entity.ts`): `UserProps = { id: string; email: string; name: string }`, `CreateUserProps = Omit<UserProps, 'id'>`, `static create(props: CreateUserProps): User` (generates `id` via `generateUUID()`), `static fromRepository(props: UserProps): User`
- [x] B-004: Unit tests for `User` entity (`src/modules/user/__tests__/unit/entity/user-create-describe.test.ts`): `create` sets the provided `email`/`name` and generates a UUID `id`; `create` generates a unique `id` per call
- [x] B-005: Implement `Auth` entity (`src/modules/auth/entity/auth.entity.ts`): `AuthProps = { id: string; userId: string; password: string }`, `CreateAuthProps = Omit<AuthProps, 'id'>`, `static create(props: CreateAuthProps): Auth`, `static fromRepository(props: AuthProps): Auth`
- [x] B-006: Unit tests for `Auth` entity (`src/modules/auth/__tests__/unit/entity/auth-create-describe.test.ts`): `create` sets the provided `userId`/`password` and generates a UUID `id`
- [x] B-007: Implement `UserAlreadyExistsError` (`src/modules/user/errors/user-errors.ts`): extends `DomainError`, `constructor(message: string = 'errors.user_already_exists')`, code `'CONFLICT'`, `this.name = 'UserAlreadyExistsError'`, `Object.setPrototypeOf(this, UserAlreadyExistsError.prototype)`

