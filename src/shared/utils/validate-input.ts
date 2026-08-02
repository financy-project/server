import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { ValidationError as OurValidationError } from '@/shared/errors'
import { I18nService } from '@/services/i18n.service'

export async function validateInput<T extends object>(
  InputClass: new () => T,
  data: unknown,
): Promise<T> {
  const instance = plainToInstance(InputClass, data)
  const violations = await validate(instance as object)

  if (violations.length > 0) {
    const errors = violations.map((violation) => ({
      path: violation.property,
      message: I18nService.translate(
        Object.values(violation.constraints ?? {})[0] ?? 'validations.failed',
      ),
    }))

    throw new OurValidationError('validations.failed', { errors })
  }

  return instance
}
