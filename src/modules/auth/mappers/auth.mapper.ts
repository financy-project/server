import type { User } from '@/modules/user/entity/user.entity'
import { UserType } from '@/modules/user/graphql/object-types/user.object-type'

export const toAuthenticatedUserType = (user: User): UserType => {
  const type = new UserType()
  type.id = user.id
  type.email = user.email
  type.name = user.name
  return type
}
