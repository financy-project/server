import { Prisma } from '@prisma/client'
import { User } from '../entity/user.entity'
import { Auth } from '@/modules/auth/entity/auth.entity'
import { UserAlreadyExistsError } from '../errors/user-errors'
import { UserRepository } from '../repository/user.repository'
import { CreateUserWithAuthRepository } from '@/shared/database/create-user-with-auth'
import { HashService } from '@/services/hash.service'
import type { RegisterUserInput } from '../graphql/input-types/register-user.input'

const registerUser = async (input: RegisterUserInput): Promise<User> => {
  const exists = await UserRepository.existsByEmail(input.email)
  if (exists) {
    throw new UserAlreadyExistsError()
  }

  const user = User.create({ email: input.email, name: input.name })
  const hashedPassword = await HashService.hash(input.password)
  const auth = Auth.create({ userId: user.id, password: hashedPassword })

  try {
    await CreateUserWithAuthRepository.createUserWithAuth({ user, auth })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new UserAlreadyExistsError()
    }
    throw error
  }

  return user
}

export const RegisterUserUseCase = {
  registerUser,
}
