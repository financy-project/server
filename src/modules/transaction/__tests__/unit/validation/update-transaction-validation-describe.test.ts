import 'reflect-metadata'
import { UpdateTransactionValidation } from '../../../validation/update-transaction.validation'
import { ValidationError } from '@/shared/errors/validation-error'
import { TransactionKind } from '../../../enums/transaction-kind.enum'

describe('UpdateTransactionValidation.validate()', () => {
  it('passes through valid partial input unchanged', async () => {
    const result = await UpdateTransactionValidation.validate({
      description: 'Updated description',
    } as never)

    expect(result.description).toBe('Updated description')
  })

  it('passes when all fields are omitted', async () => {
    await expect(
      UpdateTransactionValidation.validate({} as never),
    ).resolves.toBeDefined()
  })

  it('throws ValidationError with path "type" for an invalid type', async () => {
    try {
      await UpdateTransactionValidation.validate({
        type: 'NOT_A_KIND',
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'type' }),
      ])
    }
  })

  it('accepts a valid type', async () => {
    const result = await UpdateTransactionValidation.validate({
      type: TransactionKind.INCOME,
    } as never)

    expect(result.type).toBe(TransactionKind.INCOME)
  })

  it('throws ValidationError with path "description" for an explicitly empty description', async () => {
    try {
      await UpdateTransactionValidation.validate({
        description: '',
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'description' }),
      ])
    }
  })

  it('throws ValidationError with path "date" for a non-date date', async () => {
    try {
      await UpdateTransactionValidation.validate({
        date: 'not-a-date',
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'date' }),
      ])
    }
  })

  it('throws ValidationError with path "value" for a non-integer value', async () => {
    try {
      await UpdateTransactionValidation.validate({
        value: 10.5,
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'value' }),
      ])
    }
  })

  it('throws ValidationError with path "value" for a zero or negative value', async () => {
    await expect(
      UpdateTransactionValidation.validate({ value: 0 } as never),
    ).rejects.toThrow(ValidationError)
    await expect(
      UpdateTransactionValidation.validate({ value: -5 } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError with path "categoryId" for a non-UUID categoryId', async () => {
    try {
      await UpdateTransactionValidation.validate({
        categoryId: 'not-a-uuid',
      } as never)
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'categoryId' }),
      ])
    }
  })
})
