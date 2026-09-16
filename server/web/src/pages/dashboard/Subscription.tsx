import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  CreditCard,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PricingPlanCard, PricingPlanTabs } from '@/components/PricingCards'
import {
  api,
  type BillingOverview,
  type Entitlement,
  type Subscription,
} from '@/lib/api'
import { ONE_TIME_PLAN_CATALOG, SUBSCRIPTION_PLAN_CATALOG, isCheckoutPlan, isOneTimePlan, isPaidPlan, isRecurringPlan, planDisplayName, planIntervalLabel, type PaidPlan } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { SkeletonBar } from '@/components/app/Loader'

type PlanTab = 'one_time' | 'subscription'

export default function SubscriptionPage() {
  const [params] = useSearchParams()
  const [entitlement, setEntitlement] = React.useState<Entitlement | null>(null)
  const [billing, setBilling] = React.useState<Subscription | null>(null)
  const [overview, setOverview] = React.useState<BillingOverview>({ invoices: [], paymentMethod: null, nextPayment: null })
  const [prices, setPrices] = React.useState<Partial<Record<PaidPlan, { amount: number | null; currency: string; interval: string }>>>({})
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)
  const [tab, setTab] = React.useState<PlanTab | null>(null)

  React.useEffect(() => {
    void Promise.all([
      api.dashboard().then((data) => {
        setEntitlement(data.entitlement)
        setBilling(data.subscription)
      }).catch(() => undefined),
      api.plans().then((result) => {
        const next: Partial<Record<PaidPlan, { amount: number | null; currency: string; interval: string }>> = {}
        for (const item of result.plans ?? []) {
          if (isCheckoutPlan(item.id)) next[item.id] = item
        }
        setPrices(next)
      }).catch(() => undefined),
      api.billingOverview().then(setOverview).catch(() => undefined),
    ]).finally(() => setReady(true))
  }, [])

  const paid = isPaidPlan(entitlement?.plan, entitlement?.status)
  const plan = entitlement?.plan
  const activeTab = tab ?? (isOneTimePlan(plan) ? 'one_time' : 'subscription')
  const catalog = activeTab === 'one_time' ? ONE_TIME_PLAN_CATALOG : SUBSCRIPTION_PLAN_CATALOG
  const currentItem = [...ONE_TIME_PLAN_CATALOG, ...SUBSCRIPTION_PLAN_CATALOG].find((item) => item.id === plan)
  const amount = (plan && isCheckoutPlan(plan) ? prices[plan]?.amount : null) ?? currentItem?.fallbackAmount ?? 0
  const period = billing?.currentPeriodEnd ? formatDate(billing.currentPeriodEnd) : (entitlement?.expiresAt ? formatDate(entitlement.expiresAt) : '')
  const canceling = Boolean(paid && billing?.cancelAtPeriodEnd)
  const hasCustomer = Boolean(billing?.stripeCustomerId)
  const currentName = planDisplayName(plan)
  const remaining = entitlement?.interviewCredits
  const currentDetail = entitlement?.freeAccess
    ? 'Complimentary access. Same unlimited features as a paid plan.'
    : !paid
      ? remaining
        ? `${remaining} interview session${remaining === 1 ? '' : 's'} left`
        : 'Choose a one-time pack or a subscription. Same plans as the Tudso app.'
      : isOneTimePlan(plan)
        ? remaining
          ? `${remaining} interview session${remaining === 1 ? '' : 's'} left`
          : 'No interview sessions left'
      : canceling && period
        ? `Access continues until ${period}. You can resubscribe anytime.`
        : entitlement?.status === 'past_due'
          ? 'Update your payment method to keep access.'
          : entitlement?.status === 'trialing'
            ? period ? `Trial ends ${period}` : 'Trial'
            : period
              ? `Renews ${period}`
              : 'Active'

  const billingNote = params.get('billing') === 'success'
    ? { tone: 'ok' as const, text: 'Payment complete. Your plan updates in a moment.' }
    : params.get('billing') === 'cancel'
      ? { tone: 'muted' as const, text: 'Checkout was canceled.' }
      : null

  const run = async (key: string, work: () => Promise<unknown>, message: string) => {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await work()
      setStatus(message)
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Could not open billing.')
    } finally {
      setBusy(null)
    }
  }

  const openUrl = async (work: () => Promise<{ url: string }>) => {
    const { url } = await work()
    window.location.assign(url)
  }

  const choosePlan = (target: PaidPlan) => {
    if (isRecurringPlan(target) && paid && billing?.stripeCustomerId && isRecurringPlan(plan)) {
      if (target === plan) {
        void run('manage', () => openUrl(() => api.portal('manage')), 'Opened billing.')
        return
      }
      void run(`plan-${target}`, () => openUrl(() => api.portal('upgrade', target)), 'Opened the plan change.')
      return
    }
    void run(`plan-${target}`, () => openUrl(() => api.checkout(target)), 'Opened checkout.')
  }

  const chooseFreePlan = () => {
    void run('plan-free', async () => {
      const result = await api.activateFreePlan()
      setEntitlement((current) => current ? { ...current, plan: result.plan, interviewCredits: result.interviewCredits } : current)
    }, 'Free plan activated.')
  }

  if (!ready) return <SubscriptionSkeleton />

  return (
    <div className="dashboard-page space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Plans & access</p>
          <h1 className="mt-2 text-4xl tracking-tight sm:text-5xl">Choose your edge.</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Unlimited interview sessions on a subscription, or pay once for a session pack.
          </p>
        </div>
        {billingNote ? (
          <p className={cn('inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px]', billingNote.tone === 'ok' ? 'text-ok' : 'text-muted-foreground')}>
            {billingNote.tone === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {billingNote.text}
          </p>
        ) : null}
      </div>

      <section className="dashboard-surface dashboard-tint-lavender">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="font-display text-3xl tracking-tight">{currentName}</p>
              <StatusPill status={entitlement?.status} paid={paid} canceling={canceling} complimentary={Boolean(entitlement?.freeAccess)} />
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{currentDetail}</p>
          </div>
          {paid && amount ? (
            <p className="flex items-start leading-none">
              <span className="text-lg font-medium">$</span>
              <span className="font-display text-4xl tracking-tight tabular-nums">{Math.floor(amount / 100)}</span>
              <span className="mt-1 text-[12px] text-muted-foreground">.{String(amount % 100).padStart(2, '0')}{currentItem ? <span className="ml-1 font-normal">/{planIntervalLabel(currentItem.interval)}</span> : null}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {hasCustomer ? (
            <Button variant="fill" size="compact" disabled={Boolean(busy)} loading={busy === 'manage'} onClick={() => void run('manage', () => openUrl(() => api.portal('manage')), 'Opened billing.')}>
              <Wallet className="h-3.5 w-3.5" />
              Manage billing
            </Button>
          ) : (
            <Button variant="fill" size="compact" onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Choose a plan
            </Button>
          )}
          {paid && hasCustomer && !canceling ? (
            <Button variant="danger" size="compact" disabled={Boolean(busy)} loading={busy === 'cancel'} onClick={() => void run('cancel', () => openUrl(() => api.portal('cancel')), 'Opened cancellation.')}>
              <Ban className="h-3.5 w-3.5" />
              Cancel
            </Button>
          ) : null}
        </div>
      </section>

      {hasCustomer ? (
        <section className="dashboard-surface dashboard-tint-yellow">
            <p className="font-display text-2xl tracking-tight">Payment method</p>
          {overview.paymentMethod ? (
            <div className="mt-2 flex items-start gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-raised">
                <CreditCard className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[13px] font-medium capitalize">
                  {overview.paymentMethod.brand} ···· {overview.paymentMethod.last4}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Expires {String(overview.paymentMethod.expMonth).padStart(2, '0')}/{overview.paymentMethod.expYear}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">No card on file yet. Add one when you subscribe.</p>
          )}
        </section>
      ) : null}

      <section id="plans">
        <PricingPlanTabs landingStyle value={activeTab === 'one_time' ? 'one_time' : 'subscription'} onChange={setTab} />
        <div className={cn('mt-4 grid min-w-0 items-stretch gap-4 sm:gap-5', activeTab === 'one_time' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')}>
          {catalog.map((item) => (
            <PricingPlanCard
              key={`${activeTab}-${item.id}`}
              item={item}
              amount={item.id === 'free' ? 0 : (isCheckoutPlan(item.id) ? prices[item.id]?.amount : null) ?? item.fallbackAmount}
              badge={item.id === plan ? 'Current' : null}
              actionLabel={item.id === plan ? 'Current plan' : item.action}
              buttonVariant={item.featured ? 'default' : 'outline'}
              landingStyle
              disabled={Boolean(busy) || item.id === plan}
              loading={busy === `plan-${item.id}`}
              onAction={() => item.id === 'free' ? chooseFreePlan() : choosePlan(item.id)}
            />
          ))}
        </div>
      </section>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted-foreground">{status}</p> : null}
    </div>
  )
}

function StatusPill({
  status,
  paid,
  canceling,
  complimentary,
}: {
  status?: string
  paid: boolean
  canceling: boolean
  complimentary: boolean
}) {
  const label = complimentary
    ? 'Complimentary'
    : canceling
      ? 'Cancels at period end'
      : status === 'past_due'
        ? 'Past due'
        : status === 'trialing'
          ? 'Trial'
          : paid
            ? 'Active'
            : 'Inactive'
  const tone = complimentary || (paid && !canceling && status !== 'past_due')
    ? 'text-ok'
    : status === 'past_due'
      ? 'text-danger'
      : 'text-muted-foreground'
  return <span className={cn('rounded-md bg-raised px-2 py-0.5 text-[11px] font-medium', tone)}>{label}</span>
}

function SubscriptionSkeleton() {
  return (
    <div className="dashboard-page space-y-8" aria-busy="true" aria-label="Loading subscription">
      <div>
        <SkeletonBar className="h-5 w-32" />
        <SkeletonBar className="mt-2 h-3 w-80 max-w-full" delay={80} />
      </div>
      <div className="dashboard-surface dashboard-tint-lavender">
        <SkeletonBar className="h-4 w-28" />
        <SkeletonBar className="mt-2 h-3 w-56" delay={80} />
        <SkeletonBar className="mt-4 h-8 w-32" delay={140} />
      </div>
      <div className="dashboard-surface dashboard-tint-yellow">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="mt-3 h-4 w-40" delay={80} />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {['a', 'b', 'c'].map((key, index) => (
          <div key={key} className="rounded-3xl bg-card p-6">
            <SkeletonBar className="h-3 w-16" delay={index * 70} />
            <SkeletonBar className="mt-4 h-8 w-24" delay={80 + index * 70} />
            <SkeletonBar className="mt-3 h-3 w-40" delay={120 + index * 70} />
            <SkeletonBar className="mt-5 h-8 w-full" delay={160 + index * 70} />
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

