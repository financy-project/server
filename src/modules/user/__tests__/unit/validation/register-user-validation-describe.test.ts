import 'reflect-metadata'
import { RegisterUserValidation } from '../../../validation/register-user.validation'
import { ValidationError } from '@/shared/errors/validation-error'

describe('RegisterUserValidation.validate()', () => {
  const validInput = {
    email: 'test@example.com',
    name: 'Test User',
    password: 'Password1',
  }

  it('passes through valid input unchanged', async () => {
    const result = await RegisterUserValidation.validate(validInput as never)

    expect(result.email).toBe(validInput.email)
    expect(result.name).toBe(validInput.name)
    expect(result.password).toBe(validInput.password)
  })

  it('throws ValidationError for an invalid email', async () => {
    await expect(
      RegisterUserValidation.validate({
        ...validInput,
        email: 'not-an-email',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a password shorter than 8 characters', async () => {
    await expect(
      RegisterUserValidation.validate({
        ...validInput,
        password: 'Abc1',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a password missing an uppercase letter', async () => {
    await expect(
      RegisterUserValidation.validate({
        ...validInput,
        password: 'password1',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a password missing a number', async () => {
    await expect(
      RegisterUserValidation.validate({
        ...validInput,
        password: 'PasswordNoNumber',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an empty name', async () => {
    await expect(
      RegisterUserValidation.validate({
        ...validInput,
        name: '',
      } as never),
    ).rejects.toThrow(ValidationError)
  })
})
