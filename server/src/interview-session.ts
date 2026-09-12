import crypto from 'node:crypto'
import { clampSessionMinutes } from './plans.js'

type SessionLease = {
  userId: string
  expiresAt: number
}

const leases = new Map<string, SessionLease>()

export function createInterviewSession(userId: string, requestedMinutes?: number, plan?: string | null): { token: string; expiresAt: number } {
  const minutes = clampSessionMinutes(requestedMinutes ?? 15, plan)
  const expiresAt = Date.now() + minutes * 60_000
  const token = crypto.randomBytes(32).toString('hex')
  leases.set(token, { userId, expiresAt })
  return { token, expiresAt }
}

export function verifyInterviewSession(token: string, userId: string): boolean {
  const lease = leases.get(token)
  if (!lease) return false
  if (lease.userId !== userId || lease.expiresAt <= Date.now()) {
    leases.delete(token)
    return false
  }
  return true
}

export function revokeInterviewSession(token: string): void {
  leases.delete(token)
}
