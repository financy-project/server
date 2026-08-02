import type { IncomingMessage } from 'http'
import { Environments } from '@/config/environments'

export type AuthenticatedUser = {
  id: string
}

export type GraphQLContext = {
  currentUser: AuthenticatedUser | null
  locale: string
  loaders: Record<string, never>
  // Add one entry per relation this request might touch as modules grow —
  // see docs/architecture/12-graphql-operational-concerns.md. Loaders are
  // built fresh here, per request, never as module-level singletons.
}

const resolveCurrentUser = (
  _req: IncomingMessage,
): AuthenticatedUser | null => {
  // No auth module yet — replace with real JWT verification once one exists.
  return null
}

export const createContext = async ({
  req,
}: {
  req: IncomingMessage
}): Promise<GraphQLContext> => {
  return {
    currentUser: resolveCurrentUser(req),
    locale: Environments.locale,
    loaders: {},
  }
}
