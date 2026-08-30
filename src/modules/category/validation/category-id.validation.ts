import { validateInput } from '@/shared/utils/validate-input'
import { CategoryIdArgs } from '../graphql/args/category-id.args'

export const CategoryIdValidation = {
  async validate(input: CategoryIdArgs): Promise<CategoryIdArgs> {
    return validateInput(CategoryIdArgs, input)
  },
}
