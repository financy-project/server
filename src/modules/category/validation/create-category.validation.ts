import { validateInput } from '@/shared/utils/validate-input'
import { CreateCategoryInput } from '../graphql/input-types/create-category.input'

export const CreateCategoryValidation = {
  async validate(input: CreateCategoryInput): Promise<CreateCategoryInput> {
    return validateInput(CreateCategoryInput, input)
  },
}
