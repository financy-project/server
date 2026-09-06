import { generateUUID } from '@/shared/utils/uuid'
import { DomainError } from '@/shared/errors'

export class UserAlreadyExistsError extends DomainError {
  constructor(message: string = 'errors.user_already_exists') {
    super(message, 'CONFLICT')
    this.name = 'UserAlreadyExistsError'
    Object.setPrototypeOf(this, UserAlreadyExistsError.prototype)
  }
}

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
