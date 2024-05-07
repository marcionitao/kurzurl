import fastify from 'fastify'
import { z } from 'zod'
import { sql } from './lib/postgres'
import postgres from 'postgres'
import { redis } from './lib/redis'

const app = fastify()

// routes
// list for code "rocket"
app.get('/:code', async (request, reply) => {
  const getLinkSchema = z.object({
    code: z.string().min(3),
  })

  const { code } = getLinkSchema.parse(request.params)

  const result = await sql`
  SELECT id, original_url
  FROM short_links
  WHERE short_links.code = ${code}
  `
  // if link not found
  if (result.length === 0) {
    return reply.status(400).send({ message: 'Link not found' })
  }

  const link = result[0]

  // using redis
  await redis.zIncrBy('metrics', 1, String(link.id)) // isso significa que o link foi visitado 1 vez

  // redirect user
  // 301 - moved permanently
  // 302 - found
  return reply.redirect(301, link.original_url)
})

// list all
app.get('/api/links', async () => {
  const result = await sql`
  SELECT *
  FROM short_links
  ORDER BY created_at DESC
  `
  return result
})

// add new link
app.post('/api/links', async (request, reply) => {
  // criando um schema para o body
  const createLinkSchema = z.object({
    code: z.string().min(3),
    url: z.string().url(),
  })
  const { code, url } = createLinkSchema.parse(request.body)

  try {
    const result = await sql`
    INSERT INTO short_links (code, original_url) 
    VALUES (${code}, ${url})
    RETURNING id
    `
    const link = result[0]

    // 200 - generic
    // 201 - created (criado com sucesso)
    return reply.status(201).send({ shorLinkId: link.id })
  } catch (err) {
    if (err instanceof postgres.PostgresError) {
      if (err.code === '23505') {
        return reply.status(400).send({ message: 'Duplicated code!' })
      }
    }

    console.log(err)
    return reply.status(500).send({ message: 'Internal server error' })
  }
})

// metrics list
app.get('/api/metrics', async () => {
  const result = await redis.zRangeByScoreWithScores('metrics', 0, 50) // return all links visits

  const sort = result
    .sort((a, b) => b.score - a.score) // sort by visits
    .map((item) => {
      return {
        shortLinkId: Number(item.value),
        clicks: item.score,
      }
    })
  return sort
})
// listening on port 3333
app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running on http://localhost:3333')
})
