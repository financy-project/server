import { validateInput } from '@/shared/utils/validate-input'
import { LoginInput } from '../graphql/input-types/login.input'

export const LoginValidation = {
  async validate(input: LoginInput): Promise<LoginInput> {
    return validateInput(LoginInput, input)
  },
}
