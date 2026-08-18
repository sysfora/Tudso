import { describe, expect, it } from 'vitest'
import { isPaidPlan, isPlan } from './plans.js'

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
})
