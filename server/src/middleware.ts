import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { resolveAccessToken } from './auth.js'
import { config } from './config.js'
import { log } from './log.js'
import type { EntitlementRecord } from './types.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      email?: string
      deviceId?: string
      entitlement?: EntitlementRecord
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token
  if (!token) {
    log.warn('Auth rejected', { method: req.method, path: req.path, reason: 'missing token' })
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const resolved = await resolveAccessToken(token)
  if (!resolved?.userId) {
    log.warn('Auth rejected', { method: req.method, path: req.path, reason: 'invalid session' })
    res.status(401).json({ error: 'Session expired or invalid' })
    return
  }
  req.userId = resolved.userId
  req.email = resolved.email
  req.deviceId = resolved.deviceId
  next()
}

export function tokenEquals(received: string, expected: string) {
  if (!expected) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function requireReleaseUpload(req: Request, res: Response, next: NextFunction) {
  const expected = config.security.releaseUploadToken
  if (!expected) {
    res.status(503).json({ error: 'Release upload is not configured' })
    return
  }
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  if (!tokenEquals(token, expected)) {
    log.warn('Release upload rejected', { method: req.method, path: req.path })
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId ?? req.ip ?? 'unknown',
})

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId ?? req.ip ?? 'unknown',
})

export const sensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId ?? req.ip ?? 'unknown',
})
