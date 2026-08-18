import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { resolveAccessToken } from './auth.js'
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
