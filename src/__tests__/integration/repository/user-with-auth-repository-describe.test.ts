import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { generateUUID } from '@/shared/utils/uuid'
import { User } from '@/entities/user.entity'
import { Auth } from '@/entities/auth.entity'
import { UserWithAuthRepository } from '@/repositories/user-with-auth.repository'

describe('UserWithAuthRepository (integration)', () => {
  useDatabase()

  describe('createUserWithAuth', () => {
    it('creates both a users row and an auth row atomically and returns both entities', async () => {
      const email = `atomic-${generateUUID()}@example.com`
      const user = User.create({
        email,
        name: 'Atomic User',
      })
      const auth = Auth.create({ userId: user.id, password: 'hashed-password' })

      const result = await UserWithAuthRepository.createUserWithAuth({
        user,
        auth,
      })

      expect(result.user.id).toBe(user.id)
      expect(result.user.email).toBe(email)
      expect(result.user.name).toBe('Atomic User')

      expect(result.auth.id).toBe(auth.id)
      expect(result.auth.userId).toBe(user.id)
      expect(result.auth.password).toBe('hashed-password')

      const userRow = await prisma.user.findUnique({ where: { id: user.id } })
      const authRow = await prisma.auth.findUnique({ where: { id: auth.id } })

      expect(userRow).not.toBeNull()
      expect(authRow).not.toBeNull()
    })

    it('rejects with a Prisma P2002 error when the email already exists, creating neither row', async () => {
      const email = `duplicate-${generateUUID()}@example.com`

      await prisma.user.create({
        data: {
          id: generateUUID(),
          email,
          name: 'Existing User',
        },
      })

      const user = User.create({
        email,
        name: 'Duplicate User',
      })
      const auth = Auth.create({ userId: user.id, password: 'hashed-password' })

      await expect(
        UserWithAuthRepository.createUserWithAuth({ user, auth }),
      ).rejects.toMatchObject({ code: 'P2002' })

      const authRow = await prisma.auth.findUnique({ where: { id: auth.id } })
      expect(authRow).toBeNull()
    })
  })

  describe('findUserWithAuthByEmail', () => {
    it('returns both the user and the auth row when found', async () => {
      const email = `found-${generateUUID()}@example.com`
      const user = User.create({ email, name: 'Found User' })
      const auth = Auth.create({ userId: user.id, password: 'hashed-password' })
      await UserWithAuthRepository.createUserWithAuth({ user, auth })

      const result = await UserWithAuthRepository.findUserWithAuthByEmail(email)

      expect(result?.user.id).toBe(user.id)
      expect(result?.user.email).toBe(email)
      expect(result?.auth.password).toBe('hashed-password')
    })

    it('returns null when no user has that email', async () => {
      const result =
        await UserWithAuthRepository.findUserWithAuthByEmail(
          'nobody@example.com',
        )

      expect(result).toBeNull()
    })
  })
})
