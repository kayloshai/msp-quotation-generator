import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import { initializeDatabase } from './db.js'
import { resolvers, typeDefs } from './schema.js'

const port = Number.parseInt(process.env.GRAPHQL_PORT || '4000', 10)

const bootstrap = async () => {
  await initializeDatabase()

  const server = new ApolloServer({
    typeDefs,
    resolvers
  })

  const { url } = await startStandaloneServer(server, {
    listen: { port }
  })

  // eslint-disable-next-line no-console
  console.log(`GraphQL server ready at ${url}`)
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start GraphQL server', error)
  process.exit(1)
})
