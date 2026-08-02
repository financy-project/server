# 10. Cross-Module Communication

This document explains how modules communicate while maintaining **strict isolation boundaries**. We support two primary patterns: **Event-Driven** (asynchronous) and **Ports & Adapters & Gateways** (synchronous). Neither pattern depends on the transport layer — the same rules apply whether the trigger was a resolver or a background job.

---

## Pattern 1: Event-Driven (Asynchronous)

### Use Case

When **module A needs to react** to something **module B does**, but the reaction can be asynchronous (e.g., send email, update cache, audit log).

### Structure

```
Module B (Producer)
  └─ use-case emits event after success
      └─ EventEmitter.emit('user.created', { userId, email })

Module A (Consumer)
  └─ listener subscribes to event
      └─ EventEmitter.on('user.created', handleUserCreated)
```

### Implementation Example

**1. Define event in shared**:

```ts
// shared/events/user.events.ts
export type UserCreatedEvent = {
  userId: string
  email: string
  name: string
}
```

**2. Module B emits after orchestration** (from the use-case, never the resolver):

```ts
// user/use-cases/register-user.use-case.ts
const registerUser = async (input: RegisterUserInput): Promise<User> => {
  const user = User.create(input)
  await UserRepository.create(user)

  // Fire-and-forget: emit event, don't wait for listeners
  EventEmitter.emit('user.created', {
    userId: user.id,
    email: user.email,
    name: user.name,
  })

  return user
}
```

**3. Module A defines a receiver**:

```ts
// shared/receivers/user-created.receiver.ts
const handleUserCreated = async (event: UserCreatedEvent): Promise<void> => {
  try {
    await EmailService.sendActivationEmail({
      email: event.email,
      name: event.name,
    })
  } catch (error) {
    console.error('Failed to send activation email:', error)
  }
}

export const UserCreatedReceiver = {
  subscribe(): void {
    EventEmitter.on('user.created', handleUserCreated)
  },
}
```

**4. `.subscribe()` MUST be called from `listenersRegistrator.ts`** — this is the step that's easy to forget:

```ts
// src/utils/listenersRegistrator.ts
import { UserCreatedReceiver } from '@/modules/shared'

export const listenersRegistrator = (): void => {
  UserCreatedReceiver.subscribe()
}
```

Call `listenersRegistrator()` once, at process startup, alongside building the Apollo schema — before the server starts accepting operations.

⚠️ **This is not optional and nothing else catches a missed registration.** A receiver's own unit test typically mocks `EventEmitter` to verify `.subscribe()` calls `.on()` with the right handler — that test passes whether or not `listenersRegistrator.ts` ever calls `.subscribe()` in the first place. If you skip this step, the receiver is fully implemented, fully tested, and completely inert in the running app: `EventEmitter.emit(...)` fires into an empty room. Always verify by exercising the real flow end-to-end (an integration test with a real `EventEmitter` and real downstream service — see [08. Testing](08-testing.md#integration-tests)), not just the receiver in isolation.

### When to Use

✅ Audit logging
✅ Sending emails / notifications
✅ Updating caches
✅ Aggregating data from multiple modules
✅ Async workflows

### Advantages

- **True decoupling** — Modules don't reference each other
- **Scalable** — Easy to add new listeners
- **Async-friendly** — Listeners run independently

### Disadvantages

- **Asynchronous only** — Can't get return values from listeners
- **Error handling** — Listener failures don't fail the orchestrator
- **Debugging** — Flow is implicit, harder to trace

---

## Pattern 2: Ports & Adapters & Gateways (Synchronous)

### Use Case

When **module A (requester) needs synchronous validation or data** from **module B (requested)**, with immediate results (e.g., validate email exists, fetch user data, orchestrate multi-module transactions).

### Three-Layer Pattern

**Port** (in requester) — type definition of what the requester needs, lives in `requester/ports/`.

**Adapter** (in requested module) — implementation of the port, lives in `requested/adapters/`, encapsulates the requested module's logic (query repo, transform data).

**Gateway** (in requester) — orchestration layer that calls the adapter, lives in `requester/gateways/`, adds validation/error handling, called by use-cases (never resolvers, never adapters directly).

### Structure

```
Requester Module (e.g., auth)
  ├── ports/
  │   └─ find-user.port.ts          (type definition)
  ├── gateways/
  │   └─ find-user.gateway.ts        (validation + adapter call)
  └── use-cases/
      └─ verify-session.use-case.ts   (calls gateway)

Requested Module (e.g., user)
  └── adapters/
      └─ find-user.adapter.ts        (implements port)
```

### Implementation Example

**1. Define port in requester** (the contract):

