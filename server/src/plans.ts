import type { Plan } from './types.js'

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due'])

export const CHECKOUT_PLANS = ['weekly', 'monthly', 'yearly'] as const
export type PaidPlan = (typeof CHECKOUT_PLANS)[number]
export type FreeAccessPlan = PaidPlan | 'pro' | 'premium'

export function isCheckoutPlan(value: unknown): value is PaidPlan {
  return value === 'weekly' || value === 'monthly' || value === 'yearly'
}

export function isPlan(value: unknown): value is Plan {
  return value === 'free' || isCheckoutPlan(value) || value === 'pro' || value === 'premium'
}

export function isPaidStatus(status?: string | null): boolean {
  return Boolean(status && PAID_STATUSES.has(status))
}

export function isPaidPlan(plan?: string | null, status?: string | null): boolean {
  return (isCheckoutPlan(plan) || plan === 'pro' || plan === 'premium') && isPaidStatus(status)
}

export function isFreeAccessPlan(value: unknown): value is FreeAccessPlan {
  return isCheckoutPlan(value) || value === 'pro' || value === 'premium'
}

export function planDisplayName(plan?: string | null): string {
  if (plan === 'weekly') return 'Weekly'
  if (plan === 'monthly') return 'Monthly'
  if (plan === 'yearly') return 'Yearly'
  if (plan === 'premium') return 'Premium'
  if (plan === 'pro') return 'Pro'
  return 'No plan'
}

export type PlanFeature = { text: string; included: boolean }

export type PaidPlanCatalogItem = {
  id: PaidPlan
  name: string
  mark: string
  description: string
  action: string
  featured?: boolean
  badge?: string
  fallbackAmount: number
  interval: 'week' | 'month' | 'year'
  features: PlanFeature[]
}

export const PAID_PLAN_CATALOG: PaidPlanCatalogItem[] = [
  {
    id: 'weekly',
    name: 'Weekly',
    mark: '*',
    description: 'Try unlimited for a week.',
    action: 'Get Weekly',
    fallbackAmount: 7800,
    interval: 'week',
    features: [
      { text: 'Unlimited call time', included: true },
      { text: 'Unlimited real-time answers', included: true },
      { text: 'Cancel anytime', included: true },
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly',
    mark: '**',
    description: 'Smart choice. Covers every call.',
    action: 'Get Monthly',
    featured: true,
    badge: 'Most popular',
    fallbackAmount: 14990,
    interval: 'month',
    features: [
      { text: 'Unlimited call time', included: true },
      { text: 'Unlimited real-time answers', included: true },
      { text: 'Best price per month', included: true },
    ],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    mark: '***',
    description: 'Go all-in. Never think about credits.',
    action: 'Get Yearly',
    fallbackAmount: 59990,
    interval: 'year',
    features: [
      { text: 'Unlimited call time', included: true },
      { text: 'Unlimited real-time answers', included: true },
      { text: 'Two months free', included: true },
    ],
  },
]
