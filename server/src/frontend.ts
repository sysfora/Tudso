import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Express, NextFunction, Request, Response } from 'express'
import express from 'express'
import { config } from './config.js'
import { log } from './log.js'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'web')
const webDist = join(webRoot, 'dist')

function isProduction() {
  return config.app.env === 'production'
}

export async function attachFrontend(app: Express, httpServer: Server): Promise<void> {
  if (isProduction()) {
    attachProductionFrontend(app)
    return
  }
  await attachDevFrontend(app, httpServer)
}

function attachProductionFrontend(app: Express) {
  const indexFile = join(webDist, 'index.html')
  if (!existsSync(indexFile)) {
    log.warn('Landing page build missing. Run npm run build in server.')
    app.get('/', (_req, res) => {
      res.status(503).type('html').send('<!DOCTYPE html><title>Tudso</title><p>Landing page is not built.</p>')
    })
    return
  }
  app.use(express.static(webDist, { index: false, maxAge: '7d' }))
  app.get('/', (_req, res) => {
    res.sendFile(indexFile)
  })
}

async function attachDevFrontend(app: Express, httpServer: Server) {
  const { createServer } = await import('vite')
  const vite = await createServer({
    configFile: join(webRoot, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'custom',
  })
  app.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await readFile(join(webRoot, 'index.html'), 'utf8')
      const html = await vite.transformIndexHtml(req.originalUrl, template)
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html)
    } catch (error) {
      vite.ssrFixStacktrace(error as Error)
      next(error)
    }
  })
  app.use(vite.middlewares)
}
