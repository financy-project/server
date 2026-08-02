import type { User } from '../entity/user.entity'
import { UserType } from '../graphql/object-types/user.object-type'

export const toUserType = (user: User): UserType => {
  const type = new UserType()
  type.id = user.id
  type.email = user.email
  type.name = user.name
  return type
}
