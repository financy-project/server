import { getAppVersion } from '@/config/app-version'
import { HealthRepository } from '../repository/health.repository'
import type { HealthStatus } from '../types'

const getHealth = async (): Promise<HealthStatus> => {
  const connected = await HealthRepository.checkDatabaseConnection()

  return {
    status: connected ? 'ok' : 'degraded',
    uptime: process.uptime(),
    connected,
    version: getAppVersion(),
  }
}

export const GetHealthUseCase = {
  getHealth,
}
