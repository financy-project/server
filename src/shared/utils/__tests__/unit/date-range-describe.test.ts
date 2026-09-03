import { getCurrentMonthRange } from '../../date-range'

describe('getCurrentMonthRange()', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:34:56.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns the first day of the current month at start-of-day', () => {
    const { startDate } = getCurrentMonthRange()

    expect(startDate.getFullYear()).toBe(2026)
    expect(startDate.getMonth()).toBe(8) // September (0-indexed)
    expect(startDate.getDate()).toBe(1)
    expect(startDate.getHours()).toBe(0)
    expect(startDate.getMinutes()).toBe(0)
    expect(startDate.getSeconds()).toBe(0)
    expect(startDate.getMilliseconds()).toBe(0)
  })

  it('returns the last day of the current month at end-of-day', () => {
    const { endDate } = getCurrentMonthRange()

    expect(endDate.getFullYear()).toBe(2026)
    expect(endDate.getMonth()).toBe(8)
    expect(endDate.getDate()).toBe(30) // September has 30 days
    expect(endDate.getHours()).toBe(23)
    expect(endDate.getMinutes()).toBe(59)
    expect(endDate.getSeconds()).toBe(59)
    expect(endDate.getMilliseconds()).toBe(999)
  })
})
