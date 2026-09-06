import { generateUUID } from '@/shared/utils/uuid'
import { DomainError } from '@/shared/errors'

export class InvalidCredentialsError extends DomainError {
  constructor(message: string = 'errors.invalid_credentials') {
    super(message, 'UNAUTHENTICATED')
    this.name = 'InvalidCredentialsError'
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype)
  }
}

export type AuthProps = {
  id: string
  userId: string
  password: string
}

export type CreateAuthProps = Omit<AuthProps, 'id'>

export class Auth {
  readonly id: string
  readonly userId: string
  readonly password: string

  private constructor(props: AuthProps) {
    this.id = props.id
    this.userId = props.userId
    this.password = props.password
  }

  static create(props: CreateAuthProps): Auth {
    return new Auth({ id: generateUUID(), ...props })
  }

  static fromRepository(props: AuthProps): Auth {
    return new Auth(props)
  }
}
