import { FindUserWithAuthByEmailRepository } from '@/shared/database/find-user-with-auth-by-email'
import { HashService } from '@/services/hash.service'
import { JwtService } from '@/services/jwt.service'
import { DUMMY_PASSWORD_HASH } from '@/utils/constants'
import { InvalidCredentialsError } from '../errors/auth-errors'
import type { User } from '@/modules/user/entity/user.entity'

type LoginInput = {
  email: string
  password: string
}

type LoginResult = {
  user: User
  token: string
}

export const LoginUseCase = {
  async login(input: LoginInput): Promise<LoginResult> {
    const result =
      await FindUserWithAuthByEmailRepository.findUserWithAuthByEmail(
        input.email,
      )

    const passwordHash = result?.auth.password ?? DUMMY_PASSWORD_HASH
    const isValid = await HashService.compare(input.password, passwordHash)

    if (!result || !isValid) {
      throw new InvalidCredentialsError()
    }

    const token = JwtService.sign({ sub: result.user.id })

    return { user: result.user, token }
  },
}
