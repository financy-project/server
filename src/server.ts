import 'reflect-metadata'
import { startStandaloneServer } from '@apollo/server/standalone'
import { buildApolloServer } from './app'
import { createContext } from '@/context/create-context'
import { Environments } from '@/config/environments'
import { listenersRegistrator } from '@/utils/listenersRegistrator'

const main = async (): Promise<void> => {
  listenersRegistrator()

  const server = await buildApolloServer()

  const { url } = await startStandaloneServer(server, {
    context: createContext,
    listen: { port: Environments.port },
  })

  console.log(`🚀 Server ready at ${url}`)
}

main().catch((error: unknown) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
