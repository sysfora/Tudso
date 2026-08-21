import * as React from 'react'
import { Ban, Check, CreditCard, Receipt, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, type Entitlement, type Subscription } from '@/lib/api'
import { PAID_PLAN_CATALOG, isCheckoutPlan, isPaidPlan, planDisplayName, splitPrice, type PaidPlan } from '@/lib/plans'
import { cn } from '@/lib/utils'

export default function SubscriptionPage() {
  const [entitlement, setEntitlement] = React.useState<Entitlement | null>(null)
  const [billing, setBilling] = React.useState<Subscription | null>(null)
  const [prices, setPrices] = React.useState<Partial<Record<PaidPlan, { amount: number | null; currency: string; interval: string }>>>({})
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)

  React.useEffect(() => {
    void api.dashboard().then((data) => {
      setEntitlement(data.entitlement)
      setBilling(data.subscription)
    }).catch(() => undefined)
    void api.plans().then((result) => {
      const next: Partial<Record<PaidPlan, { amount: number | null; currency: string; interval: string }>> = {}
      for (const item of result.plans ?? []) {
        if (isCheckoutPlan(item.id)) next[item.id] = item
      }
      setPrices(next)
    }).catch(() => undefined)
  }, [])

  const paid = isPaidPlan(entitlement?.plan, entitlement?.status)
  const plan = entitlement?.plan
  const period = billing?.currentPeriodEnd ? formatDate(billing.currentPeriodEnd) : ''
  const canceling = Boolean(paid && billing?.cancelAtPeriodEnd)
  const hasCustomer = Boolean(billing?.stripeCustomerId)
  const currentName = paid ? planDisplayName(plan) : 'No plan'
  const currentDetail = entitlement?.freeAccess
    ? 'Complimentary access'
    : !paid
      ? 'Subscribe to start a plan. The Tudso app uses this same subscription.'
      : canceling && period
        ? `Cancels ${period}`
        : entitlement?.status === 'past_due'
          ? 'Payment past due'
          : entitlement?.status === 'trialing'
            ? period ? `Trial · ${period}` : 'Trial'
            : period
              ? `Renews ${period}`
              : (entitlement?.status ?? 'Active')

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
    if (paid && billing?.stripeCustomerId) {
      if (target === plan) {
        void run('manage', () => openUrl(() => api.portal('manage')), 'Opened billing.')
        return
      }
      void run(`plan-${target}`, () => openUrl(() => api.portal('upgrade', target)), 'Opened the plan change.')
      return
    }
    void run(`plan-${target}`, () => openUrl(() => api.checkout(target)), 'Opened checkout.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Subscription</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Unlimited call time and real-time answers. Subscribe, change, or cancel here — same plans as the app.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Current</h2>
        <div className="flex items-start gap-2.5 rounded-md bg-surface-2 px-3 py-2.5">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-[14px] font-medium">{currentName}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{currentDetail}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Plans</h2>
        <div className="space-y-2">
          {PAID_PLAN_CATALOG.map((item) => {
            const current = paid && plan === item.id
            const amount = prices[item.id]?.amount ?? item.fallbackAmount
            const { dollars, cents } = splitPrice(amount)
            const actionLabel = current ? 'Current' : paid ? 'Switch' : item.action
            return (
              <div
                key={item.id}
                className={cn(
                  'relative rounded-md p-3',
                  current ? 'bg-raised' : item.featured ? 'border border-accent bg-surface-2' : 'bg-surface-2',
                )}
              >
                {item.badge ? (
                  <span className="absolute right-3 top-3 rounded-full bg-accent-fill px-2 py-0.5 text-[10px] font-medium text-accent-fill-fg">
                    {item.badge}
                  </span>
                ) : null}
                <p className={cn('text-[13px] font-medium tracking-wide', item.featured ? 'text-accent' : 'text-fg')}>
                  {item.mark}
                </p>
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <div>
                    <p className={cn('text-[14px] font-medium', item.featured ? 'text-accent' : '')}>{item.name}</p>
                    <p className="mt-1 flex items-start leading-none">
                      <span className="text-[16px] font-medium">$</span>
                      <span className="text-[22px] font-medium tracking-tight">{dollars}</span>
                      <span className="mt-0.5 text-[11px] text-muted-foreground">.{cents}</span>
                    </p>
                  </div>
                  <Button
                    size="compact"
                    variant={current ? 'soft' : item.featured ? 'fill' : 'soft'}
                    disabled={Boolean(busy) || current}
                    loading={busy === `plan-${item.id}`}
                    onClick={() => choosePlan(item.id)}
                  >
                    {actionLabel}
                  </Button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{item.description}</p>
                <ul className="mt-2 space-y-1">
                  {item.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2 text-[12px] leading-relaxed">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {hasCustomer ? (
        <section>
          <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Billing</h2>
          <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
            <BillingRow
              icon={<Wallet className="h-3.5 w-3.5" />}
              title="Manage subscription"
              description="Payment method, invoices, and plan details."
              action="Manage"
              actionIcon={<Receipt className="h-3.5 w-3.5" />}
              disabled={Boolean(busy)}
              loading={busy === 'manage'}
              onClick={() => void run('manage', () => openUrl(() => api.portal('manage')), 'Opened billing.')}
            />
            {paid && !canceling ? (
              <BillingRow
                icon={<Ban className="h-3.5 w-3.5" />}
                title="Cancel subscription"
                description="Confirm in the browser. Access continues until the period ends."
                action="Cancel"
                danger
                disabled={Boolean(busy)}
                loading={busy === 'cancel'}
                onClick={() => void run('cancel', () => openUrl(() => api.portal('cancel')), 'Opened cancellation.')}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted-foreground">{status}</p> : null}
    </div>
  )
}

function BillingRow({
  icon,
  title,
  description,
  action,
  actionIcon,
  danger,
  disabled,
  loading,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  actionIcon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn('mt-0.5 text-muted-foreground', danger && 'text-danger')}>{icon}</span>
        <div>
          <p className="text-[13px] font-medium">{title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button variant={danger ? 'danger' : 'soft'} size="compact" disabled={disabled} loading={loading} onClick={onClick}>
        {actionIcon}
        {action}
      </Button>
    </div>
  )
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}
