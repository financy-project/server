import bcryptjs from 'bcryptjs'

export const HashService = {
  async hash(password: string): Promise<string> {
    return bcryptjs.hash(password, 10)
  },

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return bcryptjs.compare(password, hashedPassword)
  },
}
