import type { Response } from 'express'
import { config } from './config.js'

export const WEB_COOKIE = 'token'
export const WEB_DEVICE_ID = 'web-dashboard'

export function setWebSessionCookie(res: Response, token: string): void {
  res.cookie(WEB_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.app.url.startsWith('https'),
    maxAge: config.auth.sessionTtlMs,
    path: '/',
  })
}

export function clearWebSessionCookie(res: Response): void {
  res.clearCookie(WEB_COOKIE, { path: '/' })
}
