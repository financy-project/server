import 'reflect-metadata'
import { Arg, Ctx, Mutation, Resolver } from 'type-graphql'
import { LoginInput } from '../graphql/input-types/login.input'
import { LoginValidation } from '../validation/login.validation'
import { LoginUseCase } from '../use-cases/login.use-case'
import { toAuthenticatedUserType } from '../mappers/auth.mapper'
import { UserType } from '@/modules/user/graphql/object-types/user.object-type'
import type { GraphQLContext } from '@/context/create-context'
import { ACCESS_TOKEN_COOKIE_NAME } from '@/utils/constants'
import { Environments } from '@/config/environments'
import { parseDurationToSeconds } from '@/shared/utils/parse-duration'

@Resolver()
export class AuthResolver {
  @Mutation(() => UserType)
  async login(
    @Arg('input') input: LoginInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<UserType> {
    const validated = await LoginValidation.validate(input)
    const { user, token } = await LoginUseCase.login(validated)
    ctx.cookies.set(ACCESS_TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: Environments.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: parseDurationToSeconds(Environments.jwtExpiry),
    })
    return toAuthenticatedUserType(user)
  }
}
