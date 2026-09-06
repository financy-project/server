import { generateUUID } from '@/shared/utils/uuid'
import { DomainError } from '@/shared/errors'

export class CategoryNotFoundError extends DomainError {
  constructor(message: string = 'errors.category_not_found') {
    super(message, 'NOT_FOUND')
    this.name = 'CategoryNotFoundError'
    Object.setPrototypeOf(this, CategoryNotFoundError.prototype)
  }
}

export class CategoryAlreadyExistsError extends DomainError {
  constructor(message: string = 'errors.category_already_exists') {
    super(message, 'CONFLICT')
    this.name = 'CategoryAlreadyExistsError'
    Object.setPrototypeOf(this, CategoryAlreadyExistsError.prototype)
  }
}

export class CannotDeleteDefaultCategoryError extends DomainError {
  constructor(message: string = 'errors.category_cannot_delete_default') {
    super(message, 'CONFLICT')
    this.name = 'CannotDeleteDefaultCategoryError'
    Object.setPrototypeOf(this, CannotDeleteDefaultCategoryError.prototype)
  }
}

export type CategoryProps = {
  id: string
  userId: string
  title: string
  description: string | null
  icon: string
  color: string
}

export type CreateCategoryProps = Omit<CategoryProps, 'id'>

export type UpdateCategoryPatch = Partial<
  Pick<CategoryProps, 'title' | 'description' | 'icon' | 'color'>
>

export class Category {
  readonly id: string
  readonly userId: string
  readonly title: string
  readonly description: string | null
  readonly icon: string
  readonly color: string

  private constructor(props: CategoryProps) {
    this.id = props.id
    this.userId = props.userId
    this.title = props.title
    this.description = props.description
    this.icon = props.icon
    this.color = props.color
  }

  static create(props: CreateCategoryProps): Category {
    return new Category({ id: generateUUID(), ...props })
  }

  static fromRepository(props: CategoryProps): Category {
    return new Category(props)
  }

  belongsTo(userId: string): boolean {
    return this.userId === userId
  }
}
