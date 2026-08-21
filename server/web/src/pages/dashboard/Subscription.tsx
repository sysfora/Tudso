import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  Receipt,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  api,
  type BillingInvoice,
  type BillingOverview,
  type Entitlement,
  type Subscription,
} from '@/lib/api'
import { PAID_PLAN_CATALOG, isCheckoutPlan, isPaidPlan, planDisplayName, splitPrice, type PaidPlan } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { SkeletonBar } from '@/components/app/Loader'

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
  const currentItem = PAID_PLAN_CATALOG.find((item) => item.id === plan)
  const amount = (plan && isCheckoutPlan(plan) ? prices[plan]?.amount : null) ?? currentItem?.fallbackAmount ?? 0
  const { dollars, cents } = splitPrice(amount)
  const interval = currentItem?.interval === 'week' ? 'week' : currentItem?.interval === 'year' ? 'year' : 'month'
  const period = billing?.currentPeriodEnd ? formatDate(billing.currentPeriodEnd) : (entitlement?.expiresAt ? formatDate(entitlement.expiresAt) : '')
  const canceling = Boolean(paid && billing?.cancelAtPeriodEnd)
  const hasCustomer = Boolean(billing?.stripeCustomerId)
  const currentName = paid ? planDisplayName(plan) : 'No plan'
  const currentDetail = entitlement?.freeAccess
    ? 'Complimentary access. Same unlimited features as a paid plan.'
    : !paid
      ? 'Subscribe to unlock chat, screen answers, and live copilot. Same plans as the Tudso app.'
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

  if (!ready) return <SubscriptionSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Subscription</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Unlimited call time and real-time answers. Same billing the Tudso app uses.
          </p>
        </div>
        {billingNote ? (
          <p className={cn('inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px]', billingNote.tone === 'ok' ? 'text-ok' : 'text-muted-foreground')}>
            {billingNote.tone === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {billingNote.text}
          </p>
        ) : null}
      </div>

      <section className="rounded-md bg-surface-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-[16px] font-semibold tracking-tight">{currentName}</p>
              <StatusPill status={entitlement?.status} paid={paid} canceling={canceling} complimentary={Boolean(entitlement?.freeAccess)} />
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{currentDetail}</p>
          </div>
          {paid && amount ? (
            <p className="flex items-start leading-none">
              <span className="text-[16px] font-medium">$</span>
              <span className="text-[28px] font-semibold tracking-tight tabular-nums">{dollars}</span>
              <span className="mt-1 text-[12px] text-muted-foreground">.{cents}<span className="ml-1 font-normal">/{interval}</span></span>
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
        <div className="grid gap-2 sm:grid-cols-2">
          <section className="rounded-md bg-surface-2 px-3 py-3">
            <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Payment method</p>
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
          <section className="rounded-md bg-surface-2 px-3 py-3">
            <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Next invoice</p>
            {overview.nextPayment ? (
              <div className="mt-2 flex items-start gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-raised">
                  <Receipt className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[13px] font-medium tabular-nums">{formatMoney(overview.nextPayment.amount, overview.nextPayment.currency)}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">Due {formatDate(overview.nextPayment.date)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">{period ? `Next renewal ${period}` : 'No upcoming invoice.'}</p>
            )}
          </section>
        </div>
      ) : null}

      <section id="plans">
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Plans</h2>
        <div className="grid gap-2 md:grid-cols-3 md:items-stretch">
          {PAID_PLAN_CATALOG.map((item) => {
            const current = paid && plan === item.id
            const planAmount = prices[item.id]?.amount ?? item.fallbackAmount
            const price = splitPrice(planAmount)
            const perMonth = item.interval === 'year' ? splitPrice(Math.round(planAmount / 12)) : null
            const actionLabel = current ? 'Current plan' : paid ? `Switch to ${item.name}` : item.action
            return (
              <div
                key={item.id}
                className={cn(
                  'flex flex-col rounded-md p-4',
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
                <p className="mt-3 flex items-baseline leading-none">
                  <span className="text-[15px] font-medium">$</span>
                  <span className="text-[32px] font-semibold tracking-tight tabular-nums">{price.dollars}</span>
                  <span className="text-[13px] text-muted-foreground">.{price.cents}</span>
                  <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">/{item.interval}</span>
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {perMonth ? `Equals $${perMonth.dollars}.${perMonth.cents} / month, billed yearly.` : item.description}
                </p>
                <ul className="mt-3 mb-4 flex-1 space-y-1.5">
                  {item.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2 text-[12px] leading-relaxed">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  size="compact"
                  variant={current ? 'soft' : item.featured ? 'fill' : 'soft'}
                  disabled={Boolean(busy) || current}
                  loading={busy === `plan-${item.id}`}
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
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Invoices</h2>
          {overview.invoices.length ? (
            <p className="text-[12px] text-muted-foreground">{overview.invoices.length} from Stripe</p>
          ) : null}
        </div>
        {!hasCustomer ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] text-muted-foreground">
            Invoices appear here after you subscribe.
          </p>
        ) : overview.invoices.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] text-muted-foreground">
            No invoices yet. The first one shows after Stripe charges the plan.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
            {overview.invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted-foreground">{status}</p> : null}
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: BillingInvoice }) {
  const href = invoice.hostedUrl || invoice.pdfUrl
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">
            {invoice.number || 'Invoice'}
            <span className="ml-1.5 font-normal text-muted-foreground">{formatDate(invoice.created)}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {invoice.periodStart && invoice.periodEnd
              ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
              : invoiceStatus(invoice.status)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-[13px] font-medium tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</p>
          <p className={cn('text-[11px]', invoice.status === 'paid' ? 'text-ok' : invoice.status === 'open' ? 'text-muted-foreground' : 'text-danger')}>
            {invoiceStatus(invoice.status)}
          </p>
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-lift hover:text-fg"
            aria-label="Open invoice"
          >
            {invoice.pdfUrl && href === invoice.pdfUrl ? <Download className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
          </a>
        ) : null}
      </div>
    </li>
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
    <div className="space-y-6" aria-busy="true" aria-label="Loading subscription">
      <div>
        <SkeletonBar className="h-5 w-32" />
        <SkeletonBar className="mt-2 h-3 w-80 max-w-full" delay={80} />
      </div>
      <div className="rounded-md bg-surface-2 p-4">
        <SkeletonBar className="h-4 w-28" />
        <SkeletonBar className="mt-2 h-3 w-56" delay={80} />
        <SkeletonBar className="mt-4 h-8 w-32" delay={140} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-surface-2 px-3 py-3">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="mt-3 h-4 w-40" delay={80} />
        </div>
        <div className="rounded-md bg-surface-2 px-3 py-3">
          <SkeletonBar className="h-3 w-20" delay={40} />
          <SkeletonBar className="mt-3 h-4 w-32" delay={120} />
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {['a', 'b', 'c'].map((key, index) => (
          <div key={key} className="rounded-md bg-surface-2 p-4">
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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)
  } catch {
    return `$${(amount / 100).toFixed(2)}`
  }
}

function invoiceStatus(status: string) {
  if (status === 'paid') return 'Paid'
  if (status === 'open') return 'Open'
  if (status === 'void') return 'Void'
  if (status === 'uncollectible') return 'Uncollectible'
  return status
}
