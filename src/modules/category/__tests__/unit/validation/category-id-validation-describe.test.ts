import 'reflect-metadata'
import { CategoryIdValidation } from '../../../validation/category-id.validation'
import { ValidationError } from '@/shared/errors/validation-error'

describe('CategoryIdValidation.validate()', () => {
  it('passes through a valid UUID', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'

    const result = await CategoryIdValidation.validate({ id } as never)

    expect(result.id).toBe(id)
  })

  it('throws ValidationError for a non-UUID id', async () => {
    await expect(
      CategoryIdValidation.validate({ id: 'not-a-uuid' } as never),
    ).rejects.toThrow(ValidationError)
  })
})
