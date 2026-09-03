type Locale = 'en' | 'pt-br'

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'errors.internal_server_error': 'An unexpected error occurred',
    'errors.user_already_exists': 'A user with this email already exists',
    'errors.invalid_credentials': 'Invalid email or password',
    'errors.category_not_found': 'Category not found',
    'errors.category_already_exists':
      'A category with this title already exists',
    'errors.unauthenticated': 'You must be authenticated to do this',
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
    'validations.category_title_required':
      'Title must be between 1 and 100 characters',
    'validations.category_description_max':
      'Description must be at most 500 characters',
    'validations.category_icon_required': 'Icon is required',
    'validations.category_color_format':
      'Color must be a valid hex code in #RRGGBB format',
    'validations.category_id_invalid': 'Id must be a valid UUID',
  },
  'pt-br': {
    'errors.internal_server_error': 'Um erro inesperado ocorreu',
    'errors.user_already_exists': 'Um usuário com este e-mail já existe',
    'errors.invalid_credentials': 'E-mail ou senha inválidos',
    'errors.category_not_found': 'Categoria não encontrada',
    'errors.category_already_exists': 'Já existe uma categoria com este título',
    'errors.unauthenticated': 'Você precisa estar autenticado para fazer isso',
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
    'validations.category_title_required':
      'O título deve ter entre 1 e 100 caracteres',
    'validations.category_description_max':
      'A descrição deve ter no máximo 500 caracteres',
    'validations.category_icon_required': 'O ícone é obrigatório',
    'validations.category_color_format':
      'A cor deve ser um código hexadecimal válido no formato #RRGGBB',
    'validations.category_id_invalid': 'O id deve ser um UUID válido',
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
