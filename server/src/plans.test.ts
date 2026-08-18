import { describe, expect, it } from 'vitest'
import { entitlementFromFreeAccess } from './pocketbase.js'
import { isFreeAccessPlan, isPaidPlan, isPlan } from './plans.js'

describe('plans', () => {
  it('treats active pro and premium as paid', () => {
    expect(isPlan('pro')).toBe(true)
    expect(isPaidPlan('pro', 'active')).toBe(true)
    expect(isPaidPlan('premium', 'trialing')).toBe(true)
    expect(isPaidPlan('premium', 'past_due')).toBe(true)
  })

  it('does not grant access without a current paid Stripe status', () => {
    expect(isPaidPlan('pro', 'canceled')).toBe(false)
    expect(isPaidPlan('premium', 'unpaid')).toBe(false)
    expect(isPaidPlan('free', 'active')).toBe(false)
    expect(isPaidPlan('pro', undefined)).toBe(false)
  })

  it('grants complimentary pro or premium from freeAccess without Stripe', () => {
    expect(isFreeAccessPlan('pro')).toBe(true)
    expect(isFreeAccessPlan('premium')).toBe(true)
    expect(isFreeAccessPlan('free')).toBe(false)
    const granted = entitlementFromFreeAccess('user1', {
      id: 'user1',
      freeAccess: 'premium',
    })
    expect(granted.plan).toBe('premium')
    expect(granted.status).toBe('active')
    expect(granted.freeAccess).toBe('premium')
    expect(isPaidPlan(granted.plan, granted.status)).toBe(true)
  })
})
