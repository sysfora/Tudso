import { describe, expect, it } from 'vitest'
import { entitlementFromFreeAccess } from './pocketbase.js'
import { isCheckoutPlan, isFreeAccessPlan, isPaidPlan, isPlan } from './plans.js'

describe('plans', () => {
  it('treats active weekly, monthly, and yearly as paid', () => {
    expect(isPlan('weekly')).toBe(true)
    expect(isPlan('monthly')).toBe(true)
    expect(isPlan('yearly')).toBe(true)
    expect(isCheckoutPlan('monthly')).toBe(true)
    expect(isPaidPlan('weekly', 'active')).toBe(true)
    expect(isPaidPlan('monthly', 'trialing')).toBe(true)
    expect(isPaidPlan('yearly', 'past_due')).toBe(true)
  })

  it('still treats legacy pro and premium as paid', () => {
    expect(isPlan('pro')).toBe(true)
    expect(isPaidPlan('pro', 'active')).toBe(true)
    expect(isPaidPlan('premium', 'trialing')).toBe(true)
  })

  it('does not grant access without a current paid Stripe status', () => {
    expect(isPaidPlan('monthly', 'canceled')).toBe(false)
    expect(isPaidPlan('yearly', 'unpaid')).toBe(false)
    expect(isPaidPlan('free', 'active')).toBe(false)
    expect(isPaidPlan('weekly', undefined)).toBe(false)
  })

  it('grants complimentary access from freeAccess without Stripe', () => {
    expect(isFreeAccessPlan('monthly')).toBe(true)
    expect(isFreeAccessPlan('premium')).toBe(true)
    expect(isFreeAccessPlan('free')).toBe(false)
    const granted = entitlementFromFreeAccess('user1', {
      id: 'user1',
      freeAccess: 'yearly',
    })
    expect(granted.plan).toBe('yearly')
    expect(granted.status).toBe('active')
    expect(granted.freeAccess).toBe('yearly')
    expect(isPaidPlan(granted.plan, granted.status)).toBe(true)
  })
})
