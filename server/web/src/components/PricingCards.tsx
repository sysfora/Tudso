import * as React from 'react'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { displayFont } from '@/lib/brand'
import { ONE_TIME_PLAN_CATALOG, SUBSCRIPTION_PLAN_CATALOG, planIntervalLabel, type PlanCatalogItem } from '@/lib/plans'
import { cn } from '@/lib/utils'

function PlanPriceDisplay({ item, amount = item.fallbackAmount, landingStyle = false }: { item: PlanCatalogItem; amount?: number; landingStyle?: boolean }) {
  if (amount <= 0) {
    return (
      <p className={landingStyle ? 'mt-3 font-display text-2xl text-foreground sm:text-3xl' : 'mt-4 text-5xl font-black tracking-tight'} style={landingStyle ? undefined : displayFont}>Free</p>
    )
  }
  const dollars = Math.floor(Math.abs(amount) / 100).toString()
  const cents = String(Math.abs(amount) % 100).padStart(2, '0')
  if (landingStyle) {
    return <p className="mt-3 font-display text-2xl text-foreground sm:text-3xl">${dollars}.${cents} / {planIntervalLabel(item.interval)}</p>
  }
  return (
    <p className="mt-4 flex items-start leading-none" style={displayFont}>
      <span className="text-3xl font-black">$</span>
      <span className="text-5xl font-black tracking-tight">{dollars}</span>
      <span className="mt-1 text-lg font-semibold text-muted-foreground">.{cents}</span>
      <span className="mt-3 ml-1.5 text-sm font-semibold text-muted-foreground">/{planIntervalLabel(item.interval)}</span>
    </p>
  )
}

export function PricingPlanCard({
  item,
  amount,
  badge,
  actionLabel = item.action,
  href,
  onAction,
  buttonVariant,
  disabled = false,
  loading = false,
  landingStyle = false,
}: {
  item: PlanCatalogItem
  amount?: number
  badge?: React.ReactNode
  actionLabel?: string
  href?: string
  onAction?: () => void
  buttonVariant?: 'default' | 'outline' | 'fill' | 'soft'
  disabled?: boolean
  loading?: boolean
  landingStyle?: boolean
}) {
  const featured = Boolean(item.featured)
  const target = href ?? (item.id === 'free' ? '/login?mode=register' : `/login?mode=register&plan=${item.id}`)
  const cardBadge = badge === undefined ? item.badge : badge
  const features = landingStyle
    ? item.features.filter((feature) => !/ min per session$/.test(feature.text))
    : item.features
  return (
    <div
      className={cn(
        landingStyle ? 'h-full rounded-3xl border p-6 bg-card' : 'relative flex flex-col rounded-3xl border p-6 shadow-sm transition-shadow hover:shadow-lg sm:p-8',
        landingStyle
          ? featured ? 'border-primary/40 shadow-lg shadow-primary/10' : 'border-border'
          : featured ? 'border-2 border-primary bg-card shadow-lg shadow-primary/10' : 'border-border bg-card',
      )}
    >
      {cardBadge && !landingStyle ? (
        <div className="absolute right-5 top-5 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-primary-foreground">
          {cardBadge}
        </div>
      ) : null}
      <div className="flex-1">
        {!landingStyle ? <p className="text-xl font-black tracking-wide">{item.mark}</p> : null}
        {landingStyle ? (
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-2xl text-foreground">{item.name}</h3>
            {cardBadge ? <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{cardBadge}</span> : null}
          </div>
        ) : (
          <h3 className="mt-3 text-3xl font-black" style={displayFont}>{item.name}</h3>
        )}
        <PlanPriceDisplay item={item} amount={amount} landingStyle={landingStyle} />
        {!landingStyle ? <p className="mt-3 text-sm text-muted-foreground">{item.description}</p> : null}
        <ul className={landingStyle ? 'mt-6 space-y-2.5' : 'mt-6 space-y-3 text-sm'}>
          {features.map((feature) => (
            <li key={feature.text} className={landingStyle ? 'flex gap-2 text-sm text-foreground/90' : 'flex items-start gap-2'}>
              <Check className={landingStyle ? 'mt-0.5 h-4 w-4 shrink-0 text-primary' : 'mt-0.5 h-4 w-4 shrink-0'} />
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>
      {onAction ? (
        <Button className={cn(landingStyle ? 'mt-5 h-auto w-full rounded-full px-5 py-3 text-sm' : 'mt-8 w-full', landingStyle && !featured && 'bg-secondary text-secondary-foreground hover:bg-secondary/80')} size="lg" variant={landingStyle ? 'default' : (buttonVariant ?? (featured ? 'default' : 'outline'))} disabled={disabled} loading={loading} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : (
        <Button className={cn(landingStyle ? 'mt-5 h-auto w-full rounded-full px-5 py-3 text-sm' : 'mt-8 w-full', landingStyle && !featured && 'bg-secondary text-secondary-foreground hover:bg-secondary/80')} size="lg" variant={landingStyle ? 'default' : (buttonVariant ?? (featured ? 'default' : 'outline'))} asChild>
          <Link to={target}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  )
}

export function PricingCards() {
  const [tab, setTab] = React.useState<'one_time' | 'subscription'>('subscription')
  const items = tab === 'one_time' ? ONE_TIME_PLAN_CATALOG : SUBSCRIPTION_PLAN_CATALOG
  return (
    <div>
      <PricingPlanTabs value={tab} onChange={setTab} />
      <div className={cn('mt-6 grid gap-6 md:items-stretch', tab === 'one_time' ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')}>
        {items.map((item) => <PricingPlanCard key={item.id} item={item} />)}
      </div>
    </div>
  )
}

export function PricingPlanTabs({
  value,
  onChange,
  landingStyle = false,
}: {
  value: 'one_time' | 'subscription'
  onChange: (value: 'one_time' | 'subscription') => void
  landingStyle?: boolean
}) {
  return (
    <div role="tablist" aria-label="Plan type" className={cn(landingStyle ? 'mx-auto mt-7 inline-flex items-center rounded-full border border-border bg-card p-1' : 'mx-auto flex w-fit rounded-full border border-border bg-card p-1')}>
      <TabButton landingStyle={landingStyle} selected={value === 'subscription'} onClick={() => onChange('subscription')}>Subscriptions</TabButton>
      <TabButton landingStyle={landingStyle} selected={value === 'one_time'} onClick={() => onChange('one_time')}>One-Time</TabButton>
    </div>
  )
}

function TabButton({
  selected,
  onClick,
  landingStyle,
  children,
}: {
  selected: boolean
  onClick: () => void
  landingStyle: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        landingStyle ? 'rounded-full px-4 py-2 text-sm font-medium transition' : 'h-9 rounded-full px-4 text-sm font-semibold',
        selected ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
