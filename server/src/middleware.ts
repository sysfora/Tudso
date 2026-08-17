import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { verifyJwt } from './auth.js'
import { getDesktopSession } from './pocketbase.js'
import type { EntitlementRecord } from './types.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      email?: string
      entitlement?: EntitlementRecord
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const session = await getDesktopSession(token)
  if (!session) {
    // fallback to JWT
    const jwt = verifyJwt(token)
    if (!jwt) {
      res.status(401).json({ error: 'Session expired or invalid' })
      return
    }
    req.userId = jwt.userId
    req.email = jwt.email
    next()
    return
  }
  req.userId = session.userId
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
