import { useEffect, useState } from 'react'
import { Ban, Check, CreditCard, Wallet } from 'lucide-react'
import { ONE_TIME_PLAN_CATALOG, SUBSCRIPTION_PLAN_CATALOG, isCheckoutPlan, isOneTimePlan, isPaidPlan, isRecurringPlan, planDisplayName, planIntervalLabel, splitPrice, type PaidPlan, type PlanCatalogItem } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { formatMemoryDate } from '@/lib/format'
import { useAuthStore } from '@/store/auth-store'
import type { BillingPlanPrice, Subscription as BillingSubscription } from '@/types/api'

type PlanTab = 'one_time' | 'subscription'

export function Subscription() {
  const entitlement = useAuthStore((state) => state.entitlement)
  const checkout = useAuthStore((state) => state.checkout)
  const openBilling = useAuthStore((state) => state.openBilling)
  const plan = entitlement?.plan
  const paid = isPaidPlan(plan, entitlement?.status)
  const [billing, setBilling] = useState<BillingSubscription | null>(null)
  const [overview, setOverview] = useState<{ paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null }>({ paymentMethod: null })
  const [prices, setPrices] = useState<Partial<Record<PaidPlan, BillingPlanPrice>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [tab, setTab] = useState<PlanTab>(isOneTimePlan(plan) ? 'one_time' : 'subscription')

  useEffect(() => {
    void api.billing.subscription().then(setBilling).catch(() => setBilling(null))
    void api.billing.overview().then((result) => setOverview({ paymentMethod: result.paymentMethod })).catch(() => undefined)
    void api.billing.plans()
      .then((result) => {
        const next: Partial<Record<PaidPlan, BillingPlanPrice>> = {}
        for (const item of result.plans ?? []) {
          if (isCheckoutPlan(item.id)) next[item.id] = item
        }
        setPrices(next)
      })
      .catch(() => setPrices({}))
  }, [])

  const run = async (key: string, work: () => Promise<unknown>, message: string) => {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await work()
      setStatus(message)
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Could not open billing in the browser.')
    } finally {
      setBusy(null)
    }
  }

  const choosePlan = (target: PaidPlan) => {
    if (isRecurringPlan(target) && paid && billing?.stripeCustomerId && isRecurringPlan(plan)) {
      if (target === plan) {
        void run('manage', () => openBilling('manage'), 'Opened billing in your browser.')
        return
      }
      void run(`plan-${target}`, () => openBilling('upgrade', target), 'Opened the plan change in your browser.')
      return
    }
    void run(`plan-${target}`, () => checkout(target), 'Opened checkout in your browser.')
  }

  const period = billing?.currentPeriodEnd ? formatMemoryDate(billing.currentPeriodEnd) : ''
  const canceling = Boolean(paid && billing?.cancelAtPeriodEnd)
  const hasCustomer = Boolean(billing?.stripeCustomerId)
  const currentName = paid ? planDisplayName(plan) : planDisplayName(plan === 'free' || !plan ? 'free' : plan)
  const currentItem = [...ONE_TIME_PLAN_CATALOG, ...SUBSCRIPTION_PLAN_CATALOG].find((item) => item.id === (plan ?? 'free'))
  const amount = (plan && isCheckoutPlan(plan) ? prices[plan]?.amount : null) ?? currentItem?.fallbackAmount ?? 0
  const { dollars, cents } = splitPrice(amount)
  const remaining = entitlement?.interviewCredits
  const currentDetail = entitlement?.freeAccess
    ? 'Complimentary access'
    : !paid
    ? remaining
      ? `${remaining} interview session${remaining === 1 ? '' : 's'} left`
      : 'Choose a one-time pack or a subscription.'
    : isOneTimePlan(plan)
    ? remaining
      ? `${remaining} interview session${remaining === 1 ? '' : 's'} left`
      : 'No interview sessions left'
    : canceling && period
      ? `Access continues until ${period}`
      : entitlement?.status === 'past_due'
        ? 'Payment past due'
        : entitlement?.status === 'trialing'
          ? period ? `Trial · ${period}` : 'Trial'
          : period
            ? `Renews ${period}`
            : (entitlement?.status ?? 'Active')

  const catalog = tab === 'one_time' ? ONE_TIME_PLAN_CATALOG : SUBSCRIPTION_PLAN_CATALOG

  return (
    <div className="space-y-6">
      <p className="text-[12px] leading-relaxed text-muted">
        Unlimited interview sessions on a subscription, or pay once for a session pack.
      </p>

      <section className="rounded-md bg-surface-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 shrink-0 text-muted" />
              <p className="text-[14px] font-medium">{currentName}</p>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{currentDetail}</p>
          </div>
          {paid && amount ? (
            <p className="shrink-0 text-[13px] font-medium tabular-nums">${dollars}.{cents}</p>
          ) : null}
        </div>
        {hasCustomer ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={Boolean(busy)} loading={busy === 'manage'} onClick={() => void run('manage', () => openBilling('manage'), 'Opened billing in your browser.')}>
              <Wallet className="h-3.5 w-3.5" />
              Manage
            </Button>
            {paid && !canceling ? (
              <Button variant="danger" size="sm" disabled={Boolean(busy)} loading={busy === 'cancel'} onClick={() => void run('cancel', () => openBilling('cancel'), 'Opened cancellation in your browser.')}>
                <Ban className="h-3.5 w-3.5" />
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {hasCustomer ? (
        <section className="rounded-md bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Payment</p>
          <p className="mt-1 text-[13px] font-medium">
            {overview.paymentMethod
              ? `${capitalize(overview.paymentMethod.brand)} ···· ${overview.paymentMethod.last4}`
              : 'No card on file'}
          </p>
          {overview.paymentMethod ? (
            <p className="mt-0.5 text-[12px] text-muted">
              Expires {String(overview.paymentMethod.expMonth).padStart(2, '0')}/{overview.paymentMethod.expYear}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <PlanTabs value={tab} onChange={setTab} />
        <div className="mt-3 space-y-2">
          {catalog.map((item) => (
            <PlanPick
              key={item.id}
              item={item}
              current={item.id === 'free' ? (plan ?? 'free') === 'free' : paid && plan === item.id}
              amount={item.id === 'free' ? 0 : (isCheckoutPlan(item.id) ? prices[item.id]?.amount : null) ?? item.fallbackAmount}
              busy={busy}
              onChoose={item.id === 'free' ? undefined : choosePlan}
            />
          ))}
        </div>
      </section>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted">{status}</p> : null}
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
    <div role="tablist" aria-label="Plan type" className="mx-auto flex w-fit rounded-md bg-surface-2 p-0.5">
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
        'h-8 rounded-md px-3 text-[12px] font-medium',
        selected ? 'bg-raised text-fg' : 'text-muted hover:text-fg',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function PlanPick({
  item,
  current,
  amount,
  busy,
  onChoose,
}: {
  item: PlanCatalogItem
  current: boolean
  amount: number
  busy: string | null
  onChoose?: (id: PaidPlan) => void
}) {
  const price = splitPrice(amount)
  const actionKey = `plan-${item.id}`
  const actionLabel = current ? 'Current plan' : item.action
  const checkoutId = item.id !== 'free' && isCheckoutPlan(item.id) ? item.id : null
  return (
    <div
      className={cn(
        'rounded-md p-3',
        current || item.featured ? 'bg-surface-2 ring-1 ring-accent' : 'bg-surface-2',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{item.name}</p>
        {current ? (
          <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-ok">Current</span>
        ) : item.badge ? (
          <span className="rounded-md bg-accent-fill px-1.5 py-0.5 text-[10px] font-medium text-accent-fill-fg">
            {item.badge}
          </span>
        ) : null}
      </div>
      {amount <= 0 ? (
        <p className="mt-2 text-[20px] font-semibold">Free</p>
      ) : (
        <p className="mt-2 flex items-baseline leading-none">
          <span className="text-[14px] font-medium">$</span>
          <span className="text-[26px] font-semibold tracking-tight tabular-nums">{price.dollars}</span>
          <span className="text-[12px] text-muted">.{price.cents}</span>
          <span className="ml-1.5 text-[12px] font-normal text-muted">/{planIntervalLabel(item.interval)}</span>
        </p>
      )}
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{item.description}</p>
      <ul className="mt-2.5 space-y-1.5">
        {item.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2 text-[12px] leading-relaxed">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="text-fg">{feature.text}</span>
          </li>
        ))}
      </ul>
      {checkoutId && onChoose ? (
        <Button
          className="mt-3 w-full"
          size="sm"
          variant={current ? 'outline' : item.featured ? 'default' : 'outline'}
          disabled={Boolean(busy) || current}
          loading={busy === actionKey}
          onClick={() => onChoose(checkoutId)}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}
