import { describe, expect, it } from 'vitest'
import { config } from './config.js'
import { priceIdToPlan } from './stripe.js'

describe('stripe', () => {
  it('maps price IDs to plans', () => {
    expect(priceIdToPlan(config.stripe.priceIds.pro)).toBe('pro')
    expect(priceIdToPlan(config.stripe.priceIds.premium)).toBe('premium')
    expect(priceIdToPlan('unknown')).toBe('free')
  })
})
