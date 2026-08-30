import { Auth } from '../../../entity/auth.entity'

describe('Auth.create()', () => {
  it('sets provided userId and password', () => {
    const auth = Auth.create({
      userId: 'user-123',
      password: 'hashed-password',
    })

    expect(auth.userId).toBe('user-123')
    expect(auth.password).toBe('hashed-password')
  })

  it('generates a UUID id', () => {
    const auth = Auth.create({
      userId: 'user-123',
      password: 'hashed-password',
    })

    expect(auth.id).toBeDefined()
    expect(typeof auth.id).toBe('string')
    expect(auth.id.length).toBeGreaterThan(0)
  })

  it('generates a unique id per call', () => {
    const auth1 = Auth.create({ userId: 'user-1', password: 'hash1' })
    const auth2 = Auth.create({ userId: 'user-2', password: 'hash2' })

    expect(auth1.id).not.toBe(auth2.id)
  })

  it('fromRepository sets all provided props', () => {
    const props = {
      id: 'fixed-id-456',
      userId: 'user-123',
      password: 'hashed-password',
    }

    const auth = Auth.fromRepository(props)

    expect(auth.id).toBe(props.id)
    expect(auth.userId).toBe(props.userId)
    expect(auth.password).toBe(props.password)
  })
})
