import 'reflect-metadata'
import { validateInput } from '@/shared/utils/validate-input'
import { ValidationError } from '@/shared/errors/validation-error'
import { RegisterUserInput } from '@/graphql/user.types'

describe('RegisterUserInput validation', () => {
  const validInput = {
    email: 'test@example.com',
    name: 'Test User',
    password: 'Password1',
  }

  it('passes through valid input unchanged', async () => {
    const result = await validateInput(RegisterUserInput, validInput)

    expect(result.email).toBe(validInput.email)
    expect(result.name).toBe(validInput.name)
    expect(result.password).toBe(validInput.password)
  })

  it('throws ValidationError for an invalid email', async () => {
    await expect(
      validateInput(RegisterUserInput, {
        ...validInput,
        email: 'not-an-email',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a password shorter than 8 characters', async () => {
    await expect(
      validateInput(RegisterUserInput, { ...validInput, password: 'Abc1' }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a password missing an uppercase letter', async () => {
    await expect(
      validateInput(RegisterUserInput, {
        ...validInput,
        password: 'password1',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a password missing a number', async () => {
    await expect(
      validateInput(RegisterUserInput, {
        ...validInput,
        password: 'PasswordNoNumber',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an empty name', async () => {
    await expect(
      validateInput(RegisterUserInput, { ...validInput, name: '' }),
    ).rejects.toThrow(ValidationError)
  })
})
