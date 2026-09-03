import { encodeCursor, decodeCursor } from '../../cursor'

describe('encodeCursor()/decodeCursor()', () => {
  it('round-trips a { date, id } pair', () => {
    const date = new Date('2026-09-01T00:00:00.000Z')
    const id = '01912345-abcd-7000-8000-000000000000'

    const cursor = encodeCursor({ date, id })
    const decoded = decodeCursor(cursor)

    expect(decoded.date).toEqual(date)
    expect(decoded.id).toBe(id)
  })

  it('produces a base64-encoded string', () => {
    const cursor = encodeCursor({
      date: new Date('2026-09-01T00:00:00.000Z'),
      id: 'some-id',
    })

    expect(() => Buffer.from(cursor, 'base64').toString('utf-8')).not.toThrow()
    expect(cursor).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('throws a clear error on a malformed cursor string', () => {
    expect(() => decodeCursor('not-a-valid-cursor')).toThrow(/invalid cursor/i)
  })

  it('throws a clear error when the decoded payload is missing fields', () => {
    const malformed = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
      'base64',
    )

    expect(() => decodeCursor(malformed)).toThrow(/invalid cursor/i)
  })
})
