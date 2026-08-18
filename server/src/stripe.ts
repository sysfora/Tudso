import Stripe from 'stripe'
import { config } from './config.js'
import { getSubscription, upsertEntitlement, upsertSubscription } from './pocketbase.js'
import { PLAN_FEATURES } from './plans.js'
import type { EntitlementRecord, Plan, SubscriptionRecord } from './types.js'

export const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2025-02-24.acacia' })

export function priceIdToPlan(priceId: string): Plan {
  if (priceId === config.stripe.priceIds.pro) return 'pro'
  if (priceId === config.stripe.priceIds.premium) return 'premium'
  return 'free'
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: Plan,
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
  if (!priceId || plan === 'free') throw new Error('Invalid plan selected')
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: urls?.successUrl ?? `${config.app.url}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: urls?.cancelUrl ?? `${config.app.url}/billing/cancel`,
    client_reference_id: userId,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  })
  return { url: session.url ?? `${config.app.url}/billing/error` }
}

export async function createCustomerPortalSession(
  userId: string,
  options: { action?: 'manage' | 'cancel' | 'upgrade'; plan?: Plan } = {},
): Promise<{ url: string }> {
  const sub = await getSubscription(userId)
  if (!sub?.stripeCustomerId) throw new Error('No billing account yet. Subscribe first.')

  const returnUrl = `${config.app.url}/billing/return`
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
    const target: Plan = options.plan === 'pro' ? 'pro' : 'premium'
    const priceId = config.stripe.priceIds[target]
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
  id: 'pro' | 'premium'
  priceId: string
  amount: number | null
  currency: string
  interval: string
}>> {
  const ids = [
    ['pro', config.stripe.priceIds.pro],
    ['premium', config.stripe.priceIds.premium],
  ] as const
  return Promise.all(ids.map(async ([id, priceId]) => {
    if (!priceId) return { id, priceId: '', amount: null, currency: 'usd', interval: 'month' }
    try {
      const price = await stripe.prices.retrieve(priceId)
      return {
        id,
        priceId,
        amount: price.unit_amount ?? null,
        currency: price.currency ?? 'usd',
        interval: price.recurring?.interval ?? 'month',
      }
    } catch {
      return { id, priceId, amount: null, currency: 'usd', interval: 'month' }
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
  const priceId = stripeSubscription.items.data[0]?.price.id ?? ''
  const plan = priceIdToPlan(priceId)
  const subStatus = stripeSubscription.status as SubscriptionRecord['status']
  const entitlementStatus: EntitlementRecord['status'] =
    subStatus === 'incomplete' || subStatus === 'incomplete_expired' ? 'unpaid' : subStatus
  const subscription = await upsertSubscription(userId, {
    stripeCustomerId: typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id,
    stripeSubscriptionId: stripeSubscription.id,
    priceId,
    status: subStatus,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  })
  const features = PLAN_FEATURES[plan]
  await upsertEntitlement(userId, {
    plan,
    status: entitlementStatus,
    ...features,
    expiresAt: subscription.currentPeriodEnd,
  })
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
