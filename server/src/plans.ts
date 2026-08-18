import type { EntitlementRecord, Plan } from './types.js'

export const PLAN_FEATURES: Record<Plan, EntitlementRecord['usageLimits'] & Pick<EntitlementRecord, 'aiAccess' | 'realtimeAccess' | 'screenAnalysis' | 'audioAccess'>> = {
  free: {
    aiAccess: true,
    realtimeAccess: false,
    screenAnalysis: false,
    audioAccess: false,
  },
  pro: {
    aiAccess: true,
    realtimeAccess: true,
    screenAnalysis: true,
    audioAccess: true,
  },
  premium: {
    aiAccess: true,
    realtimeAccess: true,
    screenAnalysis: true,
    audioAccess: true,
  },
}

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due'])

export function isPlan(value: unknown): value is Plan {
  return value === 'free' || value === 'pro' || value === 'premium'
}

export function isPaidPlan(plan?: string | null, status?: string | null): boolean {
  return (plan === 'pro' || plan === 'premium') && Boolean(status && PAID_STATUSES.has(status))
}

export function featuresForPlan(plan: Plan, status?: string): typeof PLAN_FEATURES[Plan] {
  if (status && !PAID_STATUSES.has(status) && plan !== 'free') return PLAN_FEATURES.free
  return PLAN_FEATURES[plan]
}

export function applyPlanFeatures(entitlement: EntitlementRecord): EntitlementRecord {
  const features = featuresForPlan(entitlement.plan, entitlement.status)
  return {
    ...entitlement,
    aiAccess: features.aiAccess,
    realtimeAccess: features.realtimeAccess,
    screenAnalysis: features.screenAnalysis,
    audioAccess: features.audioAccess,
    usageLimits: {},
  }
}