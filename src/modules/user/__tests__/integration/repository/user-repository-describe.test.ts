import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { UserRepository } from '../../../repository/user.repository'

describe('UserRepository.existsByEmail()', () => {
  useDatabase()

  it('returns true when a user with that email exists', async () => {
    await prisma.user.create({
      data: {
        id: 'test-id-001',
        email: 'existing@example.com',
        name: 'Existing User',
      },
    })

    const result = await UserRepository.existsByEmail('existing@example.com')

    expect(result).toBe(true)
  })

  it('returns false when no user has that email', async () => {
    const result = await UserRepository.existsByEmail('nonexistent@example.com')

    expect(result).toBe(false)
  })
})
