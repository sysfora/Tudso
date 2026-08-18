import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { config } from './config.js'
import { entitlementStatusFromStripe, planFromStripeSubscription, priceIdToPlan } from './stripe.js'
import { isPaidPlan } from './plans.js'

function fakeSubscription(overrides: Partial<Stripe.Subscription> & { priceId?: string; periodEnd?: number }): Stripe.Subscription {
  const priceId = overrides.priceId ?? config.stripe.priceIds.pro
  const periodEnd = overrides.periodEnd ?? 1_800_000_000
  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: periodEnd - 2_592_000,
    current_period_end: periodEnd,
    items: {
      data: [{ price: { id: priceId } }],
    },
    ...overrides,
  } as Stripe.Subscription
}

describe('stripe', () => {
  it('maps price IDs to plans', () => {
    expect(priceIdToPlan(config.stripe.priceIds.pro)).toBe('pro')
    expect(priceIdToPlan(config.stripe.priceIds.premium)).toBe('premium')
    expect(priceIdToPlan('unknown')).toBe('free')
  })

  it('derives the current plan from a live Stripe subscription', () => {
    const mapped = planFromStripeSubscription(fakeSubscription({
      priceId: config.stripe.priceIds.premium,
      status: 'active',
    }))
    expect(mapped.plan).toBe('premium')
    expect(mapped.planStatus).toBe('active')
    expect(isPaidPlan(mapped.plan, mapped.planStatus)).toBe(true)
  })

  it('does not treat canceled or incomplete Stripe subscriptions as paid', () => {
    expect(entitlementStatusFromStripe('canceled')).toBe('canceled')
    expect(entitlementStatusFromStripe('incomplete')).toBe('unpaid')
    const mapped = planFromStripeSubscription(fakeSubscription({ status: 'canceled' }))
    expect(isPaidPlan(mapped.plan, mapped.planStatus)).toBe(false)
  })
})
