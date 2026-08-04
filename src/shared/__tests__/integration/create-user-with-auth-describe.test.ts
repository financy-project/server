import { prisma } from '@/lib/prisma'
import { useDatabase } from '@/test/helpers/db'
import { User } from '@/modules/user/entity/user.entity'
import { Auth } from '@/modules/auth/entity/auth.entity'
import { CreateUserWithAuthRepository } from '../../database/create-user-with-auth'

describe('CreateUserWithAuthRepository.createUserWithAuth()', () => {
  useDatabase()

  it('creates both a users row and an auth row atomically and returns both entities', async () => {
    const user = User.create({
      email: 'atomic@example.com',
      name: 'Atomic User',
    })
    const auth = Auth.create({ userId: user.id, password: 'hashed-password' })

    const result = await CreateUserWithAuthRepository.createUserWithAuth({
      user,
      auth,
    })

    expect(result.user.id).toBe(user.id)
    expect(result.user.email).toBe('atomic@example.com')
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
    await prisma.user.create({
      data: {
        id: 'existing-user-id',
        email: 'duplicate@example.com',
        name: 'Existing User',
      },
    })

    const user = User.create({
      email: 'duplicate@example.com',
      name: 'Duplicate User',
    })
    const auth = Auth.create({ userId: user.id, password: 'hashed-password' })

    await expect(
      CreateUserWithAuthRepository.createUserWithAuth({ user, auth }),
    ).rejects.toMatchObject({ code: 'P2002' })

    const authRow = await prisma.auth.findUnique({ where: { id: auth.id } })
    expect(authRow).toBeNull()
  })
})
