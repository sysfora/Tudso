import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { config } from './config.js'
import { entitlementStatusFromStripe, planFromStripeSubscription, priceIdToPlan } from './stripe.js'
import { isPaidPlan } from './plans.js'

function fakeSubscription(overrides: Partial<Stripe.Subscription> & { priceId?: string; periodEnd?: number }): Stripe.Subscription {
  const priceId = overrides.priceId ?? config.stripe.priceIds.monthly
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
    expect(priceIdToPlan(config.stripe.priceIds.weekly)).toBe('weekly')
    expect(priceIdToPlan(config.stripe.priceIds.monthly)).toBe('monthly')
    expect(priceIdToPlan(config.stripe.priceIds.yearly)).toBe('yearly')
    expect(priceIdToPlan(config.stripe.priceIds.pro)).toBe('pro')
    expect(priceIdToPlan(config.stripe.priceIds.premium)).toBe('premium')
    expect(priceIdToPlan('unknown')).toBe('free')
  })

  it('derives the current plan from a live Stripe subscription', () => {
    const mapped = planFromStripeSubscription(fakeSubscription({
      priceId: config.stripe.priceIds.yearly,
      status: 'active',
    }))
    expect(mapped.plan).toBe('yearly')
    expect(mapped.planStatus).toBe('active')
    expect(isPaidPlan(mapped.plan, mapped.planStatus)).toBe(true)
  })

  it('does not treat canceled or incomplete Stripe subscriptions as paid', () => {
    expect(entitlementStatusFromStripe('canceled')).toBe('canceled')
    expect(entitlementStatusFromStripe('incomplete')).toBe('unpaid')
    const mapped = planFromStripeSubscription(fakeSubscription({ status: 'canceled' }))
    expect(isPaidPlan(mapped.plan, mapped.planStatus)).toBe(false)
  })

  it('maps Stripe invoices for the billing history', async () => {
    const { publicInvoice } = await import('./stripe.js')
    expect(publicInvoice({
      id: 'in_1',
      number: 'ABC-0001',
      created: 1_800_000_000,
      amount_paid: 14990,
      amount_due: 0,
      currency: 'usd',
      status: 'paid',
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
      invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
      period_start: 1_799_000_000,
      period_end: 1_800_000_000,
    })).toEqual({
      id: 'in_1',
      number: 'ABC-0001',
      created: '2027-01-15T08:00:00.000Z',
      amount: 14990,
      currency: 'usd',
      status: 'paid',
      hostedUrl: 'https://invoice.stripe.com/i/test',
      pdfUrl: 'https://pay.stripe.com/invoice/test/pdf',
      periodStart: '2027-01-03T18:13:20.000Z',
      periodEnd: '2027-01-15T08:00:00.000Z',
    })
    expect(publicInvoice({ id: 'in_draft', status: 'draft' })).toBeNull()
  })
})
