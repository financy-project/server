import 'reflect-metadata'
import { buildApolloServer, buildExpressApp } from './app'
import { Environments } from '@/config/environments'
import { listenersRegistrator } from '@/utils/listenersRegistrator'

const main = async (): Promise<void> => {
  listenersRegistrator()

  const server = await buildApolloServer()
  const app = await buildExpressApp(server, Environments.allowedOrigins)

  app.listen(Environments.port, () => {
    console.log(
      `🚀 Server ready at http://localhost:${Environments.port}/graphql`,
    )
  })
}

main().catch((error: unknown) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
