import type { HealthStatus } from '../types'

const getHealth = (): HealthStatus => {
  return { status: 'ok', uptime: process.uptime() }
}

export const GetHealthUseCase = {
  getHealth,
}
