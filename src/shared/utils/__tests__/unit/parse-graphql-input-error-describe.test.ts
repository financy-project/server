import { parseGraphqlInputError } from '../../parse-graphql-input-error'

describe('parseGraphqlInputError', () => {
  it('extracts the field name from a missing-required-field message', () => {
    const message =
      'Variable "$input" got invalid value { email: "a@a.com", password: "secret123" }; Field "name" of required type "String!" was not provided.'

    const result = parseGraphqlInputError(message)

    expect(result.path).toBe('name')
    expect(result.message).not.toContain('secret123')
  })

  it('extracts the nested field name from a type-mismatch message with a path', () => {
    const message =
      'Variable "$input" got invalid value 123 at "input.password"; String cannot represent a non string value: 123'

    const result = parseGraphqlInputError(message)

    expect(result.path).toBe('password')
    expect(result.message).not.toContain('123')
  })

  it('falls back to a generic "input" field when no field can be extracted', () => {
    const message = 'Unknown type "Foo".'

    const result = parseGraphqlInputError(message)

    expect(result.path).toBe('input')
  })
})
