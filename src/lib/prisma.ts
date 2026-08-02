import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Environments } from '@/config/environments'

// Prisma ORM 7 requires a driver adapter for the client's runtime connection
// (the schema's datasource no longer carries a url). See
// docs/architecture/09-configuration.md and prisma.config.ts.
const adapter = new PrismaPg({ connectionString: Environments.databaseUrl })

export const prisma = new PrismaClient({ adapter })
