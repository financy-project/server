import { Arg, Mutation, Resolver } from 'type-graphql'
import { RegisterUserInput } from '../graphql/input-types/register-user.input'
import { RegisterUserValidation } from '../validation/register-user.validation'
import { RegisterUserUseCase } from '../use-cases/register-user.use-case'
import { toUserType } from '../mappers/user.mapper'
import { UserType } from '../graphql/object-types/user.object-type'

@Resolver()
export class UserResolver {
  @Mutation(() => UserType)
  async registerUser(
    @Arg('input') input: RegisterUserInput,
  ): Promise<UserType> {
    const validated = await RegisterUserValidation.validate(input)
    const user = await RegisterUserUseCase.registerUser(validated)
    return toUserType(user)
  }
}
