import { prisma } from '@/lib/prisma'
import { User } from '@/modules/user/entity/user.entity'
import { Auth } from '@/modules/auth/entity/auth.entity'

type CreateUserWithAuthInput = {
  user: User
  auth: Auth
}

type CreateUserWithAuthResult = {
  user: User
  auth: Auth
}

export const CreateUserWithAuthRepository = {
  async createUserWithAuth(
    input: CreateUserWithAuthInput,
  ): Promise<CreateUserWithAuthResult> {
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
  },
}
