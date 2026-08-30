import jwt from 'jsonwebtoken'
import { Environments } from '@/config/environments'

type JwtPayload = {
  sub: string
}

type JwtExpiry = string | number

export const JwtService = {
  sign(payload: JwtPayload, expiresIn?: JwtExpiry): string {
    const resolvedExpiry: JwtExpiry =
      expiresIn !== undefined ? expiresIn : Environments.jwtExpiry

    return jwt.sign(payload, Environments.jwtSecret, {
      expiresIn: resolvedExpiry as never,
    })
  },

  verify(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, Environments.jwtSecret)

      if (typeof decoded === 'string' || !decoded['sub']) {
        return null
      }

      return { sub: String(decoded['sub']) }
    } catch {
      return null
    }
  },
}
