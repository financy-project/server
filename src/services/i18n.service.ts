type Locale = 'en' | 'pt-br'

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'errors.internal_server_error': 'An unexpected error occurred',
    'validations.failed': 'Validation failed',
  },
  'pt-br': {
    'errors.internal_server_error': 'Um erro inesperado ocorreu',
    'validations.failed': 'Validação falhou',
  },
}

export const I18nService = {
  translate(key: string, params?: Record<string, unknown>): string {
    const locale = (process.env['LOCALE'] || 'pt-br') as Locale
    let message = translations[locale]?.[key] || key

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        message = message.replace(`{{${k}}}`, String(v))
      })
    }

    return message
  },
}
