import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'http'
import { Fetcher } from '../../../packages/queries/src/fetcher'

const PORT = 34599
const API_MESSAGE = 'Error de Gemini (503): This model is currently experiencing high demand.'

let server: http.Server

const startServer = (handler: http.RequestListener) =>
  new Promise<void>((resolve) => {
    server = http.createServer(handler)
    server.listen(PORT, '127.0.0.1', resolve)
  })

const callFetcher = () =>
  Fetcher({ apiUrl: 'http://127.0.0.1', port: PORT, path: '/api/ai/extractFromDocx', body: {} })
    .then(() => null)
    .catch((e) => e)

describe('Fetcher', () => {
  describe('cuando el API responde 500 con { error }', () => {
    beforeAll(() =>
      startServer((_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: API_MESSAGE }))
      })
    )
    afterAll(() => server.close())

    it('lanza un Error con el mensaje del API y el payload original', async () => {
      const err = await callFetcher()

      expect(err).toBeInstanceOf(Error)
      expect(err.message).toBe(API_MESSAGE)
      expect(err.payload).toEqual({ error: API_MESSAGE })
    })
  })
})
