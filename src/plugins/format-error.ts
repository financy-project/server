import { GraphQLError, type GraphQLFormattedError } from 'graphql'
import { unwrapResolverError } from '@apollo/server/errors'
import { DomainError, ValidationError } from '@/shared/errors'
import { I18nService } from '@/services/i18n.service'
import { parseGraphqlInputError } from '@/shared/utils/parse-graphql-input-error'

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

  // Parse/validation/variable-coercion errors come from graphql-js itself,
  // before any resolver runs. Their code (e.g. BAD_USER_INPUT for a missing
  // required field) is already client-safe, but their message echoes the
  // raw submitted value verbatim — including things like passwords — and
  // isn't translated, so the offending field is extracted instead of
  // passing the raw message through.
  if (original instanceof GraphQLError) {
    const code =
      typeof original.extensions?.['code'] === 'string'
        ? original.extensions['code']
        : 'BAD_USER_INPUT'
    const fieldError = parseGraphqlInputError(original.message)

    return {
      ...formattedError,
      message: I18nService.translate('validations.failed'),
      extensions: { code, validationErrors: [fieldError] },
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
