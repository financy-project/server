import 'reflect-metadata'
import { validateInput } from '@/shared/utils/validate-input'
import { ValidationError } from '@/shared/errors/validation-error'
import { LoginInput } from '@/graphql/auth.types'

describe('LoginInput validation', () => {
  const validInput = {
    email: 'test@example.com',
    password: 'anypassword',
  }

  it('T-009: passes through valid email and non-empty password unchanged', async () => {
    const result = await validateInput(LoginInput, validInput)

    expect(result.email).toBe(validInput.email)
    expect(result.password).toBe(validInput.password)
  })

  it('T-010: throws ValidationError for an invalid email format', async () => {
    await expect(
      validateInput(LoginInput, { ...validInput, email: 'not-an-email' }),
    ).rejects.toThrow(ValidationError)
  })

  it('T-011: throws ValidationError for an empty password', async () => {
    await expect(
      validateInput(LoginInput, { ...validInput, password: '' }),
    ).rejects.toThrow(ValidationError)
  })
})
