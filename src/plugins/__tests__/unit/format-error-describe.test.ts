import { GraphQLError, type GraphQLFormattedError } from 'graphql'
import { formatError } from '../../format-error'
import { DomainError } from '@/shared/errors/domain-error'
import { ValidationError } from '@/shared/errors/validation-error'

const baseFormattedError: GraphQLFormattedError = {
  message: 'original message',
  locations: [{ line: 1, column: 1 }],
}

describe('formatError', () => {
  it('maps a ValidationError to BAD_USER_INPUT with field-level details', () => {
    const error = new ValidationError('validations.failed', {
      errors: [{ path: 'password', message: 'too short' }],
    })

    const result = formatError(baseFormattedError, error)

    expect(result.extensions?.['code']).toBe('BAD_USER_INPUT')
    expect(result.extensions?.['validationErrors']).toEqual([
      { path: 'password', message: 'too short' },
    ])
  })

  it('maps a DomainError to its own code and translated message', () => {
    const error = new DomainError(
      'errors.invalid_credentials',
      'UNAUTHENTICATED',
    )

    const result = formatError(baseFormattedError, error)

    expect(result.extensions?.['code']).toBe('UNAUTHENTICATED')
  })

  it('sanitizes a native GraphQLError (e.g. missing required variable), reporting which field failed without echoing the raw submitted value', () => {
    const error = new GraphQLError(
      'Variable "$input" got invalid value { email: "a@a.com", password: "secret123" }; Field "name" of required type "String!" was not provided.',
      { extensions: { code: 'BAD_USER_INPUT' } },
    )
    const formatted: GraphQLFormattedError = {
      message: error.message,
      extensions: { code: 'BAD_USER_INPUT' },
    }

    const result = formatError(formatted, error)

    expect(result.message).not.toContain('secret123')
    expect(result.extensions?.['code']).toBe('BAD_USER_INPUT')
    expect(result.extensions?.['validationErrors']).toEqual([
      { path: 'name', message: expect.any(String) },
    ])
  })

  it('masks an unexpected non-domain error as INTERNAL_SERVER_ERROR', () => {
    const error = new Error('unexpected failure')
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const result = formatError(baseFormattedError, error)

    expect(result.extensions?.['code']).toBe('INTERNAL_SERVER_ERROR')
    expect(result.message).not.toBe('unexpected failure')
    consoleErrorSpy.mockRestore()
  })
})
