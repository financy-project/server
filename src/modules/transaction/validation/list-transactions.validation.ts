import { validateInput } from '@/shared/utils/validate-input'
import { ValidationError } from '@/shared/errors'
import { I18nService } from '@/services/i18n.service'
import { ListTransactionsArgs } from '../graphql/args/list-transactions.args'

const throwFieldError = (path: string, messageKey: string): never => {
  throw new ValidationError(messageKey, {
    errors: [{ path, message: I18nService.translate(messageKey) }],
  })
}

export const ListTransactionsValidation = {
  async validate(input: ListTransactionsArgs): Promise<ListTransactionsArgs> {
    const validated = await validateInput(ListTransactionsArgs, input)

    const hasStartDate = validated.startDate !== undefined
    const hasEndDate = validated.endDate !== undefined

    if (hasStartDate !== hasEndDate) {
      throwFieldError(
        hasStartDate ? 'endDate' : 'startDate',
        'validations.transaction_date_range_incomplete',
      )
    }

    if (
      hasStartDate &&
      hasEndDate &&
      validated.endDate! < validated.startDate!
    ) {
      throwFieldError('endDate', 'validations.transaction_date_range_invalid')
    }

    return validated
  },
}
