import type { Express } from 'express'
import express from 'express'
import { resolveMediaRoot } from '../../config'

export const MEDIA_SERVER_PORT = 7777
const MEDIA_ROUTE_PREFIX = '/media'

export function registerMediaServerRoutes(app: Express) {
  const mediaRoot = resolveMediaRoot()

  app.use(
    MEDIA_ROUTE_PREFIX,
    (_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      next()
    },
    express.static(mediaRoot, {
      dotfiles: 'deny',
      fallthrough: false,
      index: false
    })
  )
}
