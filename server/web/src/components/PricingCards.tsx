import * as React from 'react'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { displayFont } from '@/lib/brand'
import { ONE_TIME_PLAN_CATALOG, SUBSCRIPTION_PLAN_CATALOG, planIntervalLabel, type PlanCatalogItem } from '@/lib/plans'
import { cn } from '@/lib/utils'

function PlanPriceDisplay({ item }: { item: PlanCatalogItem }) {
  if (item.fallbackAmount <= 0) {
    return (
      <p className="mt-4 text-5xl font-black tracking-tight" style={displayFont}>Free</p>
    )
  }
  const dollars = Math.floor(Math.abs(item.fallbackAmount) / 100).toString()
  const cents = String(Math.abs(item.fallbackAmount) % 100).padStart(2, '0')
  return (
    <p className="mt-4 flex items-start leading-none" style={displayFont}>
      <span className="text-3xl font-black">$</span>
      <span className="text-5xl font-black tracking-tight">{dollars}</span>
      <span className="mt-1 text-lg font-semibold text-muted-foreground">.{cents}</span>
      <span className="mt-3 ml-1.5 text-sm font-semibold text-muted-foreground">/{planIntervalLabel(item.interval)}</span>
    </p>
  )
}

function PlanCard({ item }: { item: PlanCatalogItem }) {
  const featured = Boolean(item.featured)
  const href = item.id === 'free' ? '/login?mode=register' : `/login?mode=register&plan=${item.id}`
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl border p-6 sm:p-8',
        featured ? 'border-2 border-foreground bg-brand-mint/30' : 'border-border bg-card',
      )}
    >
      {item.badge ? (
        <div className="absolute right-5 top-5 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-primary-foreground">
          {item.badge}
        </div>
      ) : null}
      <div className="flex-1">
        <p className="text-xl font-black tracking-wide">{item.mark}</p>
        <h3 className="mt-3 text-2xl font-black" style={displayFont}>{item.name}</h3>
        <PlanPriceDisplay item={item} />
        <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
        <ul className="mt-6 space-y-3 text-sm">
          {item.features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button className="mt-8 w-full" size="lg" variant={featured ? 'default' : 'outline'} asChild>
        <Link to={href}>{item.action}</Link>
      </Button>
    </div>
  )
}

export function PricingCards() {
  const [tab, setTab] = React.useState<'one_time' | 'subscription'>('subscription')
  const items = tab === 'one_time' ? ONE_TIME_PLAN_CATALOG : SUBSCRIPTION_PLAN_CATALOG
  return (
    <div>
      <PlanTabs value={tab} onChange={setTab} />
      <div className={cn('mt-6 grid gap-6 md:items-stretch', tab === 'one_time' ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')}>
        {items.map((item) => <PlanCard key={item.id} item={item} />)}
      </div>
    </div>
  )
}

function PlanTabs({
  value,
  onChange,
}: {
  value: 'one_time' | 'subscription'
  onChange: (value: 'one_time' | 'subscription') => void
}) {
  return (
    <div role="tablist" aria-label="Plan type" className="mx-auto flex w-fit rounded-full bg-secondary p-1">
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
        'h-9 rounded-full px-4 text-sm font-semibold',
        selected ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
