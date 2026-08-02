import { validateInput } from '@/shared/utils/validate-input'
import { RegisterUserInput } from '../graphql/input-types/register-user.input'

export const RegisterUserValidation = {
  async validate(input: RegisterUserInput): Promise<RegisterUserInput> {
    return validateInput(RegisterUserInput, input)
  },
}
