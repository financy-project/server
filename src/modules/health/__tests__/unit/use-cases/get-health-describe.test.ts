import { getAppVersion } from '@/config/app-version'
import { GetHealthUseCase } from '../../../use-cases/get-health.use-case'
import { HealthRepository } from '../../../repository/health.repository'

jest.mock('../../../repository/health.repository')

describe('GetHealthUseCase.getHealth', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns connected: true and status ok when the database is reachable', async () => {
    jest
      .mocked(HealthRepository.checkDatabaseConnection)
      .mockResolvedValueOnce(true)

    const result = await GetHealthUseCase.getHealth()

    expect(result.connected).toBe(true)
    expect(result.status).toBe('ok')
  })

  it('returns connected: false and status degraded when the database is unreachable', async () => {
    jest
      .mocked(HealthRepository.checkDatabaseConnection)
      .mockResolvedValueOnce(false)

    const result = await GetHealthUseCase.getHealth()

    expect(result.connected).toBe(false)
    expect(result.status).toBe('degraded')
  })

  it('returns the current server version and a non-negative uptime', async () => {
    jest
      .mocked(HealthRepository.checkDatabaseConnection)
      .mockResolvedValueOnce(true)

    const result = await GetHealthUseCase.getHealth()

    expect(result.version).toBe(getAppVersion())
    expect(result.uptime).toBeGreaterThanOrEqual(0)
  })
})
