import { prisma } from '@/lib/prisma'
import { User } from '@/entities/user.entity'

export const UserRepository = {
  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { email } })
    return count > 0
  },

  async findById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } })
    if (!row) return null
    return User.fromRepository({ id: row.id, email: row.email, name: row.name })
  },
}
