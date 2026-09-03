describe('Environments.allowedOrigins', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('T-004: parses to [] when ALLOWED_ORIGINS is unset', () => {
    delete process.env['ALLOWED_ORIGINS']

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Environments } = require('../../environments')

    expect(Environments.allowedOrigins).toEqual([])
  })

  it('T-004: parses a comma-separated value into a trimmed, non-empty array', () => {
    process.env['ALLOWED_ORIGINS'] = 'http://a.test, http://b.test ,'

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Environments } = require('../../environments')

    expect(Environments.allowedOrigins).toEqual([
      'http://a.test',
      'http://b.test',
    ])
  })
})
