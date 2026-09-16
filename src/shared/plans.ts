const PAID_STATUSES = new Set(['active', 'trialing', 'past_due'])

export const ONE_TIME_PLANS = ['basic', 'plus', 'pro'] as const
export const RECURRING_PLANS = ['weekly', 'monthly', 'yearly'] as const
export const CHECKOUT_PLANS = [...ONE_TIME_PLANS, ...RECURRING_PLANS] as const
export type OneTimePlan = (typeof ONE_TIME_PLANS)[number]
export type RecurringPlan = (typeof RECURRING_PLANS)[number]
export type PaidPlan = (typeof CHECKOUT_PLANS)[number]
export type LegacyPaidPlan = 'premium'
export type PlanId = PaidPlan | LegacyPaidPlan | 'free'

export type PlanGroup = 'one_time' | 'subscription'
export type PlanInterval = 'one_time' | 'week' | 'month' | 'year'

export function isOneTimePlan(value: unknown): value is OneTimePlan {
  return value === 'basic' || value === 'plus' || value === 'pro'
}

export function isRecurringPlan(value: unknown): value is RecurringPlan {
  return value === 'weekly' || value === 'monthly' || value === 'yearly'
}

export function isCheckoutPlan(value: unknown): value is PaidPlan {
  return isOneTimePlan(value) || isRecurringPlan(value)
}

export function isUnlimitedPlan(plan?: string | null): boolean {
  return isRecurringPlan(plan) || plan === 'premium'
}

export function isPaidPlanId(plan?: string | null): boolean {
  return isCheckoutPlan(plan) || plan === 'premium'
}

export function isPaidStatus(status?: string | null): boolean {
  return Boolean(status && PAID_STATUSES.has(status))
}

export function isPaidPlan(plan?: string | null, status?: string | null): boolean {
  return isPaidPlanId(plan) && isPaidStatus(status)
}

export function sessionLimitForPlan(plan?: string | null): number | null {
  if (plan === 'basic' || plan === 'free') return 3
  if (plan === 'plus') return 8
  if (plan === 'pro') return 15
  if (isUnlimitedPlan(plan)) return null
  return 3
}

export const FREE_SESSION_MINUTES = 15
export const PAID_SESSION_MINUTES = 60

export function sessionMinutesForPlan(plan?: string | null): number {
  if (isUnlimitedPlan(plan) || isOneTimePlan(plan) || plan === 'premium') return PAID_SESSION_MINUTES
  return FREE_SESSION_MINUTES
}

export function sessionDurationOptions(maxMinutes: number): number[] {
  const steps = [15, 30, 45, 60]
  const allowed = steps.filter((value) => value <= maxMinutes)
  return allowed.length ? allowed : [maxMinutes]
}

export function clampSessionMinutes(minutes: number, plan?: string | null): number {
  const max = sessionMinutesForPlan(plan)
  const next = Math.round(minutes)
  if (!Number.isFinite(next) || next <= 0) return max
  return Math.min(max, next)
}

export function hasProductAccess(plan?: string | null, status?: string | null, credits?: number): boolean {
  if (isUnlimitedPlan(plan) && isPaidStatus(status)) return true
  if (isOneTimePlan(plan) && isPaidStatus(status) && (credits ?? 0) > 0) return true
  return (credits ?? 0) > 0
}

export function remainingSessionsDisplay(plan?: string | null, status?: string | null, credits?: number): string {
  if (isUnlimitedPlan(plan) && isPaidStatus(status)) return '∞'
  return String(Math.max(0, credits ?? 0))
}

export function planDisplayName(plan?: string | null): string {
  if (plan === 'basic') return 'Basic'
  if (plan === 'plus') return 'Plus'
  if (plan === 'pro') return 'Pro'
  if (plan === 'weekly') return 'Weekly'
  if (plan === 'monthly') return 'Monthly'
  if (plan === 'yearly') return 'Yearly'
  if (plan === 'premium') return 'Premium'
  if (plan === 'free') return 'Free'
  return 'No plan'
}

export function planIntervalLabel(interval: PlanInterval): string {
  if (interval === 'one_time') return 'one time'
  if (interval === 'week') return 'week'
  if (interval === 'month') return 'month'
  return 'year'
}

export function splitPrice(amountCents: number): { dollars: string; cents: string } {
  const dollars = Math.floor(Math.abs(amountCents) / 100).toString()
  const cents = String(Math.abs(amountCents) % 100).padStart(2, '0')
  return { dollars, cents }
}

export type PlanFeature = { text: string; included: boolean }

