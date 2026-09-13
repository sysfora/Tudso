import './eventsource-polyfill.js'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import http from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { attachFrontend, isFrontendDev } from './frontend.js'
import { ensureReleasesDir, releasesDir } from './releases.js'
import routes from './routes.js'
import { attachRealtimeAudio } from './realtime.js'
import { log, requestLogger } from './log.js'

const frontendDev = isFrontendDev()
if (!frontendDev) process.env.NODE_ENV ??= 'production'
const app = express()
app.set('trust proxy', 1)
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'", ...(frontendDev ? ['ws:', 'wss:'] : [])],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      formAction: ["'self'", `${config.auth.callbackScheme}:`, 'https://accounts.google.com', 'https://checkout.stripe.com'],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https://cdn.simpleicons.org'],
      objectSrc: ["'none'"],
      scriptSrc: frontendDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      upgradeInsecureRequests: null,
    },
  },
}))
app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    const allowedOrigins = new Set([
      config.app.url.replace(/\/$/, ''),
      ...(frontendDev ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
    ])
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(null, false)
  },
}))
app.use(cookieParser())
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }))
app.use(express.json({
  limit: '10mb',
  type: (req) => {
    const type = req.headers['content-type'] ?? ''
    if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) return false
    if (req.url?.startsWith('/webhooks/stripe')) return false
    return type.includes('json')
  },
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/brand', express.static(publicDir, { maxAge: '7d', index: false }))
app.use(express.static(publicDir, { maxAge: '7d', index: false }))
await ensureReleasesDir()
app.use('/downloads', express.static(releasesDir(), {
  index: false,
  fallthrough: false,
  setHeaders(res, filePath) {
    const name = filePath.toLowerCase()
    if (name.endsWith('.json') || name.endsWith('.yml') || name.endsWith('.yaml')) {
      res.setHeader('Cache-Control', 'no-store')
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=3600')
    if (name.endsWith('.dmg')) res.setHeader('Content-Type', 'application/x-apple-diskimage')
    if (/\.(exe|dmg|zip|appimage|blockmap)$/i.test(filePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${filePath.split(/[/\\]/).pop()}"`)
    }
  },
}))
app.use(requestLogger)

app.use(routes)

const server = http.createServer(app)
server.on('connection', (socket) => {
  socket.setNoDelay(true)
})

await attachFrontend(app, server)

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error)
    return
  }
  if (error instanceof SyntaxError) {
    log.warn('Invalid JSON body', { method: req.method, path: req.path })
    res.status(400).json({ error: 'Invalid request body' })
    return
  }
  const err = error as { name?: string; message?: string; stack?: string }
  log.error(err.message || 'Unhandled error', {
    method: req.method,
    path: req.path,
    user: req.userId,
  })
  if (err.stack) console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

attachRealtimeAudio(server)

server.listen(config.app.port, config.app.host, () => {
  log.info(`${config.app.name} server listening`, {
    url: config.app.url,
    host: config.app.host,
    port: config.app.port,
    env: config.app.env,
  })
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', { err: reason instanceof Error ? reason.message : String(reason) })
  if (reason instanceof Error && reason.stack) console.error(reason.stack)
})

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', { err: error.message })
  console.error(error.stack)
})
