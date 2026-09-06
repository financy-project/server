import { useDatabase } from '@/test/helpers/db'
import { HealthRepository } from '@/repositories/health.repository'

describe('HealthRepository.checkDatabaseConnection (integration)', () => {
  useDatabase()

  it('returns true when the database is reachable', async () => {
    const result = await HealthRepository.checkDatabaseConnection()

    expect(result).toBe(true)
  })
})
