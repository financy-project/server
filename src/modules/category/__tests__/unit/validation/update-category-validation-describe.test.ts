import 'reflect-metadata'
import { UpdateCategoryValidation } from '../../../validation/update-category.validation'
import { ValidationError } from '@/shared/errors/validation-error'

describe('UpdateCategoryValidation.validate()', () => {
  it('passes with an empty patch (all fields omitted)', async () => {
    await expect(
      UpdateCategoryValidation.validate({} as never),
    ).resolves.toBeDefined()
  })

  it('passes through valid fields unchanged', async () => {
    const input = {
      title: 'Groceries',
      description: 'Weekly food shopping',
      icon: 'cart',
      color: '#FF00AA',
    }

    const result = await UpdateCategoryValidation.validate(input as never)

    expect(result.title).toBe(input.title)
    expect(result.description).toBe(input.description)
    expect(result.icon).toBe(input.icon)
    expect(result.color).toBe(input.color)
  })

  it('throws ValidationError for an empty title', async () => {
    await expect(
      UpdateCategoryValidation.validate({ title: '' } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a title longer than 100 characters', async () => {
    await expect(
      UpdateCategoryValidation.validate({
        title: 'a'.repeat(101),
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a description longer than 500 characters', async () => {
    await expect(
      UpdateCategoryValidation.validate({
        description: 'a'.repeat(501),
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an empty icon', async () => {
    await expect(
      UpdateCategoryValidation.validate({ icon: '' } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a color not matching #RRGGBB', async () => {
    await expect(
      UpdateCategoryValidation.validate({
        color: 'not-a-color',
      } as never),
    ).rejects.toThrow(ValidationError)
  })
})
