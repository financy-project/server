import type { IncomingMessage, ServerResponse } from 'http'
import { parseCookies, serializeCookie } from '@/shared/utils/cookies'
import { JwtService } from '@/services/jwt.service'
import { ACCESS_TOKEN_COOKIE_NAME } from '@/utils/constants'
import { Environments } from '@/config/environments'

export type CookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
  path?: string
  maxAgeSeconds?: number
}

export type AuthenticatedUser = {
  id: string
}

export type GraphQLContext = {
  currentUser: AuthenticatedUser | null
  locale: string
  loaders: Record<string, never>
  cookies: {
    get(name: string): string | undefined
    set(name: string, value: string, options?: CookieOptions): void
  }
}

const resolveCurrentUser = (req: IncomingMessage): AuthenticatedUser | null => {
  const cookies = parseCookies(req.headers['cookie'])
  const token = cookies[ACCESS_TOKEN_COOKIE_NAME]
  if (!token) return null

  const payload = JwtService.verify(token)
  if (!payload) return null

  return { id: payload.sub }
}

export const createContext = async ({
  req,
  res,
}: {
  req: IncomingMessage
  res: ServerResponse
}): Promise<GraphQLContext> => {
  const cookieStore = parseCookies(req.headers['cookie'])

  return {
    currentUser: resolveCurrentUser(req),
    locale: Environments.locale,
    loaders: {},
    cookies: {
      get(name: string): string | undefined {
        return cookieStore[name]
      },
      set(name: string, value: string, options?: CookieOptions): void {
        const serialized = serializeCookie(name, value, options ?? {})
        res.setHeader('Set-Cookie', serialized)
      },
    },
  }
}