```ts
// auth/ports/find-user.port.ts
export type UserDTO = {
  id: string
  name: string
}

export type FindUserByEmailPort = (email: string) => Promise<UserDTO | null>
```

**2. Requested module provides the adapter** (the implementation):

```ts
// user/adapters/find-user.adapter.ts
import type { FindUserByEmailPort } from '@/modules/auth/ports'
import { UserRepository } from '../repository'
import { UserNotFoundError } from '../errors/user-errors'

export const findUserByEmailAdapter: FindUserByEmailPort = async (email) => {
  try {
    const user = await UserRepository.findByEmail(email)
    return { id: user.id, name: user.name }
  } catch (error) {
    if (error instanceof UserNotFoundError) return null
    throw error
  }
}
```

**3. Requester's gateway encapsulates the call** (validation + orchestration):

```ts
// auth/gateways/find-user.gateway.ts
import { InvalidInputError } from '@/shared/errors'
import { findUserByEmailAdapter } from '@/modules/user/adapters'
import type { UserDTO } from '../ports'

export async function findUserByEmail(email: string): Promise<UserDTO | null> {
  if (!email) throw new InvalidInputError('validations.email_required')
  return await findUserByEmailAdapter(email)
}
```

**4. Use-case calls the gateway (not the adapter)**:

```ts
// auth/use-cases/verify-session.use-case.ts
import { findUserByEmail } from '../gateways'

const verifySession = async (email: string): Promise<User> => {
  const user = await findUserByEmail(email)
  if (!user) throw new UserNotFoundError(email)
  return user
}

export const VerifySessionUseCase = { verifySession }
```

### When to Use

✅ Validation that requires another module's data
✅ Fetching data from another module
✅ Multi-step orchestration with immediate results
✅ Shared business logic that must return values

### Advantages

- **Synchronous** — Get results immediately
- **Type-safe** — Port interface provides contract
- **Testable** — Mock the adapter in tests, mock the gateway in use-case tests
- **Adapter ownership** — Requested module owns and implements its adapter

### Disadvantages

- **Direct dependency** — Port creates synchronous dependency
- **Performance** — Synchronous calls block

---

## Comparison Table

| Aspect             | Event-Driven            | Ports & Adapters & Gateways  |
| ------------------ | ----------------------- | ---------------------------- |
| **Coupling**       | Very loose              | Moderate                     |
| **Synchronous**    | ❌ No                   | ✅ Yes                       |
| **Return values**  | ❌ None                 | ✅ Yes                       |
| **Error handling** | Listeners fail silently | Propagates to caller         |
| **Testability**    | Hard to mock listeners  | Easy to mock adapter/gateway |

## Decision Matrix

| Scenario                                 | Use Event-Driven | Use Ports & Adapters |
| ---------------------------------------- | ---------------- | -------------------- |
| "Send email after user created"          | ✅               | ❌                   |
| "Validate email is unique during signup" | ❌               | ✅                   |
| "Update analytics after purchase"        | ✅               | ❌                   |
| "Fetch user data before creating order"  | ❌               | ✅                   |
| "Verify user exists before session"      | ❌               | ✅                   |

---

## Anti-Patterns (Never Do This)

❌ **Direct imports between modules**:

```ts
// FORBIDDEN
import { UserRepository } from '@/modules/user'
```

❌ **Use-case calling adapter directly** (must call gateway):

```ts
// FORBIDDEN
import { findUserByEmailAdapter } from '@/modules/user/adapters'
const user = await findUserByEmailAdapter(email) // ← Wrong
```

❌ **Resolver calling a gateway or adapter directly** (must go through a use-case):

```ts
// FORBIDDEN
@Query(() => UserType)
async user(@Arg('email') email: string): Promise<UserType> {
  const user = await findUserByEmail(email) // ← resolver bypassing the use-case layer
  return toUserType(user)
}
```

❌ **Receiver defined but never subscribed** (dead code that passes its own tests):

```ts
// FORBIDDEN — UserCreatedReceiver exists and is unit-tested,
// but nothing in listenersRegistrator.ts calls .subscribe()
// so 'user.created' has no listener in the running app
```

---

## Summary

**Ownership Rules:**

- **Port** — Defined in **requester module**
- **Adapter** — Implemented in **requested module**
- **Gateway** — Defined in **requester module**

**Calling Rules:**

- **Resolvers** call **use-cases**, never gateways or adapters directly
- **Use-cases** call **gateways**, never adapters
- **Gateways** call **adapters** with validation/orchestration
- **Adapters** call their own repositories, never other modules' adapters

**Pattern Selection:**

- **Asynchronous reactions** → Use **Events**
- **Synchronous validation/orchestration** → Use **Ports & Adapters & Gateways**

---

Next: [Definition of Ready (DoR)](11-dor.md)
