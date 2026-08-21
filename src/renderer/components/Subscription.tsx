import { useEffect, useState, type ReactNode } from 'react'
import { Ban, Check, CreditCard, Receipt, Wallet } from 'lucide-react'
import { PAID_PLAN_CATALOG, isCheckoutPlan, isPaidPlan, planDisplayName, splitPrice, type PaidPlan } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { formatMemoryDate } from '@/lib/format'
import { useAuthStore } from '@/store/auth-store'
import type { BillingPlanPrice, Subscription as BillingSubscription } from '@/types/api'

export function Subscription() {
  const entitlement = useAuthStore((state) => state.entitlement)
  const checkout = useAuthStore((state) => state.checkout)
  const openBilling = useAuthStore((state) => state.openBilling)
  const plan = entitlement?.plan
  const paid = isPaidPlan(plan, entitlement?.status)
  const [billing, setBilling] = useState<BillingSubscription | null>(null)
  const [prices, setPrices] = useState<Partial<Record<PaidPlan, BillingPlanPrice>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    void api.billing.subscription().then(setBilling).catch(() => setBilling(null))
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
  const currentDetail = entitlement?.freeAccess
    ? 'Complimentary access'
    : !paid
    ? 'Subscribe in the browser to start a plan.'
    : canceling && period
      ? `Cancels ${period}`
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

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Current</h3>
        <div className="flex items-start gap-2.5 rounded-md bg-surface-2 px-3 py-2.5">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-[14px] font-medium">{currentName}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{currentDetail}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Plans</h3>
        <div className="space-y-2">
          {PAID_PLAN_CATALOG.map((item) => {
            const current = paid && plan === item.id
            const amount = prices[item.id]?.amount ?? item.fallbackAmount
            const { dollars, cents } = splitPrice(amount)
            const actionKey = `plan-${item.id}`
            const actionLabel = current ? 'Current' : paid ? 'Switch' : item.action
            return (
              <div
                key={item.id}
                className={cn(
                  'relative rounded-md p-3',
                  current
                    ? 'bg-raised'
                    : item.featured
                      ? 'border border-accent bg-surface-2'
                      : 'bg-surface-2',
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
                      <span className="mt-0.5 text-[11px] text-muted">.{cents}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={current ? 'outline' : item.featured ? 'default' : 'outline'}
                    disabled={Boolean(busy) || current}
                    loading={busy === actionKey}
                    onClick={() => choosePlan(item.id)}
                  >
                    {actionLabel}
                  </Button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted">{item.description}</p>
                <ul className="mt-2 space-y-1">
                  {item.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2 text-[12px] leading-relaxed">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="text-fg">{feature.text}</span>
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
          <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Billing</h3>
          <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
            <BillingRow
              icon={<Wallet className="h-3.5 w-3.5" />}
              title="Manage subscription"
              description="Payment method, invoices, and plan details in the browser."
              action="Manage"
              actionIcon={<Receipt className="h-3.5 w-3.5" />}
              disabled={Boolean(busy)}
              loading={busy === 'manage'}
              onClick={() => void run('manage', () => openBilling('manage'), 'Opened billing in your browser.')}
            />
            {paid && !canceling ? (
              <BillingRow
                icon={<Ban className="h-3.5 w-3.5" />}
                title="Cancel subscription"
                description="Confirm cancellation in the browser. Access continues until the period ends."
                action="Cancel"
                danger
                disabled={Boolean(busy)}
                loading={busy === 'cancel'}
                onClick={() => void run('cancel', () => openBilling('cancel'), 'Opened cancellation in your browser.')}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted">{status}</p> : null}
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
  icon: ReactNode
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
        <span className={cn('mt-0.5 text-muted', danger && 'text-danger')}>{icon}</span>
        <div>
          <p className="text-[13px] font-medium">{title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      <Button variant={danger ? 'danger' : 'outline'} size="sm" disabled={disabled} loading={loading} onClick={onClick}>
        {actionIcon}
        {action}
      </Button>
    </div>
  )
}
