import 'reflect-metadata'
import type { IncomingMessage, ServerResponse } from 'http'

jest.mock('@/services/jwt.service', () => ({
  JwtService: {
    verify: jest.fn(),
  },
}))

import { JwtService } from '@/services/jwt.service'
import { createContext } from '../../create-context'

const makeReq = (cookieHeader?: string): IncomingMessage =>
  ({ headers: { cookie: cookieHeader } }) as unknown as IncomingMessage

const makeRes = (): ServerResponse =>
  ({ setHeader: jest.fn() }) as unknown as ServerResponse

describe('createContext()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-015: no cookie header → currentUser: null', async () => {
    ;(JwtService.verify as jest.Mock).mockReturnValue(null)

    const ctx = await createContext({ req: makeReq(), res: makeRes() })

    expect(ctx.currentUser).toBeNull()
  })

  it('T-016: valid access_token cookie → currentUser: { id }', async () => {
    ;(JwtService.verify as jest.Mock).mockReturnValue({ sub: 'user-123' })

    const ctx = await createContext({
      req: makeReq('access_token=valid-token'),
      res: makeRes(),
    })

    expect(ctx.currentUser).toEqual({ id: 'user-123' })
    expect(JwtService.verify).toHaveBeenCalledWith('valid-token')
  })

  it('T-017: invalid/expired access_token → currentUser: null', async () => {
    ;(JwtService.verify as jest.Mock).mockReturnValue(null)

    const ctx = await createContext({
      req: makeReq('access_token=bad-token'),
      res: makeRes(),
    })

    expect(ctx.currentUser).toBeNull()
  })
})
