import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { FindUserWithAuthByEmailRepository } from '../../find-user-with-auth-by-email'

describe('FindUserWithAuthByEmailRepository.findUserWithAuthByEmail()', () => {
  useDatabase()

  it('returns { user, auth } when a user and auth row exist for the given email', async () => {
    await prisma.user.create({
      data: {
        id: 'user-find-test-1',
        email: 'find@example.com',
        name: 'Find User',
        auth: {
          create: {
            id: 'auth-find-test-1',
            password: 'hashed-password-value',
          },
        },
      },
    })

    const result =
      await FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(
        'find@example.com',
      )

    expect(result).not.toBeNull()
    expect(result?.user.email).toBe('find@example.com')
    expect(result?.user.name).toBe('Find User')
    expect(result?.user.id).toBe('user-find-test-1')
    expect(result?.auth.userId).toBe('user-find-test-1')
    expect(result?.auth.password).toBe('hashed-password-value')
  })

  it('returns null when no user matches the given email', async () => {
    const result =
      await FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(
        'nonexistent@example.com',
      )

    expect(result).toBeNull()
  })
})
