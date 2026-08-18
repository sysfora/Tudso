export type Plan = 'free' | 'pro' | 'premium'

export interface UserProfile {
  id: string
  user: string
  preferredName?: string
  profession?: string
  role?: string
  industry?: string
  education?: string
  skills: string[]
  goals: string[]
  communicationStyle?: 'concise' | 'balanced' | 'detailed'
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced'
  formal?: boolean
  stepByStep?: boolean
  examples?: boolean
  explainTerms?: boolean
  customContext?: string
}

export const DEFAULT_PROFILE_PREFERENCES = {
  communicationStyle: 'balanced',
  technicalLevel: 'intermediate',
  formal: false,
  stepByStep: true,
  examples: true,
  explainTerms: true,
} as const

export function resolveProfilePreferences(profile?: UserProfile | null) {
  const unset =
    !profile ||
    (profile.formal !== true &&
      profile.stepByStep !== true &&
      profile.examples !== true &&
      profile.explainTerms !== true)
  return {
    communicationStyle: profile?.communicationStyle ?? DEFAULT_PROFILE_PREFERENCES.communicationStyle,
    technicalLevel: profile?.technicalLevel ?? DEFAULT_PROFILE_PREFERENCES.technicalLevel,
    formal: unset ? DEFAULT_PROFILE_PREFERENCES.formal : Boolean(profile.formal),
    stepByStep: unset ? DEFAULT_PROFILE_PREFERENCES.stepByStep : Boolean(profile.stepByStep),
    examples: unset ? DEFAULT_PROFILE_PREFERENCES.examples : Boolean(profile.examples),
    explainTerms: unset ? DEFAULT_PROFILE_PREFERENCES.explainTerms : Boolean(profile.explainTerms),
  }
}

export interface Entitlement {
  id: string
  user: string
  plan: Plan
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  freeAccess?: 'pro' | 'premium'
  expiresAt: string
}

export interface Subscription {
  id: string
  user: string
  status: string
  plan?: Plan
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

export interface BillingPlanPrice {
  id: 'pro' | 'premium'
  priceId: string
  amount: number | null
  currency: string
  interval: string
}

export type MemorySource = 'auto' | 'manual'

export interface MemoryEntry {
  id: string
  text: string
  created: string
  source?: MemorySource
}

export const MAX_MEMORIES = 80
export const MAX_MEMORY_CHARS = 400
