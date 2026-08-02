import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(['DEVELOPMENT', 'TEST', 'PRODUCTION']))
    .default('DEVELOPMENT'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('7d'),

  GRAPHQL_COMPLEXITY_LIMIT: z.coerce.number().default(1000),
  GRAPHQL_DEPTH_LIMIT: z.coerce.number().default(10),

  LOCALE: z.enum(['en', 'pt-br']).default('pt-br'),
})

type Environment = z.infer<typeof environmentSchema>

const env: Environment = environmentSchema.parse({
  NODE_ENV: process.env['NODE_ENV'],
  PORT: process.env['PORT'],
  DATABASE_URL: process.env['DATABASE_URL'],
  JWT_SECRET: process.env['JWT_SECRET'],
  JWT_EXPIRY: process.env['JWT_EXPIRY'],
  GRAPHQL_COMPLEXITY_LIMIT: process.env['GRAPHQL_COMPLEXITY_LIMIT'],
  GRAPHQL_DEPTH_LIMIT: process.env['GRAPHQL_DEPTH_LIMIT'],
  LOCALE: process.env['LOCALE'],
})

export const Environments = {
  get isDevelopment(): boolean {
    return env.NODE_ENV === 'DEVELOPMENT'
  },
  get isProduction(): boolean {
    return env.NODE_ENV === 'PRODUCTION'
  },
  get isTest(): boolean {
    return env.NODE_ENV === 'TEST'
  },
  get port(): number {
    return env.PORT
  },
  get databaseUrl(): string {
    return env.DATABASE_URL
  },
  get jwtSecret(): string {
    return env.JWT_SECRET
  },
  get jwtExpiry(): string {
    return env.JWT_EXPIRY
  },
  get graphqlComplexityLimit(): number {
    return env.GRAPHQL_COMPLEXITY_LIMIT
  },
  get graphqlDepthLimit(): number {
    return env.GRAPHQL_DEPTH_LIMIT
  },
  get locale(): string {
    return env.LOCALE
  },
}
