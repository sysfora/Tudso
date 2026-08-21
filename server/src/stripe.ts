import Stripe from 'stripe'
import { config } from './config.js'
import { log } from './log.js'
import { getSubscription, upsertSubscription, syncUserBilling, type UserBilling } from './pocketbase.js'
import { CHECKOUT_PLANS, isCheckoutPlan, type PaidPlan } from './plans.js'
import type { EntitlementRecord, Plan, SubscriptionRecord } from './types.js'

const LIVE_PLAN_TTL_MS = 8_000
const liveEntitlementCache = new Map<string, { at: number; value: EntitlementRecord }>()

export const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2025-02-24.acacia' })

export function priceIdToPlan(priceId: string): Plan {
  if (!priceId) return 'free'
  if (priceId === config.stripe.priceIds.weekly) return 'weekly'
  if (priceId === config.stripe.priceIds.monthly) return 'monthly'
  if (priceId === config.stripe.priceIds.yearly) return 'yearly'
  if (priceId === config.stripe.priceIds.pro) return 'pro'
  if (priceId === config.stripe.priceIds.premium) return 'premium'
  return 'free'
}

export function invalidateLiveEntitlement(userId: string): void {
  liveEntitlementCache.delete(userId)
}

function unixToIso(seconds?: number | null): string {
  if (!seconds) return ''
  return new Date(seconds * 1000).toISOString()
}

function subscriptionPeriod(sub: Stripe.Subscription): { start: string; end: string } {
  const item = sub.items.data[0] as { current_period_start?: number; current_period_end?: number } | undefined
  const start = ('current_period_start' in sub && typeof sub.current_period_start === 'number'
    ? sub.current_period_start
    : item?.current_period_start) ?? 0
  const end = ('current_period_end' in sub && typeof sub.current_period_end === 'number'
    ? sub.current_period_end
    : item?.current_period_end) ?? 0
  return { start: unixToIso(start), end: unixToIso(end) }
}

function subscriptionStatusFromStripe(status: Stripe.Subscription.Status): SubscriptionRecord['status'] {
  if (status === 'paused') return 'unpaid'
  return status as SubscriptionRecord['status']
}

export function entitlementStatusFromStripe(status: Stripe.Subscription.Status): EntitlementRecord['status'] {
  if (status === 'incomplete' || status === 'incomplete_expired' || status === 'paused') return 'unpaid'
  if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'canceled' || status === 'unpaid') {
    return status
  }
  return 'unpaid'
}

export function planFromStripeSubscription(sub: Stripe.Subscription): {
  plan: Plan
  planStatus: EntitlementRecord['status']
  priceId: string
  status: SubscriptionRecord['status']
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string
  stripeSubscriptionId: string
} {
  const priceId = sub.items.data[0]?.price.id ?? ''
  const period = subscriptionPeriod(sub)
  return {
    plan: priceIdToPlan(priceId),
    planStatus: entitlementStatusFromStripe(sub.status),
    priceId,
    status: subscriptionStatusFromStripe(sub.status),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
  }
}

function rankStripeSubscription(sub: Stripe.Subscription): number {
  switch (sub.status) {
    case 'active': return 0
    case 'trialing': return 1
    case 'past_due': return 2
    case 'unpaid': return 3
    default: return 9
  }
}

function pickStripeSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  if (!subs.length) return null
  return [...subs].sort((a, b) => rankStripeSubscription(a) - rankStripeSubscription(b) || b.created - a.created)[0] ?? null
}

function isStripeMissing(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'resource_missing')
}

function stripeSecretMode(): 'test' | 'live' {
  return config.stripe.secretKey.startsWith('sk_live_') ? 'live' : 'test'
}

function missingPriceError(plan: string, priceId: string, error: unknown): Error {
  if (!isStripeMissing(error)) {
    return error instanceof Error ? error : new Error('Could not start checkout')
  }
  const mode = stripeSecretMode()
  const other = mode === 'test' ? 'live' : 'test'
  return new Error(
    `Stripe has no ${plan} price in ${mode} mode. Copy the Price ID from Dashboard with ${mode} mode on (not ${other}), using the same account as STRIPE_SECRET_KEY.`,
  )
}

