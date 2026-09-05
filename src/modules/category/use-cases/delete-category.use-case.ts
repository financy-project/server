import { Category } from '../entity/category.entity'
import { CategoryNotFoundError } from '../errors/category-errors'
import { CategoryRepository } from '../repository/category.repository'
import { reassignTransactionsCategory } from '../gateways/reassign-transactions-category.gateway'
import {
  DEFAULT_CATEGORY_TITLE,
  DEFAULT_CATEGORY_ICON,
  DEFAULT_CATEGORY_COLOR,
} from '@/utils/constants'

type DeleteCategoryInput = {
  id: string
  userId: string
}

const deleteCategory = async (input: DeleteCategoryInput): Promise<void> => {
  const { id, userId } = input
  const category = await CategoryRepository.findById(id)

  if (!category.belongsTo(userId)) {
    throw new CategoryNotFoundError()
  }

  // The default "Outros" category is the fallback itself — nothing to
  // reassign its own transactions into.
  if (category.title !== DEFAULT_CATEGORY_TITLE) {
    const defaultCategory = await CategoryRepository.upsertByUserIdAndTitle(
      Category.create({
        userId,
        title: DEFAULT_CATEGORY_TITLE,
        description: null,
        icon: DEFAULT_CATEGORY_ICON,
        color: DEFAULT_CATEGORY_COLOR,
      }),
    )

    await reassignTransactionsCategory({
      fromCategoryId: category.id,
      toCategoryId: defaultCategory.id,
    })
  }

  await CategoryRepository.remove(id)
}

export const DeleteCategoryUseCase = {
  deleteCategory,
}
