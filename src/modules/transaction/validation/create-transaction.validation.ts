import { validateInput } from '@/shared/utils/validate-input'
import { CreateTransactionInput } from '../graphql/input-types/create-transaction.input'

export const CreateTransactionValidation = {
  async validate(
    input: CreateTransactionInput,
  ): Promise<CreateTransactionInput> {
    return validateInput(CreateTransactionInput, input)
  },
}