async function fetchStripeSubscription(subscriptionId?: string, customerId?: string): Promise<Stripe.Subscription | null> {
  if (subscriptionId) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId)
    } catch (error) {
      if (!isStripeMissing(error)) throw error
      log.warn('Stripe subscription no longer exists', { subscriptionId })
    }
  }
  if (!customerId) return null
  const listed = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
  return pickStripeSubscription(listed.data)
}

export async function resolveLiveEntitlement(userId: string, billingHint?: UserBilling | null): Promise<EntitlementRecord> {
  const cached = liveEntitlementCache.get(userId)
  if (cached && Date.now() - cached.at < LIVE_PLAN_TTL_MS) return cached.value

  const { entitlementFromBilling, getUserBilling, persistLiveBilling, unpaidEntitlement, syncUserBilling } = await import('./pocketbase.js')
  const [subscription, billing] = await Promise.all([
    getSubscription(userId),
    billingHint !== undefined ? Promise.resolve(billingHint) : getUserBilling(userId),
  ])
  const subscriptionId = subscription?.stripeSubscriptionId || billing?.stripeSubscriptionId
  const customerId = subscription?.stripeCustomerId || billing?.stripeCustomerId

  let stripeSub: Stripe.Subscription | null = null
  let stripeReachable = !subscriptionId && !customerId
  try {
    if (subscriptionId || customerId) {
      stripeSub = await fetchStripeSubscription(subscriptionId, customerId)
      stripeReachable = true
    }
  } catch (error) {
    stripeReachable = false
    log.warn('Stripe live plan lookup failed', { user: userId, err: String(error) })
  }

  if (stripeSub) {
    const mapped = planFromStripeSubscription(stripeSub)
    const entitlement: EntitlementRecord = {
      id: billing?.id ?? userId,
      user: userId,
      plan: mapped.plan,
      status: mapped.planStatus,
      expiresAt: mapped.currentPeriodEnd,
      created: billing?.created ?? '',
      updated: new Date().toISOString(),
    }
    liveEntitlementCache.set(userId, { at: Date.now(), value: entitlement })
    void persistLiveBilling(userId, mapped).catch((error) => {
      log.warn('Could not persist live Stripe plan', { user: userId, err: String(error) })
    })
    return entitlement
  }

  if (stripeReachable && (subscriptionId || customerId)) {
    const unpaid = unpaidEntitlement(userId, {
      id: billing?.id,
      created: billing?.created,
      updated: new Date().toISOString(),
    })
    liveEntitlementCache.set(userId, { at: Date.now(), value: unpaid })
    void syncUserBilling(userId, { plan: 'free', planStatus: 'unpaid' }).catch((error) => {
      log.warn('Could not persist unpaid plan', { user: userId, err: String(error) })
    })
    return unpaid
  }

  const fallback = entitlementFromBilling(billing, userId)
  liveEntitlementCache.set(userId, { at: Date.now(), value: fallback })
  return fallback
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: PaidPlan,
  urls?: { successUrl?: string; cancelUrl?: string },
): Promise<{ url: string }> {
  let customerId: string | undefined
  const existing = await getSubscription(userId)
  if (existing?.stripeCustomerId) {
    customerId = existing.stripeCustomerId
  } else {
    const customer = await stripe.customers.create({ email })
    customerId = customer.id
    const { syncUserBilling } = await import('./pocketbase.js')
    await syncUserBilling(userId, { stripeCustomerId: customerId })
  }
  const priceId = config.stripe.priceIds[plan]
  if (!priceId) throw new Error('Invalid plan selected')
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: urls?.successUrl ?? `${config.app.url}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: urls?.cancelUrl ?? `${config.app.url}/dashboard/subscription?billing=cancel`,
      client_reference_id: userId,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
    })
    return { url: session.url ?? `${config.app.url}/billing/error` }
  } catch (error) {
    throw missingPriceError(plan, priceId, error)
  }
}

export async function createCustomerPortalSession(
  userId: string,
  options: { action?: 'manage' | 'cancel' | 'upgrade'; plan?: Plan } = {},
): Promise<{ url: string }> {
  const sub = await getSubscription(userId)
  if (!sub?.stripeCustomerId) throw new Error('No billing account yet. Subscribe first.')

  const returnUrl = `${config.app.url}/dashboard/subscription`
  const action = options.action ?? 'manage'

  if (action === 'cancel') {
    if (!sub.stripeSubscriptionId) throw new Error('No active subscription to cancel.')
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
      flow_data: {
        type: 'subscription_cancel',
        subscription_cancel: { subscription: sub.stripeSubscriptionId },
      },
    })
    return { url: session.url }
  }

  if (action === 'upgrade') {
    const target = isCheckoutPlan(options.plan) ? options.plan : null
    const priceId = target ? config.stripe.priceIds[target] : ''
    if (sub.stripeSubscriptionId && priceId) {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
      const itemId = stripeSub.items.data[0]?.id
      if (itemId) {
        const session = await stripe.billingPortal.sessions.create({
          customer: sub.stripeCustomerId,
          return_url: returnUrl,
          flow_data: {
            type: 'subscription_update_confirm',
            subscription_update_confirm: {
              subscription: sub.stripeSubscriptionId,
              items: [{ id: itemId, price: priceId, quantity: 1 }],
            },
          },
        })
        return { url: session.url }
      }
    }
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  })
  return { url: session.url }
}

export async function listPaidPlanPrices(): Promise<Array<{
  id: PaidPlan
  priceId: string
  amount: number | null
  currency: string
  interval: string
}>> {
  return Promise.all(CHECKOUT_PLANS.map(async (id) => {
    const priceId = config.stripe.priceIds[id]
    const interval = id === 'weekly' ? 'week' : id === 'yearly' ? 'year' : 'month'
    if (!priceId) return { id, priceId: '', amount: null, currency: 'usd', interval }
    try {
      const price = await stripe.prices.retrieve(priceId)
      return {
        id,
        priceId,
        amount: price.unit_amount ?? null,
        currency: price.currency ?? 'usd',
        interval: price.recurring?.interval ?? interval,
      }
    } catch {
      return { id, priceId, amount: null, currency: 'usd', interval }
    }
  }))
}

export async function finalizeCheckoutSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
  if (session.metadata?.userId && session.metadata.userId !== userId) return false
  if (session.status !== 'complete' && session.payment_status !== 'paid') return false
  const sub = session.subscription
  if (!sub) return session.payment_status === 'paid'
  const full = typeof sub === 'string' ? await stripe.subscriptions.retrieve(sub) : sub
  if (!full.metadata?.userId) full.metadata = { ...full.metadata, userId }
  await syncSubscriptionFromStripe(full)
  return true
}

export async function syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription): Promise<void> {
  let userId: string | undefined = stripeSubscription.metadata?.userId
  if (!userId) {
    const customer = typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id
    const subs = await stripe.checkout.sessions.list({ customer, limit: 1 })
    userId = subs.data[0]?.metadata?.userId
  }
  if (!userId) return
  const mapped = planFromStripeSubscription(stripeSubscription)
  await upsertSubscription(userId, {
    stripeCustomerId: mapped.stripeCustomerId,
    stripeSubscriptionId: mapped.stripeSubscriptionId,
    priceId: mapped.priceId,
    status: mapped.status,
    currentPeriodStart: mapped.currentPeriodStart,
    currentPeriodEnd: mapped.currentPeriodEnd,
    cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
  })
  await syncUserBilling(userId, {
    plan: mapped.plan,
    planStatus: mapped.planStatus,
    expiresAt: mapped.currentPeriodEnd,
  })
  invalidateLiveEntitlement(userId)
}

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.subscription && typeof session.subscription === 'string') {
        const sub = await stripe.subscriptions.retrieve(session.subscription)
        await syncSubscriptionFromStripe(sub)
      }
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription)
      break
    case 'invoice.paid':
    case 'invoice.payment_failed':
      // handled by subscription.updated events generally
      break
    default:
      break
  }
}

export type BillingInvoice = {
  id: string
  number: string | null
  created: string
  amount: number
  currency: string
  status: string
  hostedUrl: string | null
  pdfUrl: string | null
  periodStart: string
  periodEnd: string
}

export type BillingPaymentMethod = {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export type BillingOverview = {
  invoices: BillingInvoice[]
  paymentMethod: BillingPaymentMethod | null
  nextPayment: { amount: number; currency: string; date: string } | null
}

type StripeInvoiceLike = {
  id?: string | null
  number?: string | null
  created?: number | null
  amount_paid?: number | null
  amount_due?: number | null
  total?: number | null
  currency?: string | null
  status?: string | null
  hosted_invoice_url?: string | null
  invoice_pdf?: string | null
  period_start?: number | null
  period_end?: number | null
}

export function publicInvoice(invoice: StripeInvoiceLike): BillingInvoice | null {
  const id = invoice.id
  if (!id || invoice.status === 'draft') return null
  const paid = invoice.status === 'paid'
  const amount = paid ? (invoice.amount_paid ?? invoice.total ?? 0) : (invoice.amount_due ?? invoice.total ?? 0)
  return {
    id,
    number: invoice.number ?? null,
    created: unixToIso(invoice.created),
    amount,
    currency: invoice.currency ?? 'usd',
    status: invoice.status ?? 'open',
    hostedUrl: invoice.hosted_invoice_url ?? null,
    pdfUrl: invoice.invoice_pdf ?? null,
    periodStart: unixToIso(invoice.period_start),
    periodEnd: unixToIso(invoice.period_end),
  }
}

function cardFromPaymentMethod(method: Stripe.PaymentMethod | string | null | undefined): BillingPaymentMethod | null {
  if (!method || typeof method === 'string' || !method.card) return null
  return {
    brand: method.card.brand || 'card',
    last4: method.card.last4 || '',
    expMonth: method.card.exp_month || 0,
    expYear: method.card.exp_year || 0,
  }
}

async function nextInvoicePreview(customerId: string, subscriptionId?: string): Promise<BillingOverview['nextPayment']> {
  try {
    const invoices = stripe.invoices as unknown as {
      createPreview?: (params: { customer: string; subscription?: string }) => Promise<Stripe.Invoice>
      retrieveUpcoming?: (params: { customer: string; subscription?: string }) => Promise<Stripe.Invoice>
    }
    const params = { customer: customerId, subscription: subscriptionId }
    const invoice = invoices.createPreview
      ? await invoices.createPreview(params)
      : invoices.retrieveUpcoming
        ? await invoices.retrieveUpcoming(params)
        : null
    if (!invoice) return null
    const amount = invoice.amount_due ?? invoice.total ?? 0
    const nextAttempt = 'next_payment_attempt' in invoice ? Number(invoice.next_payment_attempt) : 0
    const date = unixToIso(invoice.period_end || nextAttempt || invoice.created)
    if (!amount || !date) return null
    return { amount, currency: invoice.currency ?? 'usd', date }
  } catch {
    return null
  }
}

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const sub = await getSubscription(userId)
  const customerId = sub?.stripeCustomerId
  if (!customerId) return { invoices: [], paymentMethod: null, nextPayment: null }

  const [invoiceList, methods, nextPayment] = await Promise.all([
    stripe.invoices.list({ customer: customerId, limit: 24 }),
    stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 3 }),
    nextInvoicePreview(customerId, sub.stripeSubscriptionId || undefined),
  ])

  const invoices = invoiceList.data.map(publicInvoice).filter((item): item is BillingInvoice => Boolean(item))
  const paymentMethod = cardFromPaymentMethod(methods.data[0])
  return { invoices, paymentMethod, nextPayment }
}
