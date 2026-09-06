import DataLoader from 'dataloader'
import { TransactionRepository } from '@/repositories/transaction.repository'

export const buildTransactionsQuantityByCategoryIdLoader = (): DataLoader<
  string,
  number
> =>
  new DataLoader<string, number>(async (categoryIds) => {
    const uniqueIds = Array.from(new Set(categoryIds))
    const counts = await TransactionRepository.countByCategoryIds(uniqueIds)

    // DataLoader requires the output array to match the input keys 1:1, in order
    return categoryIds.map((id) => counts[id] ?? 0)
  })
