import { prisma } from '@/lib/prisma'

// Connects/disconnects the test database around the calling describe block.
// See docs/architecture/03-repository.md and 08-testing.md — repository tests
// run against the real database (docker-compose.integration.yml /
// docker-compose.e2e.yml), never mocked. No automatic truncation: data is
// never wiped by the test run — tear down manually with
// `pnpm docker:integration:down` / `pnpm docker:e2e:down` when you want a
// clean slate.
export function useDatabase(): void {
  afterAll(async () => {
    await prisma.$disconnect()
  })
}
