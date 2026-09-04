import { getCurrentMonthRange, getMonthRange } from '../../date-range'

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

describe('getMonthRange()', () => {
  it('returns Jan 1 00:00:00.000 to Jan 31 23:59:59.999 for (2026, 1)', () => {
    const { startDate, endDate } = getMonthRange(2026, 1)

    expect(startDate).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
    expect(endDate).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999))
  })

  it('returns Feb 1-29 for a leap year (2024, 2)', () => {
    const { startDate, endDate } = getMonthRange(2024, 2)

    expect(startDate).toEqual(new Date(2024, 1, 1, 0, 0, 0, 0))
    expect(endDate).toEqual(new Date(2024, 1, 29, 23, 59, 59, 999))
  })

  it('returns Apr 1-30 for a 30-day month (2026, 4)', () => {
    const { startDate, endDate } = getMonthRange(2026, 4)

    expect(startDate).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0))
    expect(endDate).toEqual(new Date(2026, 3, 30, 23, 59, 59, 999))
  })
})
