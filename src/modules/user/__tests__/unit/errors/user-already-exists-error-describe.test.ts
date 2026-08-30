import { DomainError } from '@/shared/errors/domain-error'
import { UserAlreadyExistsError } from '../../../errors/user-errors'

describe('UserAlreadyExistsError', () => {
  it('has code CONFLICT', () => {
    const error = new UserAlreadyExistsError()

    expect(error.code).toBe('CONFLICT')
  })

  it('is an instance of DomainError', () => {
    const error = new UserAlreadyExistsError()

    expect(error).toBeInstanceOf(DomainError)
  })

  it('uses the default i18n message key when no message is provided', () => {
    const error = new UserAlreadyExistsError()

    expect(error.message).toBe('errors.user_already_exists')
  })

  it('accepts a custom message', () => {
    const error = new UserAlreadyExistsError('custom message')

    expect(error.message).toBe('custom message')
  })

  it('has the correct name', () => {
    const error = new UserAlreadyExistsError()

    expect(error.name).toBe('UserAlreadyExistsError')
  })
})
