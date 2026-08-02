import type { GraphQLFormattedError } from 'graphql'
import { unwrapResolverError } from '@apollo/server/errors'
import { DomainError, ValidationError } from '@/shared/errors'
import { I18nService } from '@/services/i18n.service'

export const formatError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  const original = unwrapResolverError(error)

  if (original instanceof ValidationError) {
    return {
      ...formattedError,
      message: I18nService.translate('validations.failed'),
      extensions: {
        code: original.code,
        validationErrors: original.metadata?.['errors'],
      },
    }
  }

  if (original instanceof DomainError) {
    return {
      ...formattedError,
      message: I18nService.translate(original.message),
      extensions: { code: original.code },
    }
  }

  // Unexpected error — log server-side, never leak internals to the client
  console.error('Unexpected error:', original)

  return {
    ...formattedError,
    message: I18nService.translate('errors.internal_server_error'),
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  }
}
