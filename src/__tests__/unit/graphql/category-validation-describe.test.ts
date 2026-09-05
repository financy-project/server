import 'reflect-metadata'
import { validateInput } from '@/shared/utils/validate-input'
import { ValidationError } from '@/shared/errors/validation-error'
import {
  CategoryIdArgs,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/graphql/category.types'

describe('CategoryIdArgs validation', () => {
  it('passes through a valid UUID', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'

    const result = await validateInput(CategoryIdArgs, { id })

    expect(result.id).toBe(id)
  })

  it('throws ValidationError for a non-UUID id', async () => {
    await expect(
      validateInput(CategoryIdArgs, { id: 'not-a-uuid' }),
    ).rejects.toThrow(ValidationError)
  })
})

describe('CreateCategoryInput validation', () => {
  const validInput = {
    title: 'Groceries',
    description: 'Weekly food shopping',
    icon: 'cart',
    color: '#FF00AA',
  }

  it('passes through valid input unchanged', async () => {
    const result = await validateInput(CreateCategoryInput, validInput)

    expect(result.title).toBe(validInput.title)
    expect(result.description).toBe(validInput.description)
    expect(result.icon).toBe(validInput.icon)
    expect(result.color).toBe(validInput.color)
  })

  it('passes when description is omitted', async () => {
    const { title, icon, color } = validInput

    await expect(
      validateInput(CreateCategoryInput, { title, icon, color }),
    ).resolves.toBeDefined()
  })

  it('throws ValidationError for an empty title', async () => {
    await expect(
      validateInput(CreateCategoryInput, { ...validInput, title: '' }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a title longer than 100 characters', async () => {
    await expect(
      validateInput(CreateCategoryInput, {
        ...validInput,
        title: 'a'.repeat(101),
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a description longer than 500 characters', async () => {
    await expect(
      validateInput(CreateCategoryInput, {
        ...validInput,
        description: 'a'.repeat(501),
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an empty icon', async () => {
    await expect(
      validateInput(CreateCategoryInput, { ...validInput, icon: '' }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a color not matching #RRGGBB', async () => {
    await expect(
      validateInput(CreateCategoryInput, {
        ...validInput,
        color: 'not-a-color',
      }),
    ).rejects.toThrow(ValidationError)
  })
})

describe('UpdateCategoryInput validation', () => {
  it('passes with an empty patch (all fields omitted)', async () => {
    await expect(validateInput(UpdateCategoryInput, {})).resolves.toBeDefined()
  })

  it('passes through valid fields unchanged', async () => {
    const input = {
      title: 'Groceries',
      description: 'Weekly food shopping',
      icon: 'cart',
      color: '#FF00AA',
    }

    const result = await validateInput(UpdateCategoryInput, input)

    expect(result.title).toBe(input.title)
    expect(result.description).toBe(input.description)
    expect(result.icon).toBe(input.icon)
    expect(result.color).toBe(input.color)
  })

  it('throws ValidationError for an empty title', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { title: '' }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a title longer than 100 characters', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { title: 'a'.repeat(101) }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a description longer than 500 characters', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { description: 'a'.repeat(501) }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an empty icon', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { icon: '' }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for a color not matching #RRGGBB', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { color: 'not-a-color' }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an explicit null title (NOT NULL column)', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { title: null }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an explicit null icon (NOT NULL column)', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { icon: null }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an explicit null color (NOT NULL column)', async () => {
    await expect(
      validateInput(UpdateCategoryInput, { color: null }),
    ).rejects.toThrow(ValidationError)
  })

  it('accepts an explicit null description (nullable column)', async () => {
    const result = await validateInput(UpdateCategoryInput, {
      description: null,
    })

    expect(result.description).toBeNull()
  })
})
