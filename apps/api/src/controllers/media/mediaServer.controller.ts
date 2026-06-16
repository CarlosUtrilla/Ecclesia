import path from 'path'
import type { Express } from 'express'
import express from 'express'
import { resolveMediaRoot } from '../../config'

export const MEDIA_SERVER_PORT = 7777
const MEDIA_ROUTE_PREFIX = '/media'

export type LazyFetchHandler = (relativePath: string) => Promise<boolean>

export function registerMediaServerRoutes(
  app: Express,
  options?: { lazyFetch?: LazyFetchHandler }
) {
  const mediaRoot = resolveMediaRoot()

  app.use(
    MEDIA_ROUTE_PREFIX,
    (_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      next()
    },
    express.static(mediaRoot, {
      dotfiles: 'deny',
      fallthrough: true,
      index: false
    }),
    async (req, res) => {
      if (!options?.lazyFetch) {
        res.status(404).send('Not found')
        return
      }

      const relativePath = req.path.replace(/^\//, '')
      if (!relativePath) {
        res.status(404).send('Not found')
        return
      }

      try {
        const fetched = await options.lazyFetch(relativePath)
        if (fetched) {
          const fullPath = path.join(resolveMediaRoot(), relativePath)
          res.sendFile(fullPath)
          return
        }
      } catch {
        // Fall through to 404
      }

      res.status(404).send('Not found')
    }
  )
}
