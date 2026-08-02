import { generateUUID } from '@/shared/utils/uuid'

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
