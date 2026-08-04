import { User } from '../../../entity/user.entity'

describe('User.create()', () => {
  it('sets provided email and name', () => {
    const user = User.create({ email: 'test@example.com', name: 'Test User' })

    expect(user.email).toBe('test@example.com')
    expect(user.name).toBe('Test User')
  })

  it('generates a UUID id', () => {
    const user = User.create({ email: 'test@example.com', name: 'Test User' })

    expect(user.id).toBeDefined()
    expect(typeof user.id).toBe('string')
    expect(user.id.length).toBeGreaterThan(0)
  })

  it('generates a unique id per call', () => {
    const user1 = User.create({ email: 'a@example.com', name: 'A' })
    const user2 = User.create({ email: 'b@example.com', name: 'B' })

    expect(user1.id).not.toBe(user2.id)
  })

  it('fromRepository sets all provided props', () => {
    const props = {
      id: 'fixed-id-123',
      email: 'repo@example.com',
      name: 'Repo User',
    }

    const user = User.fromRepository(props)

    expect(user.id).toBe(props.id)
    expect(user.email).toBe(props.email)
    expect(user.name).toBe(props.name)
  })
})