export type PlanCatalogItem = {
  id: PaidPlan | 'free'
  group: PlanGroup
  name: string
  mark: string
  description: string
  action: string
  featured?: boolean
  badge?: string
  fallbackAmount: number
  interval: PlanInterval
  sessions: number | null
  sessionMinutes: number
  features: PlanFeature[]
}

export type PaidPlanCatalogItem = PlanCatalogItem & { id: PaidPlan }

const CORE_FEATURES: PlanFeature[] = [
  { text: '100% Stealth', included: true },
  { text: 'Snap & Solve', included: true },
  { text: 'Real-Time Answers', included: true },
]

function packFeatures(sessions: number, minutes: number): PlanFeature[] {
  return [
    { text: `${sessions} Interview Sessions`, included: true },
    { text: `${minutes} min per session`, included: true },
    ...CORE_FEATURES,
  ]
}

function unlimitedFeatures(minutes: number): PlanFeature[] {
  return [
    { text: 'Unlimited Interview Sessions', included: true },
    { text: `${minutes} min per session`, included: true },
    ...CORE_FEATURES,
  ]
}

export const PLAN_CATALOG: PlanCatalogItem[] = [
  {
    id: 'basic',
    group: 'one_time',
    name: 'Basic',
    mark: '*',
    description: 'Pay once. Three 60-minute interview sessions.',
    action: 'Get Basic',
    fallbackAmount: 5900,
    interval: 'one_time',
    sessions: 3,
    sessionMinutes: PAID_SESSION_MINUTES,
    features: packFeatures(3, PAID_SESSION_MINUTES),
  },
  {
    id: 'plus',
    group: 'one_time',
    name: 'Plus',
    mark: '**',
    description: 'Pay once. Eight 60-minute interview sessions.',
    action: 'Get Plus',
    badge: 'Most popular',
    featured: true,
    fallbackAmount: 11800,
    interval: 'one_time',
    sessions: 8,
    sessionMinutes: PAID_SESSION_MINUTES,
    features: packFeatures(8, PAID_SESSION_MINUTES),
  },
  {
    id: 'pro',
    group: 'one_time',
    name: 'Pro',
    mark: '***',
    description: 'Pay once. Fifteen 60-minute interview sessions.',
    action: 'Get Pro',
    fallbackAmount: 17700,
    interval: 'one_time',
    sessions: 15,
    sessionMinutes: PAID_SESSION_MINUTES,
    features: packFeatures(15, PAID_SESSION_MINUTES),
  },
  {
    id: 'free',
    group: 'subscription',
    name: 'Free',
    mark: '*',
    description: 'Three 15-minute interview sessions to get started.',
    action: 'Get started',
    fallbackAmount: 0,
    interval: 'one_time',
    sessions: 3,
    sessionMinutes: FREE_SESSION_MINUTES,
    features: packFeatures(3, FREE_SESSION_MINUTES),
  },
  {
    id: 'weekly',
    group: 'subscription',
    name: 'Weekly',
    mark: '**',
    description: 'Unlimited 60-minute sessions, billed weekly.',
    action: 'Get Weekly',
    fallbackAmount: 7800,
    interval: 'week',
    sessions: null,
    sessionMinutes: PAID_SESSION_MINUTES,
    features: unlimitedFeatures(PAID_SESSION_MINUTES),
  },
  {
    id: 'monthly',
    group: 'subscription',
    name: 'Monthly',
    mark: '***',
    description: 'Unlimited 60-minute sessions, billed monthly.',
    action: 'Get Monthly',
    featured: true,
    badge: 'Most popular',
    fallbackAmount: 14990,
    interval: 'month',
    sessions: null,
    sessionMinutes: PAID_SESSION_MINUTES,
    features: unlimitedFeatures(PAID_SESSION_MINUTES),
  },
  {
    id: 'yearly',
    group: 'subscription',
    name: 'Yearly',
    mark: '****',
    description: 'Unlimited 60-minute sessions, billed yearly.',
    action: 'Get Yearly',
    fallbackAmount: 59990,
    interval: 'year',
    sessions: null,
    sessionMinutes: PAID_SESSION_MINUTES,
    features: unlimitedFeatures(PAID_SESSION_MINUTES),
  },
]

export const PAID_PLAN_CATALOG: PaidPlanCatalogItem[] = PLAN_CATALOG.filter(
  (item): item is PaidPlanCatalogItem => item.id !== 'free',
)

export const ONE_TIME_PLAN_CATALOG = PAID_PLAN_CATALOG.filter((item) => item.group === 'one_time')
export const SUBSCRIPTION_PLAN_CATALOG = PLAN_CATALOG.filter((item) => item.group === 'subscription')
