import { useEffect, useState } from 'react'
import { Ban, Check, CreditCard, ExternalLink, Receipt, Wallet } from 'lucide-react'
import { PAID_PLAN_CATALOG, isCheckoutPlan, isPaidPlan, planDisplayName, splitPrice, type PaidPlan } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import { formatMemoryDate } from '@/lib/format'
import { useAuthStore } from '@/store/auth-store'
import type { BillingPlanPrice, Subscription as BillingSubscription } from '@/types/api'

type Overview = Awaited<ReturnType<typeof api.billing.overview>>

export function Subscription() {
  const entitlement = useAuthStore((state) => state.entitlement)
  const checkout = useAuthStore((state) => state.checkout)
  const openBilling = useAuthStore((state) => state.openBilling)
  const plan = entitlement?.plan
  const paid = isPaidPlan(plan, entitlement?.status)
  const [billing, setBilling] = useState<BillingSubscription | null>(null)
  const [overview, setOverview] = useState<Overview>({ invoices: [], paymentMethod: null, nextPayment: null })
  const [prices, setPrices] = useState<Partial<Record<PaidPlan, BillingPlanPrice>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    void api.billing.subscription().then(setBilling).catch(() => setBilling(null))
    void api.billing.overview().then(setOverview).catch(() => undefined)
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
    if (paid && billing?.stripeCustomerId) {
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
  const currentName = paid ? planDisplayName(plan) : 'No plan'
  const currentItem = PAID_PLAN_CATALOG.find((item) => item.id === plan)
  const amount = (plan && isCheckoutPlan(plan) ? prices[plan]?.amount : null) ?? currentItem?.fallbackAmount ?? 0
  const { dollars, cents } = splitPrice(amount)
  const currentDetail = entitlement?.freeAccess
    ? 'Complimentary access'
    : !paid
    ? 'Subscribe in the browser to start a plan.'
    : canceling && period
      ? `Access continues until ${period}`
      : entitlement?.status === 'past_due'
        ? 'Payment past due'
        : entitlement?.status === 'trialing'
          ? period ? `Trial · ${period}` : 'Trial'
          : period
            ? `Renews ${period}`
            : (entitlement?.status ?? 'Active')

  return (
    <div className="space-y-6">
      <p className="text-[12px] leading-relaxed text-muted">
        Unlimited call time and real-time answers. Subscribe, change, or cancel in the browser.
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
        <div className="grid gap-2 sm:grid-cols-2">
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
          <section className="rounded-md bg-surface-2 px-3 py-2.5">
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Next invoice</p>
            <p className="mt-1 text-[13px] font-medium tabular-nums">
              {overview.nextPayment ? formatMoney(overview.nextPayment.amount, overview.nextPayment.currency) : period ? period : 'None'}
            </p>
            {overview.nextPayment ? (
              <p className="mt-0.5 text-[12px] text-muted">Due {formatMemoryDate(overview.nextPayment.date)}</p>
            ) : null}
          </section>
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Plans</h3>
        <div className="space-y-2">
          {PAID_PLAN_CATALOG.map((item) => {
            const current = paid && plan === item.id
            const planAmount = prices[item.id]?.amount ?? item.fallbackAmount
            const price = splitPrice(planAmount)
            const perMonth = item.interval === 'year' ? splitPrice(Math.round(planAmount / 12)) : null
            const actionKey = `plan-${item.id}`
            const actionLabel = current ? 'Current plan' : paid ? `Switch to ${item.name}` : item.action
            return (
              <div
                key={item.id}
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
                <p className="mt-2 flex items-baseline leading-none">
                  <span className="text-[14px] font-medium">$</span>
                  <span className="text-[26px] font-semibold tracking-tight tabular-nums">{price.dollars}</span>
                  <span className="text-[12px] text-muted">.{price.cents}</span>
                  <span className="ml-1.5 text-[12px] font-normal text-muted">/{item.interval}</span>
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  {perMonth ? `Equals $${perMonth.dollars}.${perMonth.cents} / month, billed yearly.` : item.description}
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {item.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2 text-[12px] leading-relaxed">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="text-fg">{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant={current ? 'outline' : item.featured ? 'default' : 'outline'}
                  disabled={Boolean(busy) || current}
                  loading={busy === actionKey}
                  onClick={() => choosePlan(item.id)}
                >
                  {actionLabel}
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Invoices</h3>
        {!hasCustomer || overview.invoices.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] leading-relaxed text-muted">
            {hasCustomer ? 'No invoices yet. They appear after Stripe charges the plan.' : 'Invoices appear here after you subscribe.'}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
            {overview.invoices.map((invoice) => {
              const href = invoice.hostedUrl || invoice.pdfUrl
              return (
                <li key={invoice.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {invoice.number || 'Invoice'}
                        <span className="ml-1.5 font-normal text-muted">{formatMemoryDate(invoice.created)}</span>
                      </p>
                      <p className={cn('mt-0.5 text-[12px]', invoice.status === 'paid' ? 'text-ok' : 'text-muted')}>
                        {invoice.status === 'paid' ? 'Paid' : invoice.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="text-[13px] font-medium tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</p>
                    {href ? (
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-lift hover:text-fg"
                        aria-label="Open invoice"
                        onClick={() => void desktop.app.openExternal(href)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted">{status}</p> : null}
    </div>
  )
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)
  } catch {
    return `$${(amount / 100).toFixed(2)}`
  }
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}
