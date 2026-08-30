import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { generateUUID } from '@/shared/utils/uuid'
import { UserRepository } from '../../../repository/user.repository'

describe('UserRepository.existsByEmail()', () => {
  useDatabase()

  it('returns true when a user with that email exists', async () => {
    const email = `existing-${generateUUID()}@example.com`

    await prisma.user.create({
      data: {
        id: generateUUID(),
        email,
        name: 'Existing User',
      },
    })

    const result = await UserRepository.existsByEmail(email)

    expect(result).toBe(true)
  })

  it('returns false when no user has that email', async () => {
    const result = await UserRepository.existsByEmail('nonexistent@example.com')

    expect(result).toBe(false)
  })
})
