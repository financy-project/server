import type { GraphQLContext } from '@/context/create-context'
import { UnauthenticatedError } from '@/shared/errors'
import { requireCurrentUser } from '../../require-current-user'

describe('requireCurrentUser', () => {
  const buildContext = (
    currentUser: GraphQLContext['currentUser'],
  ): GraphQLContext => ({
    currentUser,
    locale: 'en',
    loaders: {} as never,
    cookies: {
      get: jest.fn(),
      set: jest.fn(),
    },
  })

  it('T-009: returns ctx.currentUser when set', () => {
    const ctx = buildContext({ id: 'user-123' })

    const result = requireCurrentUser(ctx)

    expect(result).toEqual({ id: 'user-123' })
  })

  it('T-009: throws UnauthenticatedError when ctx.currentUser is null', () => {
    const ctx = buildContext(null)

    expect(() => requireCurrentUser(ctx)).toThrow(UnauthenticatedError)
  })
})
