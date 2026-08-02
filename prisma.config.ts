import { defineConfig, env } from 'prisma/config'

// Prisma ORM 7 moved the connection URL out of schema.prisma's datasource
// block and into this file. The Prisma CLI loads this file for every
// command, so DATABASE_URL must already be present in the environment —
// every `prisma:*` script in package.json is wrapped with `dotenv -e
// .env.<env> --` for exactly this reason. See docs/architecture/09-configuration.md.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
