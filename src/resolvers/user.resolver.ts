import 'reflect-metadata'
import { Arg, Mutation, Resolver } from 'type-graphql'
import { Prisma } from '@prisma/client'
import { User, UserAlreadyExistsError } from '@/entities/user.entity'
import { Auth } from '@/entities/auth.entity'
import { UserRepository } from '@/repositories/user.repository'
import { UserWithAuthRepository } from '@/repositories/user-with-auth.repository'
import { HashService } from '@/services/hash.service'
import { validateInput } from '@/shared/utils'
import { RegisterUserInput, UserType, toUserType } from '@/graphql/user.types'

@Resolver()
export class UserResolver {
  @Mutation(() => UserType)
  async registerUser(
    @Arg('input') input: RegisterUserInput,
  ): Promise<UserType> {
    const validated = await validateInput(RegisterUserInput, input)

    const exists = await UserRepository.existsByEmail(validated.email)
    if (exists) {
      throw new UserAlreadyExistsError()
    }

    const user = User.create({ email: validated.email, name: validated.name })
    const hashedPassword = await HashService.hash(validated.password)
    const auth = Auth.create({ userId: user.id, password: hashedPassword })

    try {
      await UserWithAuthRepository.createUserWithAuth({ user, auth })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UserAlreadyExistsError()
      }
      throw error
    }

    return toUserType(user)
  }
}
