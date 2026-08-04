import { parseDurationToSeconds } from '../../parse-duration'

describe('parseDurationToSeconds()', () => {
  it("converts '7d' to 604800 seconds", () => {
    expect(parseDurationToSeconds('7d')).toBe(604800)
  })

  it("converts '1h' to 3600 seconds", () => {
    expect(parseDurationToSeconds('1h')).toBe(3600)
  })

  it("converts '30m' to 1800 seconds", () => {
    expect(parseDurationToSeconds('30m')).toBe(1800)
  })

  it("converts '45s' to 45 seconds", () => {
    expect(parseDurationToSeconds('45s')).toBe(45)
  })

  it('throws for an unsupported suffix', () => {
    expect(() => parseDurationToSeconds('10x')).toThrow()
  })
})
