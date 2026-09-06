import 'reflect-metadata'
import { Arg, Ctx, Mutation, Resolver } from 'type-graphql'
import type { GraphQLContext } from '@/context/create-context'
import { InvalidCredentialsError } from '@/entities/auth.entity'
import { UserWithAuthRepository } from '@/repositories/user-with-auth.repository'
import { HashService } from '@/services/hash.service'
import { JwtService } from '@/services/jwt.service'
import { validateInput } from '@/shared/utils'
import { parseDurationToSeconds } from '@/shared/utils/parse-duration'
import {
  DUMMY_PASSWORD_HASH,
  ACCESS_TOKEN_COOKIE_NAME,
} from '@/utils/constants'
import { Environments } from '@/config/environments'
import { LoginInput } from '@/graphql/auth.types'
import { UserType, toUserType } from '@/graphql/user.types'

@Resolver()
export class AuthResolver {
  @Mutation(() => UserType)
  async login(
    @Arg('input') input: LoginInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<UserType> {
    const validated = await validateInput(LoginInput, input)

    const result = await UserWithAuthRepository.findUserWithAuthByEmail(
      validated.email,
    )
    const passwordHash = result?.auth.password ?? DUMMY_PASSWORD_HASH
    const isValid = await HashService.compare(validated.password, passwordHash)

    if (!result || !isValid) {
      throw new InvalidCredentialsError()
    }

    const token = JwtService.sign({ sub: result.user.id })
    ctx.cookies.set(ACCESS_TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: Environments.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: parseDurationToSeconds(Environments.jwtExpiry),
    })
    return toUserType(result.user)
  }

  @Mutation(() => Boolean)
  logout(@Ctx() ctx: GraphQLContext): boolean {
    ctx.cookies.set(ACCESS_TOKEN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: Environments.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: 0,
    })
    return true
  }
}
