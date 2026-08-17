import { describe, expect, it } from 'vitest'
import { applyPlanFeatures, featuresForPlan, isPlan } from './plans.js'

describe('plans', () => {
  it('treats pro as a paid plan with AI access', () => {
    expect(isPlan('pro')).toBe(true)
    expect(featuresForPlan('pro').aiAccess).toBe(true)
    expect(featuresForPlan('pro').realtimeAccess).toBe(true)
  })

  it('applies plan features even when stored flags are false', () => {
    const resolved = applyPlanFeatures({
      id: '1',
      user: '1',
      plan: 'pro',
      status: 'active',
      aiAccess: false,
      realtimeAccess: false,
      screenAnalysis: false,
      audioAccess: false,
      usageLimits: {},
      expiresAt: '',
      created: '',
      updated: '',
    })
    expect(resolved.aiAccess).toBe(true)
    expect(resolved.usageLimits).toEqual({})
  })

  it('downgrades canceled paid plans to free features', () => {
    expect(featuresForPlan('pro', 'canceled').aiAccess).toBe(true)
    expect(featuresForPlan('pro', 'canceled').realtimeAccess).toBe(false)
  })
})
