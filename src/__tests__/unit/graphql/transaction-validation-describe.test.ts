import 'reflect-metadata'
import { validateInput } from '@/shared/utils/validate-input'
import { ValidationError } from '@/shared/errors/validation-error'
import { TransactionKind } from '@/entities/transaction.entity'
import {
  TransactionIdArgs,
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsArgs,
  validateListTransactionsArgs,
} from '@/graphql/transaction.types'

const validateListArgs = async (
  args: Record<string, unknown>,
): Promise<ListTransactionsArgs> =>
  validateListTransactionsArgs(await validateInput(ListTransactionsArgs, args))

describe('TransactionIdArgs validation', () => {
  it('passes through a valid UUID', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'

    const result = await validateInput(TransactionIdArgs, { id })

    expect(result.id).toBe(id)
  })

  it('throws ValidationError with path "id" for a non-UUID id', async () => {
    try {
      await validateInput(TransactionIdArgs, { id: 'not-a-uuid' })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'id' }),
      ])
    }
  })
})

describe('CreateTransactionInput validation', () => {
  const validInput = {
    type: TransactionKind.EXPENSE,
    description: 'Groceries',
    date: new Date('2026-01-15'),
    value: 1000,
    categoryId: '550e8400-e29b-41d4-a716-446655440000',
  }

  it('passes through valid input unchanged', async () => {
    const result = await validateInput(CreateTransactionInput, validInput)

    expect(result.type).toBe(validInput.type)
    expect(result.description).toBe(validInput.description)
    expect(result.date).toEqual(validInput.date)
    expect(result.value).toBe(validInput.value)
    expect(result.categoryId).toBe(validInput.categoryId)
  })

  it('throws ValidationError with path "type" for an invalid type', async () => {
    try {
      await validateInput(CreateTransactionInput, {
        ...validInput,
        type: 'NOT_A_KIND',
      })
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
      await validateInput(CreateTransactionInput, {
        ...validInput,
        description: '',
      })
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
      await validateInput(CreateTransactionInput, {
        ...validInput,
        date: 'not-a-date',
      })
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
      await validateInput(CreateTransactionInput, {
        ...validInput,
        value: 10.5,
      })
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
      validateInput(CreateTransactionInput, { ...validInput, value: 0 }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError with path "value" for a negative value', async () => {
    await expect(
      validateInput(CreateTransactionInput, { ...validInput, value: -10 }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError with path "categoryId" for a non-UUID categoryId', async () => {
    try {
      await validateInput(CreateTransactionInput, {
        ...validInput,
        categoryId: 'not-a-uuid',
      })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'categoryId' }),
      ])
    }
  })
})

describe('UpdateTransactionInput validation', () => {
  it('passes through valid partial input unchanged', async () => {
    const result = await validateInput(UpdateTransactionInput, {
      description: 'Updated description',
    })

    expect(result.description).toBe('Updated description')
  })

  it('passes when all fields are omitted', async () => {
    await expect(
      validateInput(UpdateTransactionInput, {}),
    ).resolves.toBeDefined()
  })

  it('throws ValidationError with path "type" for an invalid type', async () => {
    try {
      await validateInput(UpdateTransactionInput, { type: 'NOT_A_KIND' })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'type' }),
      ])
    }
  })

  it('accepts a valid type', async () => {
    const result = await validateInput(UpdateTransactionInput, {
      type: TransactionKind.INCOME,
    })

    expect(result.type).toBe(TransactionKind.INCOME)
  })

  it('throws ValidationError with path "description" for an explicitly empty description', async () => {
    try {
      await validateInput(UpdateTransactionInput, { description: '' })
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
      await validateInput(UpdateTransactionInput, { date: 'not-a-date' })
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
      await validateInput(UpdateTransactionInput, { value: 10.5 })
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
      validateInput(UpdateTransactionInput, { value: 0 }),
    ).rejects.toThrow(ValidationError)
    await expect(
      validateInput(UpdateTransactionInput, { value: -5 }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError with path "categoryId" for a non-UUID categoryId', async () => {
    try {
      await validateInput(UpdateTransactionInput, { categoryId: 'not-a-uuid' })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'categoryId' }),
      ])
    }
  })
})

describe('ListTransactionsArgs / validateListTransactionsArgs', () => {
  it('passes when both startDate and endDate are provided', async () => {
    const result = await validateListArgs({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      first: 20,
    })

    expect(result.startDate).toEqual(new Date('2026-01-01'))
    expect(result.endDate).toEqual(new Date('2026-01-31'))
  })

  it('passes when neither startDate nor endDate are provided', async () => {
    await expect(validateListArgs({ first: 20 })).resolves.toBeDefined()
  })

  it('throws ValidationError with path "endDate" when only startDate is provided', async () => {
    try {
      await validateListArgs({ startDate: new Date('2026-01-01') })
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
      await validateListArgs({ endDate: new Date('2026-01-31') })
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
      await validateListArgs({
        startDate: new Date('2026-01-31'),
        endDate: new Date('2026-01-01'),
      })
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
      await validateListArgs({ first: 0 })
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
      await validateListArgs({ first: 51 })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'first' }),
      ])
    }
  })

  it('throws ValidationError with path "year" when month is given without year', async () => {
    try {
      await validateListArgs({ month: 1 })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'year' }),
      ])
    }
  })

  it('throws ValidationError with path "month" when year is given without month', async () => {
    try {
      await validateListArgs({ year: 2026 })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'month' }),
      ])
    }
  })

  it('throws ValidationError with path "month" when month+year are combined with startDate', async () => {
    try {
      await validateListArgs({
        month: 1,
        year: 2026,
        startDate: new Date('2026-01-01'),
      })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'month' }),
      ])
    }
  })

  it('throws ValidationError with path "month" when month+year are combined with endDate', async () => {
    try {
      await validateListArgs({
        month: 1,
        year: 2026,
        endDate: new Date('2026-01-31'),
      })
      throw new Error('expected validate() to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).metadata?.['errors']).toEqual([
        expect.objectContaining({ path: 'month' }),
      ])
    }
  })

  it('passes when month+year are provided alone (no date range)', async () => {
    const result = await validateListArgs({ month: 1, year: 2026 })

    expect(result.month).toBe(1)
    expect(result.year).toBe(2026)
  })
})
