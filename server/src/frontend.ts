import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Express, NextFunction, Request, Response } from 'express'
import express from 'express'
import { log } from './log.js'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'web')
const clientDist = join(webRoot, 'dist', 'client')
const serverDist = join(webRoot, 'dist', 'server')
const SSR_MARK = '<!--ssr-outlet-->'

type RenderPage = () => string

/** Vite middleware is only for local `npm run dev` (tsx from src/). Hosted `npm start` serves the built app. */
export function isFrontendDev(): boolean {
  if (process.env.WEB_VITE === '1') return true
  if (process.env.WEB_VITE === '0' || process.env.NODE_ENV === 'production') return false
  return fileURLToPath(import.meta.url).replaceAll('\\', '/').includes('/src/')
}

export async function attachFrontend(app: Express, httpServer: Server): Promise<void> {
  if (isFrontendDev()) {
    await attachDevFrontend(app, httpServer)
    return
  }
  await attachProductionFrontend(app)
}

function injectSsr(template: string, appHtml: string): string {
  const hoistMatch = appHtml.match(/^(?:<link\b[^>]*>)+/i)
  const headExtra = hoistMatch?.[0] ?? ''
  const body = headExtra ? appHtml.slice(headExtra.length) : appHtml
  let html = template
  if (headExtra) html = html.replace('</head>', `${headExtra}</head>`)
  if (html.includes(SSR_MARK)) return html.replace(SSR_MARK, body)
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

async function sendSsrPage(res: Response, template: string, render: RenderPage) {
  const html = injectSsr(template, render())
  res.status(200).set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  }).end(html)
}

async function attachProductionFrontend(app: Express) {
  const indexFile = join(clientDist, 'index.html')
  const ssrFile = join(serverDist, 'entry-server.js')
  if (!existsSync(indexFile) || !existsSync(ssrFile)) {
    log.warn('Landing page build missing. Run npm run build in server.')
    app.get('/', (_req, res) => {
      res.status(503).type('html').send('<!DOCTYPE html><title>Tudso</title><p>Landing page is not built.</p>')
    })
    return
  }
  const template = await readFile(indexFile, 'utf8')
  const { render } = await import(pathToFileURL(ssrFile).href) as { render: RenderPage }
  log.info('Serving SSR landing page', { dir: clientDist })
  app.use(express.static(clientDist, { index: false, maxAge: '7d' }))
  app.get('/', (_req, res) => {
    void sendSsrPage(res, template, render)
  })
}

async function attachDevFrontend(app: Express, httpServer: Server) {
  const { createServer } = await import('vite')
  const vite = await createServer({
    configFile: join(webRoot, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'custom',
  })
  log.info('Serving SSR landing page with Vite (dev)')
  app.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = await readFile(join(webRoot, 'index.html'), 'utf8')
      const template = await vite.transformIndexHtml(req.originalUrl, raw)
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx') as { render: RenderPage }
      await sendSsrPage(res, template, render)
    } catch (error) {
      vite.ssrFixStacktrace(error as Error)
      next(error)
    }
  })
  app.use(vite.middlewares)
}
