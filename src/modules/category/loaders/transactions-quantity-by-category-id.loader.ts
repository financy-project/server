import DataLoader from 'dataloader'
import { countTransactionsByCategoryIds } from '../gateways/count-transactions-by-category-ids.gateway'

export const buildTransactionsQuantityByCategoryIdLoader = (): DataLoader<
  string,
  number
> =>
  new DataLoader<string, number>(async (categoryIds) => {
    const counts = await countTransactionsByCategoryIds([...categoryIds])

    // DataLoader requires the output array to match the input keys 1:1, in order
    return categoryIds.map((id) => counts[id] ?? 0)
  })
