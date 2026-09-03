import { validateInput } from '@/shared/utils/validate-input'
import { TransactionIdArgs } from '../graphql/args/transaction-id.args'

export const TransactionIdValidation = {
  async validate(input: TransactionIdArgs): Promise<TransactionIdArgs> {
    return validateInput(TransactionIdArgs, input)
  },
}
