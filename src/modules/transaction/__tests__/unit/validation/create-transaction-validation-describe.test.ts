import 'reflect-metadata'
import { CreateTransactionValidation } from '../../../validation/create-transaction.validation'
import { ValidationError } from '@/shared/errors/validation-error'
import { TransactionKind } from '../../../enums/transaction-kind.enum'

describe('CreateTransactionValidation.validate()', () => {
  const validInput = {
    type: TransactionKind.EXPENSE,
    description: 'Groceries',
    date: new Date('2026-01-15'),
    value: 1000,
    categoryId: '550e8400-e29b-41d4-a716-446655440000',
  }

  it('passes through valid input unchanged', async () => {
    const result = await CreateTransactionValidation.validate(
      validInput as never,
    )

    expect(result.type).toBe(validInput.type)
    expect(result.description).toBe(validInput.description)
    expect(result.date).toEqual(validInput.date)
    expect(result.value).toBe(validInput.value)
    expect(result.categoryId).toBe(validInput.categoryId)
  })

  it('throws ValidationError with path "type" for an invalid type', async () => {
    try {
      await CreateTransactionValidation.validate({
        ...validInput,
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

  it('throws ValidationError with path "description" for an empty description', async () => {
    try {
      await CreateTransactionValidation.validate({
        ...validInput,
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
      await CreateTransactionValidation.validate({
        ...validInput,
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
      await CreateTransactionValidation.validate({
        ...validInput,
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

  it('throws ValidationError with path "value" for a zero value', async () => {
    await expect(
      CreateTransactionValidation.validate({
        ...validInput,
        value: 0,
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError with path "value" for a negative value', async () => {
    await expect(
      CreateTransactionValidation.validate({
        ...validInput,
        value: -10,
      } as never),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError with path "categoryId" for a non-UUID categoryId', async () => {
    try {
      await CreateTransactionValidation.validate({
        ...validInput,
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
