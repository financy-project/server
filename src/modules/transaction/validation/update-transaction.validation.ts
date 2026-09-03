import { validateInput } from '@/shared/utils/validate-input'
import { UpdateTransactionInput } from '../graphql/input-types/update-transaction.input'

export const UpdateTransactionValidation = {
  async validate(
    input: UpdateTransactionInput,
  ): Promise<UpdateTransactionInput> {
    return validateInput(UpdateTransactionInput, input)
  },
}
