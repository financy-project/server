import type {
  AuthenticatedUser,
  GraphQLContext,
} from '@/context/create-context'
import { UnauthenticatedError } from '@/shared/errors'

export const requireCurrentUser = (ctx: GraphQLContext): AuthenticatedUser => {
  if (!ctx.currentUser) throw new UnauthenticatedError()
  return ctx.currentUser
}
