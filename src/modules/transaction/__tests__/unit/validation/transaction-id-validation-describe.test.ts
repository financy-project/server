import 'reflect-metadata'
import { TransactionIdValidation } from '../../../validation/transaction-id.validation'
import { ValidationError } from '@/shared/errors/validation-error'

describe('TransactionIdValidation.validate()', () => {
  it('passes through a valid UUID', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'

    const result = await TransactionIdValidation.validate({ id } as never)

    expect(result.id).toBe(id)
  })

  it('throws ValidationError with path "id" for a non-UUID id', async () => {
    try {
      await TransactionIdValidation.validate({ id: 'not-a-uuid' } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'id' }),
      ])
    }
  })
})
