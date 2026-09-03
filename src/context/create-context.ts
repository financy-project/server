import type { IncomingMessage, ServerResponse } from 'http'
import type DataLoader from 'dataloader'
import { parseCookies, serializeCookie } from '@/shared/utils/cookies'
import { JwtService } from '@/services/jwt.service'
import { ACCESS_TOKEN_COOKIE_NAME } from '@/utils/constants'
import { Environments } from '@/config/environments'
import type { CategoryDTO } from '@/modules/transaction/ports'
import { buildCategoriesByIdLoader } from '@/modules/transaction/loaders'
import { buildTransactionsQuantityByCategoryIdLoader } from '@/modules/category/loaders'

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
  loaders: {
    categoriesById: DataLoader<string, CategoryDTO | null>
    transactionsQuantityByCategoryId: DataLoader<string, number>
  }
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
    loaders: {
      categoriesById: buildCategoriesByIdLoader(),
      transactionsQuantityByCategoryId:
        buildTransactionsQuantityByCategoryIdLoader(),
    },
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
