# 12. GraphQL Operational Concerns

These concerns have no equivalent in a REST project. A REST endpoint returns a fixed, developer-controlled shape; a GraphQL query lets the _client_ decide the shape and depth of what gets fetched. That flexibility is exactly what creates the four problems this document addresses.

## 1. DataLoader Is Mandatory for Relational Fields

### The Problem

```graphql
query {
  users {
    # 1 query
    id
    orders {
      # N queries — one per user!
      id
    }
  }
}
```

Any `@FieldResolver` that resolves a relation is called **once per parent object** by default. A list of 100 users each resolving `orders` naively means 1 query for users + 100 queries for orders — the N+1 problem. This is the single most common GraphQL-specific bug, and it never shows up in a REST project because REST endpoints don't nest arbitrarily.

### The Rule

Every `@FieldResolver` that resolves a relation **must** batch through a `DataLoader`. Direct repository calls inside a `@FieldResolver` are forbidden.

```typescript
// src/modules/order/loaders/orders-by-user-id.loader.ts
import DataLoader from 'dataloader'
import { OrderRepository } from '../repository/order.repository'
import { Order } from '../entity/order.entity'

export const buildOrdersByUserIdLoader = (): DataLoader<string, Order[]> =>
  new DataLoader<string, Order[]>(async (userIds) => {
    const orders = await OrderRepository.findManyByUserIds(userIds)

    // DataLoader requires the output array to match the input keys 1:1, in order
    return userIds.map((userId) =>
      orders.filter((order) => order.userId === userId),
    )
  })
```

```typescript
// src/modules/user/resolvers/user.resolver.ts
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

### Loaders Are Request-Scoped, Never Singletons

```typescript
// src/context/create-context.ts
import { buildOrdersByUserIdLoader } from '@/modules/order/loaders/orders-by-user-id.loader'

export const createContext = async ({
  req,
}: {
  req: Request
}): Promise<GraphQLContext> => ({
  currentUser: await resolveCurrentUser(req),
  locale: resolveLocale(req),
  loaders: {
    ordersByUserId: buildOrdersByUserIdLoader(),
  },
})
```

**Why per-request, not module-level?** A `DataLoader` caches every key it's asked to load, for the lifetime of the instance. A module-level singleton loader would leak one request's cached data into the next request — potentially serving user A's orders to user B. Building a fresh loader per request via the context factory is the only safe option.

---

## 2. Query Complexity and Depth Limits

### The Problem

A REST API's cost is bounded by the number of endpoints a client can call. A GraphQL client can request unbounded nested data in a _single_ query — this is the schema-level equivalent of having no rate limiting at all.

### The Rule

Apollo Server is configured with a query complexity validation rule. Every field with non-trivial cost (list-returning fields, deep relations) declares an explicit `complexity` option. A query exceeding the configured budget (`Environments.graphqlComplexityLimit`, see [09. Configuration](09-configuration.md)) is rejected **before execution**, not after.

```typescript
// src/modules/user/graphql/object-types/user.object-type.ts
import { Field, ObjectType } from 'type-graphql'

@ObjectType()
export class UserType {
  @Field()
  email!: string

  // A list-returning field costs more than a scalar — declare it
  @Field(() => [OrderType], { complexity: 5 })
  orders!: OrderType[]
}
```

```typescript
// src/plugins/complexity-plugin.ts
import {
  getComplexity,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity'
import { Environments } from '@/config/environments'

export const complexityPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request, document, schema }: any) {
        const complexity = getComplexity({
          schema,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        })

        if (complexity > Environments.graphqlComplexityLimit) {
          throw new ValidationError('validations.query_too_complex', {
            complexity,
          })
        }
      },
    }
  },
}
```

Depth is limited separately (e.g., `graphql-depth-limit` as a validation rule) using `Environments.graphqlDepthLimit`, to reject pathologically nested queries even if their raw complexity score looks acceptable.

**Why:** Without this, a single malicious or buggy client query (e.g., users → orders → items → reviews → ... nested arbitrarily) can degrade the whole service. There's no REST equivalent to "the client picked an unbounded shape" — this is a first-class concern here.

---

## 3. Context Is the Only Way to Reach Request State

### The Rule

A single `createContext({ req })` function builds a request-scoped object. Resolvers and use-cases access it via the `@Ctx()` argument — never through a module-level global or by reaching into `req` out-of-band.

```typescript
// src/context/create-context.ts
export type GraphQLContext = {
  currentUser: AuthenticatedUser | null
  locale: string
  loaders: {
    ordersByUserId: DataLoader<string, Order[]>
    // ...one entry per relation this request might touch
  }
}

