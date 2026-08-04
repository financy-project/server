import 'reflect-metadata'
import { Prisma } from '@prisma/client'
import { RegisterUserUseCase } from '../../../use-cases/register-user.use-case'
import { UserAlreadyExistsError } from '../../../errors/user-errors'
import { User } from '../../../entity/user.entity'

jest.mock('../../../repository/user.repository', () => ({
  UserRepository: {
    existsByEmail: jest.fn(),
  },
}))

jest.mock('@/shared/database/create-user-with-auth', () => ({
  CreateUserWithAuthRepository: {
    createUserWithAuth: jest.fn(),
  },
}))

jest.mock('@/services/hash.service', () => ({
  HashService: {
    hash: jest.fn().mockResolvedValue('hashed-password'),
  },
}))

import { UserRepository } from '../../../repository/user.repository'
import { CreateUserWithAuthRepository } from '@/shared/database/create-user-with-auth'

const validInput = {
  email: 'new@example.com',
  name: 'New User',
  password: 'Password1',
}

describe('RegisterUserUseCase.registerUser()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates and returns a User when the email does not exist', async () => {
    ;(UserRepository.existsByEmail as jest.Mock).mockResolvedValue(false)
    ;(
      CreateUserWithAuthRepository.createUserWithAuth as jest.Mock
    ).mockResolvedValue({})

    const result = await RegisterUserUseCase.registerUser(validInput as never)

    expect(result).toBeInstanceOf(User)
    expect(result.email).toBe('new@example.com')
    expect(result.name).toBe('New User')
    expect(
      CreateUserWithAuthRepository.createUserWithAuth,
    ).toHaveBeenCalledTimes(1)
  })

  it('throws UserAlreadyExistsError when existsByEmail returns true, without calling CreateUserWithAuthRepository', async () => {
    ;(UserRepository.existsByEmail as jest.Mock).mockResolvedValue(true)

    await expect(
      RegisterUserUseCase.registerUser(validInput as never),
    ).rejects.toThrow(UserAlreadyExistsError)

    expect(
      CreateUserWithAuthRepository.createUserWithAuth,
    ).not.toHaveBeenCalled()
  })

  it('throws UserAlreadyExistsError when the transaction rejects with a P2002 error', async () => {
    ;(UserRepository.existsByEmail as jest.Mock).mockResolvedValue(false)

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.0.0',
      },
    )
    ;(
      CreateUserWithAuthRepository.createUserWithAuth as jest.Mock
    ).mockRejectedValue(prismaError)

    await expect(
      RegisterUserUseCase.registerUser(validInput as never),
    ).rejects.toThrow(UserAlreadyExistsError)
  })

  it('rethrows unmodified any other transaction error', async () => {
    ;(UserRepository.existsByEmail as jest.Mock).mockResolvedValue(false)

    const unexpectedError = new Error('Database connection lost')
    ;(
      CreateUserWithAuthRepository.createUserWithAuth as jest.Mock
    ).mockRejectedValue(unexpectedError)

    await expect(
      RegisterUserUseCase.registerUser(validInput as never),
    ).rejects.toThrow('Database connection lost')
  })
})
