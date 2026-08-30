import { I18nService } from '@/services/i18n.service'

export type GraphqlInputFieldError = {
  path: string
  message: string
}

const REQUIRED_FIELD_PATTERN = /Field "([^"]+)" of required type/
const PATH_PATTERN = /at "([^"]+)"/

/**
 * graphql-js embeds the offending path/field name in the error message text
 * (and, for coercion failures, the raw submitted value alongside it) rather
 * than exposing structured data. This extracts just the field name so a
 * client-safe, translated `{ path, message }` pair can be built without ever
 * repeating the raw message — which may contain sensitive submitted values.
 */
export const parseGraphqlInputError = (
  message: string,
): GraphqlInputFieldError => {
  const requiredMatch = message.match(REQUIRED_FIELD_PATTERN)
  if (requiredMatch?.[1]) {
    return {
      path: requiredMatch[1],
      message: I18nService.translate('validations.field_required'),
    }
  }

  const pathMatch = message.match(PATH_PATTERN)
  if (pathMatch?.[1]) {
    const segments = pathMatch[1].split('.')
    const field =
      segments.length > 1 ? segments.slice(1).join('.') : segments[0]

    return {
      path: field ?? pathMatch[1],
      message: I18nService.translate('validations.invalid_type'),
    }
  }

  return {
    path: 'input',
    message: I18nService.translate('validations.failed'),
  }
}
