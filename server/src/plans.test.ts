import { describe, expect, it } from 'vitest'
import { entitlementFromFreeAccess } from './pocketbase.js'
import { clampSessionMinutes, hasProductAccess, isCheckoutPlan, isFreeAccessPlan, isOneTimePlan, isPaidPlan, isPlan, sessionDurationOptions, sessionLimitForPlan, sessionMinutesForPlan, FREE_SESSION_MINUTES, PAID_SESSION_MINUTES } from './plans.js'

describe('plans', () => {
  it('treats none as an unconfigured plan without product access', () => {
    expect(isPlan('none')).toBe(true)
    expect(hasProductAccess('none', 'unpaid', 0)).toBe(false)
    expect(sessionLimitForPlan('none')).toBe(0)
  })

  it('treats active weekly, monthly, and yearly as paid', () => {
    expect(isPlan('weekly')).toBe(true)
    expect(isPlan('monthly')).toBe(true)
    expect(isPlan('yearly')).toBe(true)
    expect(isCheckoutPlan('monthly')).toBe(true)
    expect(isPaidPlan('weekly', 'active')).toBe(true)
    expect(isPaidPlan('monthly', 'trialing')).toBe(true)
    expect(isPaidPlan('yearly', 'past_due')).toBe(true)
  })

  it('treats one-time packs as checkout plans', () => {
    expect(isOneTimePlan('basic')).toBe(true)
    expect(isCheckoutPlan('plus')).toBe(true)
    expect(isPaidPlan('pro', 'active')).toBe(true)
    expect(isPlan('basic')).toBe(true)
  })

  it('still treats legacy premium as paid', () => {
    expect(isPlan('premium')).toBe(true)
    expect(isPaidPlan('premium', 'trialing')).toBe(true)
  })

  it('does not grant paid status without a current Stripe status', () => {
    expect(isPaidPlan('monthly', 'canceled')).toBe(false)
    expect(isPaidPlan('yearly', 'unpaid')).toBe(false)
    expect(isPaidPlan('free', 'active')).toBe(false)
    expect(isPaidPlan('weekly', undefined)).toBe(false)
  })

  it('lets free and one-time packs use remaining interview credits', () => {
    expect(hasProductAccess('free', 'unpaid', 3)).toBe(true)
    expect(hasProductAccess('free', 'unpaid', 0)).toBe(false)
    expect(hasProductAccess('basic', 'active', 2)).toBe(true)
    expect(hasProductAccess('plus', 'active', 0)).toBe(false)
    expect(hasProductAccess('weekly', 'active', 0)).toBe(true)
  })

  it('caps free sessions at 15 minutes and paid sessions at 60', () => {
    expect(sessionMinutesForPlan('free')).toBe(FREE_SESSION_MINUTES)
    expect(sessionMinutesForPlan('basic')).toBe(PAID_SESSION_MINUTES)
    expect(sessionMinutesForPlan('weekly')).toBe(PAID_SESSION_MINUTES)
    expect(sessionDurationOptions(15)).toEqual([15])
    expect(sessionDurationOptions(60)).toEqual([15, 30, 45, 60])
    expect(clampSessionMinutes(90, 'free')).toBe(15)
    expect(clampSessionMinutes(45, 'pro')).toBe(45)
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
