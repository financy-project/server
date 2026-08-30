import { validateInput } from '@/shared/utils/validate-input'
import { UpdateCategoryInput } from '../graphql/input-types/update-category.input'

export const UpdateCategoryValidation = {
  async validate(input: UpdateCategoryInput): Promise<UpdateCategoryInput> {
    return validateInput(UpdateCategoryInput, input)
  },
}
