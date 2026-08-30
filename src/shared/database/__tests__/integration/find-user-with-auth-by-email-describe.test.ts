import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { generateUUID } from '@/shared/utils/uuid'
import { FindUserWithAuthByEmailRepository } from '../../find-user-with-auth-by-email'

describe('FindUserWithAuthByEmailRepository.findUserWithAuthByEmail()', () => {
  useDatabase()

  it('returns { user, auth } when a user and auth row exist for the given email', async () => {
    const userId = generateUUID()
    const email = `find-${generateUUID()}@example.com`

    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'Find User',
        auth: {
          create: {
            id: generateUUID(),
            password: 'hashed-password-value',
          },
        },
      },
    })

    const result =
      await FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(email)

    expect(result).not.toBeNull()
    expect(result?.user.email).toBe(email)
    expect(result?.user.name).toBe('Find User')
    expect(result?.user.id).toBe(userId)
    expect(result?.auth.userId).toBe(userId)
    expect(result?.auth.password).toBe('hashed-password-value')
  })

  it('returns null when no user matches the given email', async () => {
    const result =
      await FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(
        `nonexistent-${generateUUID()}@example.com`,
      )

    expect(result).toBeNull()
  })
})
