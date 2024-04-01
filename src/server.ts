import fastify from 'fastify'

const app = fastify()

// routes
app.get('/teste', () => {
  return 'Hello World'
})

// listening on port 3333
app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running on http://localhost:3333')
})
