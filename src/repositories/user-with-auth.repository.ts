import { prisma } from '@/lib/prisma'
import { User } from '@/entities/user.entity'
import { Auth } from '@/entities/auth.entity'

type UserWithAuth = {
  user: User
  auth: Auth
}

const createUserWithAuth = async (
  input: UserWithAuth,
): Promise<UserWithAuth> => {
  const [userRow, authRow] = await prisma.$transaction([
    prisma.user.create({
      data: {
        id: input.user.id,
        email: input.user.email,
        name: input.user.name,
      },
    }),
    prisma.auth.create({
      data: {
        id: input.auth.id,
        userId: input.auth.userId,
        password: input.auth.password,
      },
    }),
  ])

  return {
    user: User.fromRepository({
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
    }),
    auth: Auth.fromRepository({
      id: authRow.id,
      userId: authRow.userId,
      password: authRow.password,
    }),
  }
}

const findUserWithAuthByEmail = async (
  email: string,
): Promise<UserWithAuth | null> => {
  const row = await prisma.user.findUnique({
    where: { email },
    include: { auth: true },
  })

  if (!row || !row.auth) {
    return null
  }

  return {
    user: User.fromRepository({
      id: row.id,
      email: row.email,
      name: row.name,
    }),
    auth: Auth.fromRepository({
      id: row.auth.id,
      userId: row.auth.userId,
      password: row.auth.password,
    }),
  }
}

export const UserWithAuthRepository = {
  createUserWithAuth,
  findUserWithAuthByEmail,
}
