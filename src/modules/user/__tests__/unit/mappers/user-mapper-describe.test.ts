import 'reflect-metadata'
import { User } from '@/modules/user/entity/user.entity'
import { toUserType } from '@/modules/user/mappers/user.mapper'

describe('toUserType mapper', () => {
  it('maps id, email and name from the entity (T-016)', () => {
    const user = User.fromRepository({
      id: 'abc-123',
      email: 'john@example.com',
      name: 'John Doe',
    })

    const result = toUserType(user)

    expect(result.id).toBe('abc-123')
    expect(result.email).toBe('john@example.com')
    expect(result.name).toBe('John Doe')
  })

  it('does not expose a password or hash field (T-016)', () => {
    const user = User.fromRepository({
      id: 'abc-123',
      email: 'john@example.com',
      name: 'John Doe',
    })

    const result = toUserType(user)

    expect(result).not.toHaveProperty('password')
    expect(result).not.toHaveProperty('hash')
  })
})
