import { parseCookies, serializeCookie } from '../../cookies'

describe('Cookie utilities', () => {
  describe('parseCookies()', () => {
    it('parses multiple key=value pairs from a cookie header', () => {
      const result = parseCookies('access_token=abc123; session=xyz; user=john')

      expect(result).toEqual({
        access_token: 'abc123',
        session: 'xyz',
        user: 'john',
      })
    })

    it('returns an empty object for an empty string', () => {
      const result = parseCookies('')

      expect(result).toEqual({})
    })

    it('returns an empty object for an undefined header', () => {
      const result = parseCookies(undefined)

      expect(result).toEqual({})
    })
  })

  describe('serializeCookie()', () => {
    it('includes HttpOnly, SameSite, Path, and Max-Age in the output', () => {
      const result = serializeCookie('access_token', 'myvalue', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAgeSeconds: 604800,
      })

      expect(result).toContain('access_token=myvalue')
      expect(result).toContain('HttpOnly')
      expect(result).toContain('SameSite=lax')
      expect(result).toContain('Path=/')
      expect(result).toContain('Max-Age=604800')
    })

    it('includes Secure when secure option is true', () => {
      const result = serializeCookie('token', 'val', {
        secure: true,
        sameSite: 'strict',
        path: '/',
      })

      expect(result).toContain('Secure')
    })

    it('does not include Secure when secure option is false', () => {
      const result = serializeCookie('token', 'val', {
        secure: false,
        sameSite: 'lax',
        path: '/',
      })

      expect(result).not.toContain('Secure')
    })

    it('does not include HttpOnly when httpOnly is false', () => {
      const result = serializeCookie('token', 'val', {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      })

      expect(result).not.toContain('HttpOnly')
    })
  })
})
