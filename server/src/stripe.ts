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

export async function createCheckoutSession(userId: string, email: string, plan: Plan): Promise<{ url: string }> {
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
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${config.app.url}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.app.url}/billing/cancel`,
    metadata: { userId },
  })
  return { url: session.url ?? `${config.app.url}/billing/error` }
}

export async function createCustomerPortalSession(userId: string): Promise<{ url: string }> {
  const sub = await getSubscription(userId)
  if (!sub?.stripeCustomerId) throw new Error('No Stripe customer found')
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${config.app.url}/billing/return`,
  })
  return { url: session.url }
}

export async function syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription): Promise<void> {
  const userId = stripeSubscription.metadata?.userId
  if (!userId) {
    // try to find by customer
    const customer = typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id
    const subs = await stripe.checkout.sessions.list({ customer, limit: 1 })
    const sessionUserId = subs.data[0]?.metadata?.userId
    if (!sessionUserId) return
  }
  const userIdResolved = userId as string
  const priceId = stripeSubscription.items.data[0]?.price.id ?? ''
  const plan = priceIdToPlan(priceId)
  const subStatus = stripeSubscription.status as SubscriptionRecord['status']
  const entitlementStatus: EntitlementRecord['status'] =
    subStatus === 'incomplete' || subStatus === 'incomplete_expired' ? 'unpaid' : subStatus
  const subscription = await upsertSubscription(userIdResolved, {
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
  await upsertEntitlement(userIdResolved, {
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
