const PAID_STATUSES = new Set(['active', 'trialing', 'past_due'])

export type PaidPlan = 'pro' | 'premium'

export function isPaidStatus(status?: string | null): boolean {
  return Boolean(status && PAID_STATUSES.has(status))
}

export function isPaidPlan(plan?: string | null, status?: string | null): boolean {
  return (plan === 'pro' || plan === 'premium') && isPaidStatus(status)
}

export function canHideFromCapture(plan?: string | null, status?: string | null): boolean {
  return plan === 'premium' && isPaidStatus(status)
}

export const PAID_PLAN_CATALOG: Array<{
  id: PaidPlan
  name: string
  description: string
  features: Array<{ text: string; included: boolean }>
}> = [
  {
    id: 'pro',
    name: 'Pro',
    description: 'Chat, screen answers, and live copilot. Always visible in screen share.',
    features: [
      { text: 'Chat and Intelligent model', included: true },
      { text: 'Screen answers', included: true },
      { text: 'Live copilot', included: true },
      { text: 'Hide from screen share', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Everything in Pro, plus a switch to hide Tudso from screen share.',
    features: [
      { text: 'Chat and Intelligent model', included: true },
      { text: 'Screen answers', included: true },
      { text: 'Live copilot', included: true },
      { text: 'Hide from screen share — turn it on or off', included: true },
    ],
  },
]
