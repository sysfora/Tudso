import './eventsource-polyfill.js'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import http from 'node:http'
import { config } from './config.js'
import routes from './routes.js'
import { attachRealtimeAudio } from './realtime.js'
import { isR2Configured, localStorageRoot } from './storage.js'

const app = express()
app.set('trust proxy', 1)

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

app.use(routes)

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error)
    return
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

const server = http.createServer(app)
server.on('connection', (socket) => {
  socket.setNoDelay(true)
})
attachRealtimeAudio(server)

server.listen(config.app.port, () => {
  console.log(`${config.app.name} server running on ${config.app.url}`)
  console.log(`Resume storage: ${isR2Configured() ? 'Cloudflare R2' : `local (${localStorageRoot()})`}`)
})
