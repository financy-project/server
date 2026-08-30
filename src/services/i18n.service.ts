type Locale = 'en' | 'pt-br'

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'errors.internal_server_error': 'An unexpected error occurred',
    'errors.user_already_exists': 'A user with this email already exists',
    'errors.invalid_credentials': 'Invalid email or password',
    'validations.failed': 'Validation failed',
    'validations.field_required': 'This field is required',
    'validations.invalid_type': 'Invalid value for this field',
    'validations.email': 'Must be a valid email address',
    'validations.name_required': 'Name must be between 1 and 255 characters',
    'validations.password_min': 'Password must be at least 8 characters',
    'validations.password_uppercase':
      'Password must contain at least one uppercase letter',
    'validations.password_number': 'Password must contain at least one number',
    'validations.password_required': 'Password is required',
  },
  'pt-br': {
    'errors.internal_server_error': 'Um erro inesperado ocorreu',
    'errors.user_already_exists': 'Um usuário com este e-mail já existe',
    'errors.invalid_credentials': 'E-mail ou senha inválidos',
    'validations.failed': 'Validação falhou',
    'validations.field_required': 'Este campo é obrigatório',
    'validations.invalid_type': 'Valor inválido para este campo',
    'validations.email': 'Deve ser um endereço de e-mail válido',
    'validations.name_required': 'O nome deve ter entre 1 e 255 caracteres',
    'validations.password_min': 'A senha deve ter pelo menos 8 caracteres',
    'validations.password_uppercase':
      'A senha deve conter pelo menos uma letra maiúscula',
    'validations.password_number': 'A senha deve conter pelo menos um número',
    'validations.password_required': 'A senha é obrigatória',
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
