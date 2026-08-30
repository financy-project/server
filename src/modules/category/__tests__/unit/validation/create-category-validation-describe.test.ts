import 'reflect-metadata'
import { CreateCategoryValidation } from '../../../validation/create-category.validation'
import { ValidationError } from '@/shared/errors/validation-error'

describe('CreateCategoryValidation.validate()', () => {
  const validInput = {
    title: 'Groceries',
    description: 'Weekly food shopping',
    icon: 'cart',
    color: '#FF00AA',
  }

  it('passes through valid input unchanged', async () => {
    const result = await CreateCategoryValidation.validate(validInput as never)

    expect(result.title).toBe(validInput.title)
    expect(result.description).toBe(validInput.description)
    expect(result.icon).toBe(validInput.icon)
    expect(result.color).toBe(validInput.color)
  })

  it('passes when description is omitted', async () => {
    const { title, icon, color } = validInput

    await expect(
      CreateCategoryValidation.validate({ title, icon, color } as never),
    ).resolves.toBeDefined()
  })

  it('throws ValidationError for an empty title', async () => {
    await expect(
      CreateCategoryValidation.validate({
        ...validInput,
        title: '',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a title longer than 100 characters', async () => {
    await expect(
      CreateCategoryValidation.validate({
        ...validInput,
        title: 'a'.repeat(101),
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a description longer than 500 characters', async () => {
    await expect(
      CreateCategoryValidation.validate({
        ...validInput,
        description: 'a'.repeat(501),
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an empty icon', async () => {
    await expect(
      CreateCategoryValidation.validate({
        ...validInput,
        icon: '',
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a color not matching #RRGGBB', async () => {
    await expect(
      CreateCategoryValidation.validate({
        ...validInput,
        color: 'not-a-color',
      } as never),
    ).rejects.toThrow(ValidationError)
  })
})
