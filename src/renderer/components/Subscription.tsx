import { useEffect, useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { PAID_PLAN_CATALOG, isPaidPlan, type PaidPlan } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { formatMemoryDate, formatPlanPrice } from '@/lib/format'
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
          if (item.id === 'pro' || item.id === 'premium') next[item.id] = item
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
  const currentName = paid ? (plan === 'premium' ? 'Premium' : 'Pro') : 'No plan'
  const currentDetail = !paid
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
        Subscribe, change, or cancel in your browser. Premium adds a switch to hide Tudso from screen share. Pro stays visible.
      </p>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Current</h3>
        <div className="rounded-md bg-surface-2 px-3 py-2.5">
          <p className="text-[14px] font-medium">{currentName}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{currentDetail}</p>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Plans</h3>
        <div className="space-y-2">
          {PAID_PLAN_CATALOG.map((item) => {
            const current = paid && plan === item.id
            const price = formatPlanPrice(prices[item.id]?.amount, prices[item.id]?.currency, prices[item.id]?.interval)
            const actionKey = `plan-${item.id}`
            const actionLabel = current
              ? 'Current'
              : paid
                ? item.id === 'premium'
                  ? 'Upgrade'
                  : 'Switch'
                : 'Subscribe'
            return (
              <div
                key={item.id}
                className={cn('rounded-md p-3', current ? 'bg-raised' : 'bg-surface-2')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium">{item.name}</p>
                    {price ? <p className="mt-0.5 text-[12px] text-muted">{price}</p> : null}
                  </div>
                  <Button
                    size="sm"
                    variant={current ? 'outline' : 'default'}
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
                      {feature.included ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      ) : (
                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                      )}
                      <span className={feature.included ? 'text-fg' : 'text-muted'}>{feature.text}</span>
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
              title="Manage subscription"
              description="Payment method, invoices, and plan details in the browser."
              action="Manage"
              disabled={Boolean(busy)}
              loading={busy === 'manage'}
              onClick={() => void run('manage', () => openBilling('manage'), 'Opened billing in your browser.')}
            />
            {paid && plan === 'pro' ? (
              <BillingRow
                title="Upgrade subscription"
                description="Move to Premium in the browser for hide from screen share."
                action="Upgrade"
                disabled={Boolean(busy)}
                loading={busy === 'upgrade'}
                onClick={() => void run('upgrade', () => openBilling('upgrade', 'premium'), 'Opened the upgrade in your browser.')}
              />
            ) : null}
            {paid && !canceling ? (
              <BillingRow
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
  title,
  description,
  action,
  danger,
  disabled,
  loading,
  onClick,
}: {
  title: string
  description: string
  action: string
  danger?: boolean
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
      </div>
      <Button variant={danger ? 'danger' : 'outline'} size="sm" disabled={disabled} loading={loading} onClick={onClick}>
        {action}
      </Button>
    </div>
  )
}
