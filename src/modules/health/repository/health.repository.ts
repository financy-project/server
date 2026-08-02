import { prisma } from '@/lib/prisma'

const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

export const HealthRepository = {
  checkDatabaseConnection,
}
