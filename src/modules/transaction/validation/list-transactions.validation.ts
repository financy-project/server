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
    const hasMonth = validated.month !== undefined
    const hasYear = validated.year !== undefined

    if (hasMonth !== hasYear) {
      throwFieldError(
        hasMonth ? 'year' : 'month',
        'validations.transaction_period_incomplete',
      )
    }

    if (hasMonth && hasYear && (hasStartDate || hasEndDate)) {
      throwFieldError(
        'month',
        'validations.transaction_period_conflicts_with_date_range',
      )
    }

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