export const createContext = async ({
  req,
}: {
  req: Request
}): Promise<GraphQLContext> => {
  const currentUser = await resolveCurrentUser(req) // verifies JWT once, here
  return {
    currentUser,
    locale: (req.headers['accept-language'] as string) ?? Environments.locale,
    loaders: buildLoaders(),
  }
}
```

```typescript
// src/app.ts
const server = new ApolloServer({ schema, formatError })
const { url } = await startStandaloneServer(server, { context: createContext })
```

### Authentication vs Authorization

- **Authentication** is resolved **once**, in `createContext`, exposed as `ctx.currentUser`
- **Authorization** (can _this_ user do _this_ thing) is still checked explicitly wherever it matters — in the resolver or the use-case. A valid `ctx.currentUser` is not implicit permission for every operation; each mutation/query that needs a permission check makes it explicitly.

```typescript
@Mutation(() => OrderType)
async cancelOrder(@Arg('id') id: string, @Ctx() ctx: GraphQLContext): Promise<OrderType> {
  if (!ctx.currentUser) throw new UnauthenticatedError()

  const order = await CancelOrderUseCase.cancelOrder({ orderId: id, requestedBy: ctx.currentUser.id })
  return toOrderType(order)
}
```

---

## 4. Schema Is Code-First and Committed

### The Rule

TypeGraphQL decorators (`@ObjectType`, `@Field`, `@Resolver`, etc.) are the single source of truth for the schema — there is no hand-written `.graphql` SDL file to keep in sync. The schema TypeGraphQL _generates_ from those decorators (`buildSchema({ emitSchemaFile: true })`) is written to `schema.graphql` at build/dev time, and that file is **committed to the repository**, not gitignored.

```typescript
// src/schema/build-schema.ts
export const buildAppSchema = () =>
  buildSchema({
    resolvers: [UserResolver, AuthResolver, OrderResolver],
    validate: false,
    emitSchemaFile: {
      path: './schema.graphql',
      commentDescriptions: true,
    },
  })
```

**Why:** A schema change is an API change. Committing `schema.graphql` means every PR that adds a field, renames an argument, or removes a query shows that change explicitly in the diff — the same way a Prisma migration file shows a database change explicitly, instead of leaving it implicit in a generated artifact nobody reviews.

---

## Summary Checklist (New GraphQL-Specific Items)

- [ ] Every `@FieldResolver` resolving a relation uses a `DataLoader`, never a direct repository call
- [ ] Every `DataLoader` is built fresh inside `createContext`, never as a module-level singleton
- [ ] Every list-returning or deep-relation `@Field()` declares an explicit `complexity`
- [ ] Query complexity and depth limits are enforced server-wide via `Environments.graphqlComplexityLimit` / `graphqlDepthLimit`
- [ ] `ctx.currentUser` is resolved once, in `createContext` — never re-derived ad hoc in a resolver
- [ ] Per-operation authorization is checked explicitly where it matters, not assumed from a valid `ctx.currentUser`
- [ ] `schema.graphql` is committed and reviewed in every PR that changes the schema

---

Next: [Backend Development Checklist](13-backend-development-checklist.md)
