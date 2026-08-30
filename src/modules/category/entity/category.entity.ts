import { generateUUID } from '@/shared/utils/uuid'

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
