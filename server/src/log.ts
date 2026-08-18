import type { NextFunction, Request, Response } from 'express'

function stamp() {
  const d = new Date()
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function line(level: string, message: string, extra?: Record<string, unknown>) {
  const bits = Object.entries(extra ?? {})
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
  const suffix = bits.length ? ` ${bits.join(' ')}` : ''
  const text = `[${stamp()}] ${level} ${message}${suffix}`
  if (level === 'error') console.error(text)
  else if (level === 'warn') console.warn(text)
  else console.log(text)
}

export const log = {
  info: (message: string, extra?: Record<string, unknown>) => line('info', message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => line('warn', message, extra),
  error: (message: string, extra?: Record<string, unknown>) => line('error', message, extra),
}

export function publicPath(url?: string): string {
  if (!url) return '/'
  const q = url.indexOf('?')
  if (q === -1) return url
  const path = url.slice(0, q)
  const params = new URLSearchParams(url.slice(q + 1))
  if (params.has('token')) params.set('token', 'redacted')
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (
    req.method === 'OPTIONS' ||
    req.path === '/health' ||
    req.path.startsWith('/brand/') ||
    req.path === '/favicon.ico' ||
    req.path === '/apple-touch-icon.png' ||
    req.path === '/apple-touch-icon-precomposed.png' ||
    req.path === '/site.webmanifest'
  ) {
    next()
    return
  }
  const started = Date.now()
  const path = publicPath(req.originalUrl || req.url)
  res.on('finish', () => {
    const extra = {
      status: res.statusCode,
      ms: Date.now() - started,
      user: req.userId,
    }
    const message = `${req.method} ${path}`
    if (res.statusCode >= 500) log.error(message, extra)
    else if (res.statusCode >= 400) log.warn(message, extra)
    else log.info(message, extra)
  })
  next()
}

export function logError(message: string, error: unknown, extra?: Record<string, unknown>): void {
  log.error(message, { ...extra, err: errorMessage(error) })
  if (error instanceof Error && error.stack) console.error(error.stack)
}
