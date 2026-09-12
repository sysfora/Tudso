import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  CreditCard,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  api,
  type BillingOverview,
  type Entitlement,
  type Subscription,
} from '@/lib/api'
import { ONE_TIME_PLAN_CATALOG, SUBSCRIPTION_PLAN_CATALOG, isCheckoutPlan, isOneTimePlan, isPaidPlan, isRecurringPlan, planDisplayName, planIntervalLabel, splitPrice, type PaidPlan, type PlanCatalogItem } from '@/lib/plans'
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
  const { dollars, cents } = splitPrice(amount)
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
              <span className="font-display text-4xl tracking-tight tabular-nums">{dollars}</span>
              <span className="mt-1 text-[12px] text-muted-foreground">.{cents}{currentItem ? <span className="ml-1 font-normal">/{planIntervalLabel(currentItem.interval)}</span> : null}</span>
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
        <PlanTabs value={activeTab} onChange={setTab} />
        <div className={cn('mt-4 grid min-w-0 grid-cols-1 gap-4 md:items-stretch', activeTab === 'one_time' ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')}>
          {catalog.map((item) => (
            <DashPlanCard
              key={`${activeTab}-${item.id}`}
              data-plan-card
              item={item}
              current={item.id === 'free' ? (plan ?? 'free') === 'free' : paid && plan === item.id}
              amount={item.id === 'free' ? 0 : (isCheckoutPlan(item.id) ? prices[item.id]?.amount : null) ?? item.fallbackAmount}
              busy={busy}
              onChoose={item.id === 'free' ? undefined : choosePlan}
              onChooseFree={item.id === 'free' && plan === 'none' ? chooseFreePlan : undefined}
            />
          ))}
        </div>
      </section>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted-foreground">{status}</p> : null}
    </div>
  )
}

function PlanTabs({
  value,
  onChange,
}: {
  value: PlanTab
  onChange: (value: PlanTab) => void
}) {
  return (
    <div role="tablist" aria-label="Plan type" className="mx-auto flex w-fit rounded-full border border-border bg-card p-1">
      <TabButton selected={value === 'subscription'} onClick={() => onChange('subscription')}>Subscriptions</TabButton>
      <TabButton selected={value === 'one_time'} onClick={() => onChange('one_time')}>One-Time</TabButton>
    </div>
  )
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        'h-9 rounded-full px-4 text-[12px] font-medium transition-all duration-300 ease-out',
        selected ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary/10 hover:text-fg',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function DashPlanCard({
  item,
  current,
  amount,
  busy,
  onChoose,
  onChooseFree,
}: {
  item: PlanCatalogItem
  current: boolean
  amount: number
  busy: string | null
  onChoose?: (id: PaidPlan) => void
  onChooseFree?: () => void
}) {
  const price = splitPrice(amount)
  const checkoutId = item.id !== 'free' && isCheckoutPlan(item.id) ? item.id : null
  return (
    <div
      className={cn(
        'min-w-0 max-w-full flex flex-col rounded-3xl border p-6 transition-all duration-300 ease-out hover:-translate-y-1',
        current || item.featured ? 'border-accent bg-accent/20 shadow-lg shadow-accent/10 ring-1 ring-accent' : item.id === 'free' ? 'dashboard-tint-mint border-transparent' : item.id === 'plus' ? 'dashboard-tint-lavender border-transparent' : item.id === 'pro' ? 'dashboard-tint-pink border-transparent' : 'bg-card border-border hover:shadow-lg hover:shadow-secondary/10',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-2xl">{item.name}</p>
        {current ? (
          <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-ok">Current</span>
        ) : item.badge ? (
          <span className="rounded-md bg-accent-fill px-1.5 py-0.5 text-[10px] font-medium text-accent-fill-fg">
            {item.badge}
          </span>
        ) : null}
      </div>
      {amount <= 0 ? (
        <p className="mt-4 font-display text-3xl tracking-tight">Free</p>
      ) : (
        <p className="mt-3 flex items-baseline leading-none">
          <span className="text-[15px] font-medium">$</span>
          <span className="font-display text-4xl tracking-tight tabular-nums">{price.dollars}</span>
          <span className="text-[13px] text-muted-foreground">.{price.cents}</span>
          <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">/{planIntervalLabel(item.interval)}</span>
        </p>
      )}
      <p className="mt-2 min-w-0 break-words text-[12px] leading-relaxed text-muted-foreground">{item.description}</p>
      <ul className="mt-3 mb-4 flex-1 space-y-1.5">
        {item.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2 text-[12px] leading-relaxed">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="min-w-0 break-words">{feature.text}</span>
          </li>
        ))}
      </ul>
      {item.id === 'free' && onChooseFree ? (
        <Button
          className="w-full"
          size="compact"
          variant="fill"
          disabled={Boolean(busy)}
          loading={busy === 'plan-free'}
          onClick={onChooseFree}
        >
          Get started free
        </Button>
      ) : checkoutId && onChoose ? (
        <Button
          className="w-full"
          size="compact"
          variant={current ? 'soft' : item.featured ? 'fill' : 'soft'}
          disabled={Boolean(busy) || current}
          loading={busy === `plan-${item.id}`}
          onClick={() => onChoose(checkoutId)}
        >
          {current ? 'Current plan' : item.action}
        </Button>
      ) : null}
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

