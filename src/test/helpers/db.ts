import { prisma } from '@/lib/prisma'

const truncateAllTables = async (): Promise<void> => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `

  if (tables.length === 0) return

  const statements = tables.map((t) => `"${t.tablename}"`).join(', ')

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${statements} CASCADE`)
}

// Sets up/tears down the test database around every test in the calling
// describe block. See docs/architecture/03-repository.md and 08-testing.md —
// repository tests run against the real database (docker-compose.integration.yml
// / docker-compose.e2e.yml), never mocked.
export function useDatabase(): void {
  beforeAll(async () => {
    await truncateAllTables()
  })

  afterEach(async () => {
    await truncateAllTables()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
}
