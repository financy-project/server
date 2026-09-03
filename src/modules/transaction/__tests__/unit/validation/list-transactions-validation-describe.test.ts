import 'reflect-metadata'
import { ListTransactionsValidation } from '../../../validation/list-transactions.validation'
import { ValidationError } from '@/shared/errors/validation-error'

describe('ListTransactionsValidation.validate()', () => {
  it('passes when both startDate and endDate are provided', async () => {
    const result = await ListTransactionsValidation.validate({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      first: 20,
    } as never)

    expect(result.startDate).toEqual(new Date('2026-01-01'))
    expect(result.endDate).toEqual(new Date('2026-01-31'))
  })

  it('passes when neither startDate nor endDate are provided', async () => {
    await expect(
      ListTransactionsValidation.validate({ first: 20 } as never),
    ).resolves.toBeDefined()
  })

  it('throws ValidationError with path "endDate" when only startDate is provided', async () => {
    try {
      await ListTransactionsValidation.validate({
        startDate: new Date('2026-01-01'),
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'endDate' }),
      ])
    }
  })

  it('throws ValidationError with path "startDate" when only endDate is provided', async () => {
    try {
      await ListTransactionsValidation.validate({
        endDate: new Date('2026-01-31'),
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'startDate' }),
      ])
    }
  })

  it('throws ValidationError with path "endDate" when endDate is before startDate', async () => {
    try {
      await ListTransactionsValidation.validate({
        startDate: new Date('2026-01-31'),
        endDate: new Date('2026-01-01'),
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'endDate' }),
      ])
    }
  })

  it('throws ValidationError with path "first" when first is below 1', async () => {
    try {
      await ListTransactionsValidation.validate({ first: 0 } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'first' }),
      ])
    }
  })

  it('throws ValidationError with path "first" when first is above 50', async () => {
    try {
      await ListTransactionsValidation.validate({ first: 51 } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'first' }),
      ])
    }
  })
})
