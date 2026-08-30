import 'reflect-metadata'
import { LoginValidation } from '../../../validation/login.validation'
import { ValidationError } from '@/shared/errors/validation-error'

describe('LoginValidation.validate()', () => {
  const validInput = {
    email: 'test@example.com',
    password: 'anypassword',
  }

  it('T-009: passes through valid email and non-empty password unchanged', async () => {
    const result = await LoginValidation.validate(validInput as never)

    expect(result.email).toBe(validInput.email)
    expect(result.password).toBe(validInput.password)
  })

  it('T-010: throws ValidationError for an invalid email format', async () => {
    await expect(
      LoginValidation.validate({
        ...validInput,
        email: 'not-an-email',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('T-011: throws ValidationError for an empty password', async () => {
    await expect(
      LoginValidation.validate({
        ...validInput,
        password: '',
      } as never),
    ).rejects.toThrow(ValidationError)
  })
})
