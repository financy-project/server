# Bashboard - PM-020 - Tasks

Generated mechanically from `plan.md`'s `## Implementation Phases` — each
bullet copied verbatim, prefixed with a `B-NNN` id. See `plan.md` for the
full Blueprints and Architectural Decisions behind these.

## Phase 1: Foundation

- [x] B-001: Scaffold the `dashboard` module: `node scripts/scaffold-module.js dashboard` (creates `src/modules/dashboard/` with the standard directory skeleton and barrel stubs)
- [x] B-002: Define `src/modules/dashboard/types/dashboard.types.ts`: `DashboardMovement` (`income: number`, `expense: number`, `totalBalance: number`), `CategoryBalance` (`categoryId: string`, `title: string`, `color: string`, `transactionCount: number`, `totalValue: number`), `DashboardSummary` (`movement: DashboardMovement`, `recentTransactions: Transaction[]`, `balanceByCategory: CategoryBalance[]`) — `Transaction` imported as `import type { Transaction } from '@/modules/transaction'`
- [x] B-003: Add `summarizeForUser` to `src/modules/transaction/repository/transaction.repository.ts`: `summarizeForUser(userId: string, range: { startDate: Date; endDate: Date }): Promise<TransactionSummaryRow[]>` where `TransactionSummaryRow = { categoryId: string | null; type: TransactionKind; totalValue: number; count: number }`, implemented via `prisma.transaction.groupBy({ by: ['categoryId', 'type'], where: { userId, date: { gte: range.startDate, lte: range.endDate } }, _sum: { value: true }, _count: { _all: true } })` mapped to `{ categoryId, type: group.type as TransactionKind, totalValue: group._sum.value ?? 0, count: group._count._all }`; export `TransactionSummaryRow` alongside `TransactionRepository` from `src/modules/transaction/repository/index.ts`
- [ ] B-004: Integration tests: new `describe('summarizeForUser', ...)` block appended to `src/modules/transaction/__tests__/integration/repository/transaction-repository-describe.test.ts` — cases: returns one row per distinct `(categoryId, type)` pair within range; excludes transactions outside `[startDate, endDate]`; excludes other users' transactions; includes a `categoryId: null` row for uncategorized transactions; returns `[]` when the user has no transactions in range

## Phase 2: Features

- [ ] B-005: `GetDashboardUseCase.getDashboard(userId: string): Promise<DashboardSummary>` in `src/modules/dashboard/use-cases/get-dashboard.use-case.ts`, implementing the 7 orchestration steps in the Use-Case Blueprint above (`getCurrentMonthRange()` from `@/shared/utils/date-range`, `TransactionRepository.summarizeForUser`, in-memory grouping/netting, `CategoryRepository.findManyByIds`, `TransactionRepository.findAllByUserId` for the top 5)
- [ ] B-006: Unit tests for `GetDashboardUseCase` in `src/modules/dashboard/__tests__/unit/use-cases/get-dashboard-describe.test.ts` (mocked `TransactionRepository`/`CategoryRepository`) — see `test-cases.md` for the full case list
- [ ] B-007: GraphQL object types in `src/modules/dashboard/graphql/object-types/`: `dashboard-movement.object-type.ts` (`DashboardMovementType`: `income`/`expense`/`totalBalance`, all `@Field(() => Int)`), `dashboard-category-balance.object-type.ts` (`DashboardCategoryBalanceType`: `categoryId` `@Field(() => ID)`, `title`/`color` `@Field()`, `transactionCount`/`totalValue` `@Field(() => Int)`), `dashboard.object-type.ts` (`DashboardType`: `movement` `@Field(() => DashboardMovementType)`, `recentTransactions` `@Field(() => [TransactionType], { complexity: 3 })` importing `TransactionType` from `@/modules/transaction/graphql/object-types/transaction.object-type`, `balanceByCategory` `@Field(() => [DashboardCategoryBalanceType], { complexity: 5 })`); barrel `src/modules/dashboard/graphql/object-types/index.ts` exports all three
- [ ] B-008: `toDashboardType(summary: DashboardSummary): DashboardType` in `src/modules/dashboard/mappers/dashboard.mapper.ts`, including a local `toRecentTransactionType(transaction: Transaction): TransactionType` (sets `id`, `type`, `description`, `date`, `value`, `categoryId` — same shape as `transaction`'s own `toTransactionType`, re-implemented locally per the `auth.mapper.ts` precedent, not imported)
- [ ] B-009: `DashboardResolver` in `src/modules/dashboard/resolvers/dashboard.resolver.ts`: `@Resolver(() => DashboardType) class DashboardResolver { @Query(() => DashboardType, { complexity: 6 }) async dashboard(@Ctx() ctx: GraphQLContext): Promise<DashboardType> { const { id: userId } = requireCurrentUser(ctx); const summary = await GetDashboardUseCase.getDashboard(userId); return toDashboardType(summary) } }`
- [ ] B-010: Register `DashboardResolver` in `src/schema/build-schema.ts`'s `resolvers` array (import from `@/modules/dashboard`)
- [ ] B-011: Update `src/modules/dashboard/index.ts` barrel to export `DashboardResolver` from `./resolvers` (per the "only export entity/types/enums/errors/repository/resolver" convention — no entity/errors/repository here, so it exports `types` and `resolvers` only)
- [ ] B-012: E2E test in `src/modules/dashboard/__tests__/integration/e2e/dashboard-describe.test.ts` via `buildTestSchema()` — see `test-cases.md` for the full case list

## Phase 3: Polish

- [ ] B-013: Regenerate `schema.graphql` (`pnpm build` or `pnpm dev` triggers `buildAppSchema()`'s `emitSchemaFile`) and commit the diff (new `dashboard` query, `DashboardType`, `DashboardMovementType`, `DashboardCategoryBalanceType`)
- [ ] B-014: Run `/architecture-audit src/modules/dashboard` and fix any flagged deviations
- [ ] B-015: Verify `pnpm test --testPathPatterns=dashboard` and the updated `transaction-repository-describe.test.ts` all pass, then full `pnpm test`
