import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { displayFont } from '@/lib/brand'
import { PAID_PLAN_CATALOG } from '@/lib/plans'
import { cn } from '@/lib/utils'

function PlanPriceDisplay({ amountCents }: { amountCents: number }) {
  const dollars = Math.floor(Math.abs(amountCents) / 100).toString()
  const cents = String(Math.abs(amountCents) % 100).padStart(2, '0')
  return (
    <p className="mt-4 flex items-start leading-none" style={displayFont}>
      <span className="text-3xl font-black">$</span>
      <span className="text-5xl font-black tracking-tight">{dollars}</span>
      <span className="mt-1 text-lg font-semibold text-muted-foreground">.{cents}</span>
    </p>
  )
}

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3 md:items-stretch">
      {PAID_PLAN_CATALOG.map((item) => {
        const featured = Boolean(item.featured)
        return (
          <div
            key={item.id}
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
              <PlanPriceDisplay amountCents={item.fallbackAmount} />
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
              <Link to={`/login?mode=register&plan=${item.id}`}>{item.action}</Link>
            </Button>
          </div>
        )
      })}
    </div>
  )
}
