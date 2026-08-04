import 'reflect-metadata'
import { InvalidCredentialsError } from '../../../errors/auth-errors'
import { User } from '@/modules/user/entity/user.entity'

jest.mock('@/shared/database/find-user-with-auth-by-email', () => ({
  FindUserWithAuthByEmailRepository: {
    findUserWithAuthByEmail: jest.fn(),
  },
}))

jest.mock('@/services/hash.service', () => ({
  HashService: {
    compare: jest.fn(),
  },
}))

jest.mock('@/services/jwt.service', () => ({
  JwtService: {
    sign: jest.fn().mockReturnValue('signed-token'),
  },
}))

import { FindUserWithAuthByEmailRepository } from '@/shared/database/find-user-with-auth-by-email'
import { HashService } from '@/services/hash.service'
import { JwtService } from '@/services/jwt.service'
import { LoginUseCase } from '../../../use-cases/login.use-case'

const validInput = {
  email: 'user@example.com',
  password: 'correctpassword',
}

const mockUser = User.fromRepository({
  id: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
})

const mockAuth = { id: 'auth-1', userId: 'user-123', password: 'hashed-pw' }

describe('LoginUseCase.login()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('T-012: unknown email → throws InvalidCredentialsError and still calls HashService.compare', async () => {
    ;(
      FindUserWithAuthByEmailRepository.findUserWithAuthByEmail as jest.Mock
    ).mockResolvedValue(null)
    ;(HashService.compare as jest.Mock).mockResolvedValue(false)

    await expect(LoginUseCase.login(validInput)).rejects.toThrow(
      InvalidCredentialsError,
    )

    expect(HashService.compare).toHaveBeenCalledTimes(1)
  })

  it('T-013: known email + wrong password → throws InvalidCredentialsError', async () => {
    ;(
      FindUserWithAuthByEmailRepository.findUserWithAuthByEmail as jest.Mock
    ).mockResolvedValue({ user: mockUser, auth: mockAuth })
    ;(HashService.compare as jest.Mock).mockResolvedValue(false)

    await expect(LoginUseCase.login(validInput)).rejects.toThrow(
      InvalidCredentialsError,
    )
  })

  it('T-014: known email + correct password → returns { user, token } and calls JwtService.sign with { sub: user.id }', async () => {
    ;(
      FindUserWithAuthByEmailRepository.findUserWithAuthByEmail as jest.Mock
    ).mockResolvedValue({ user: mockUser, auth: mockAuth })
    ;(HashService.compare as jest.Mock).mockResolvedValue(true)

    const result = await LoginUseCase.login(validInput)

    expect(result.user).toBe(mockUser)
    expect(result.token).toBe('signed-token')
    expect(JwtService.sign).toHaveBeenCalledWith({ sub: mockUser.id })
  })
})
