import { GetHealthUseCase } from '../../../use-cases/get-health.use-case'

describe('GetHealthUseCase.getHealth', () => {
  it('returns status ok and a non-negative uptime', () => {
    const result = GetHealthUseCase.getHealth()

    expect(result.status).toBe('ok')
    expect(result.uptime).toBeGreaterThanOrEqual(0)
  })
})
