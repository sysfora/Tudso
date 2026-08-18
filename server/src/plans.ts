import type { Plan } from './types.js'

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due'])

export function isPlan(value: unknown): value is Plan {
  return value === 'free' || value === 'pro' || value === 'premium'
}

export function isPaidStatus(status?: string | null): boolean {
  return Boolean(status && PAID_STATUSES.has(status))
}

export function isPaidPlan(plan?: string | null, status?: string | null): boolean {
  return (plan === 'pro' || plan === 'premium') && isPaidStatus(status)
}

export type FreeAccessPlan = 'pro' | 'premium'

export function isFreeAccessPlan(value: unknown): value is FreeAccessPlan {
  return value === 'pro' || value === 'premium'
}
