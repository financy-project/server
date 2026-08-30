import { generateUUID } from '@/shared/utils/uuid'

export type UserProps = {
  id: string
  email: string
  name: string
}

export type CreateUserProps = Omit<UserProps, 'id'>

export class User {
  readonly id: string
  readonly email: string
  readonly name: string

  private constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.name = props.name
  }

  static create(props: CreateUserProps): User {
    return new User({ id: generateUUID(), ...props })
  }

  static fromRepository(props: UserProps): User {
    return new User(props)
  }
}
