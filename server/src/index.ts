import './eventsource-polyfill.js'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import http from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import routes from './routes.js'
import { attachRealtimeAudio } from './realtime.js'
import { log, requestLogger } from './log.js'

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
      fontSrc: ["'self'"],
      formAction: ["'self'", `${config.auth.callbackScheme}:`, 'https://accounts.google.com'],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: null,
    },
  },
}))
app.use(cors({ origin: true, credentials: true }))
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
app.use(requestLogger)

app.use(routes)

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

const server = http.createServer(app)
server.on('connection', (socket) => {
  socket.setNoDelay(true)
})
attachRealtimeAudio(server)

server.listen(config.app.port, () => {
  log.info(`${config.app.name} server listening`, {
    url: config.app.url,
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
