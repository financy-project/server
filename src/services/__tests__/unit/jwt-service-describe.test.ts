import { JwtService } from '../../jwt.service'

describe('JwtService', () => {
  describe('sign()', () => {
    it('returns a JWT string containing the sub claim', () => {
      const token = JwtService.sign({ sub: 'user-123' })

      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)

      const payload = JSON.parse(
        Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'),
      )
      expect(payload.sub).toBe('user-123')
    })
  })

  describe('verify()', () => {
    it('returns { sub } for a token signed by sign()', () => {
      const token = JwtService.sign({ sub: 'user-456' })

      const result = JwtService.verify(token)

      expect(result).not.toBeNull()
      expect(result?.sub).toBe('user-456')
    })

    it('returns null for a malformed token', () => {
      const result = JwtService.verify('not.a.valid.token')

      expect(result).toBeNull()
    })

    it('returns null for an expired token', () => {
      const token = JwtService.sign({ sub: 'user-789' }, '-1s')

      const result = JwtService.verify(token)

      expect(result).toBeNull()
    })
  })
})
