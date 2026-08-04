import { prisma } from '@/lib/prisma'
import { User } from '@/modules/user/entity/user.entity'
import { Auth } from '@/modules/auth/entity/auth.entity'

type FindUserWithAuthByEmailResult = {
  user: User
  auth: Auth
}

export const FindUserWithAuthByEmailRepository = {
  async findUserWithAuthByEmail(
    email: string,
  ): Promise<FindUserWithAuthByEmailResult | null> {
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
  },
}
