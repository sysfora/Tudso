import * as React from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Mic,
  Monitor,
  Radio,
  ScanSearch,
  Coins,
  MessageSquare,
} from 'lucide-react'
import { api, type DashboardPayload, type Usage } from '@/lib/api'
import { OverviewSkeleton } from '@/components/app/Loader'
import { isPaidPlan, planDisplayName } from '@/lib/plans'
import { cn } from '@/lib/utils'

export default function Overview() {
  const session = useOutletContext<{ email: string; name?: string }>()
  const [params] = useSearchParams()
  const [data, setData] = React.useState<DashboardPayload | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    void api.dashboard().then(setData).catch((err) => setError(err instanceof Error ? err.message : 'Could not load analytics.'))
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div className="dashboard-surface dashboard-tint-pink px-6 py-8 text-center">
        <p className="text-[13px] text-danger">{error}</p>
        <button type="button" className="mt-2 text-[13px] font-medium text-accent hover:underline" onClick={() => { setError(null); load() }}>
          Try again
        </button>
      </div>
    )
  }
  if (!data) return <OverviewSkeleton />

  const paid = isPaidPlan(data.entitlement?.plan, data.entitlement?.status)
  const planName = paid ? planDisplayName(data.entitlement?.plan) : 'No plan'
  const billingNote = params.get('billing') === 'success'
    ? { tone: 'ok' as const, text: 'Payment complete. Your plan updates in a moment.' }
    : params.get('billing') === 'cancel'
      ? { tone: 'muted' as const, text: 'Checkout was canceled.' }
      : null
  const usage = data.usage
  const history = fillHistory(data.history)
  const todayKey = history[history.length - 1]?.date ?? ''
  const selectedKey = selected && history.some((day) => day.date === selected) ? selected : todayKey
  const selectedDay = history.find((day) => day.date === selectedKey) ?? history[history.length - 1]
  const maxRequests = Math.max(1, ...history.map((day) => day.requests || 0))
  const periodRequests = history.reduce((total, day) => total + (day.requests || 0), 0)
  const periodTokens = history.reduce((total, day) => total + (day.tokens || 0), 0)
  const peak = history.reduce((best, day) => ((day.requests || 0) > (best.requests || 0) ? day : best), history[0])
  const hasActivity = periodRequests > 0
  const greeting = session.name ? `Hi ${session.name.split(' ')[0]}` : 'Overview'

  return (
    <div className="dashboard-page space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your interview command center</p>
          <h1 className="mt-2 text-4xl tracking-tight sm:text-5xl">{greeting}</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {data.email || session.email}. Usage from the last 14 days, including the Tudso app.
          </p>
        </div>
        {billingNote ? (
          <p className={cn('inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px]', billingNote.tone === 'ok' ? 'text-ok' : 'text-muted-foreground')}>
            {billingNote.tone === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {billingNote.text}
          </p>
        ) : null}
      </div>

      {!paid ? (
        <div className="dashboard-surface dashboard-tint-mint flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[13px]">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            No active paid plan. Free includes 3 interview sessions. Subscribe or buy a pack for more.
          </p>
          <Link className="text-[13px] font-medium text-accent hover:underline" to="/dashboard/subscription">Choose a plan</Link>
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-2xl tracking-tight">Account snapshot</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<CreditCard className="h-3.5 w-3.5" />}
            label="Plan"
            value={planName}
            hint={paid ? statusLabel(data.entitlement?.status) : data.entitlement?.plan === 'free' ? '3 sessions included' : 'Choose a plan to begin'}
            tone={paid ? (data.entitlement?.status === 'past_due' ? 'danger' : 'ok') : 'muted'}
          />
          <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Sessions · 14 days" value={formatNumber(data.sessionCount ?? data.conversationCount ?? 0)} />
          <Stat icon={<Monitor className="h-3.5 w-3.5" />} label="Devices" value={formatNumber(data.deviceCount)} />
          <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Requests today" value={formatNumber(usage.requests ?? 0)} hint={`${formatNumber(periodRequests)} in 14 days`} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl tracking-tight">Last 14 days</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {hasActivity
                ? `${formatNumber(periodRequests)} requests · ${formatNumber(periodTokens)} tokens${peak?.requests ? ` · Peak ${formatDay(peak.date)}` : ''}`
                : 'No requests yet'}
            </p>
          </div>
          <p className="text-[12px] tabular-nums text-muted-foreground">Max {formatNumber(maxRequests)}</p>
        </div>

        <div className="dashboard-surface overflow-hidden bg-card p-4 sm:p-6">
          <UsageChart history={history} maxRequests={maxRequests} selectedKey={selectedKey} todayKey={todayKey} onSelect={setSelected} />

          {selectedDay ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[12px]">
              <p className="font-medium">{formatLong(selectedDay.date)}{selectedDay.date === todayKey ? ' · Today' : ''}</p>
              <p className="text-muted-foreground">{formatNumber(selectedDay.requests)} requests</p>
              <p className="text-muted-foreground">{formatNumber(selectedDay.tokens)} tokens</p>
              <p className="text-muted-foreground">{formatNumber(selectedDay.screenAnalyses)} screen</p>
              <p className="text-muted-foreground">{formatMinutes(selectedDay.realtimeMinutes)} live</p>
              <p className="text-muted-foreground">{formatMinutes(selectedDay.audioMinutes)} voice</p>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-2xl tracking-tight">Usage today</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Meter icon={<Coins className="h-3.5 w-3.5" />} label="Tokens" value={formatNumber(usage.tokens ?? 0)} amount={usage.tokens ?? 0} ratio={ratio(usage.tokens, history, 'tokens')} />
          <Meter icon={<ScanSearch className="h-3.5 w-3.5" />} label="Screen answers" value={formatNumber(usage.screenAnalyses ?? 0)} amount={usage.screenAnalyses ?? 0} ratio={ratio(usage.screenAnalyses, history, 'screenAnalyses')} />
          <Meter icon={<Radio className="h-3.5 w-3.5" />} label="Live copilot" value={formatMinutes(usage.realtimeMinutes)} amount={usage.realtimeMinutes ?? 0} ratio={ratio(usage.realtimeMinutes, history, 'realtimeMinutes')} />
          <Meter icon={<Mic className="h-3.5 w-3.5" />} label="Voice" value={formatMinutes(usage.audioMinutes)} amount={usage.audioMinutes ?? 0} ratio={ratio(usage.audioMinutes, history, 'audioMinutes')} />
        </div>
      </section>
    </div>
  )
}

function UsageChart({
  history,
  maxRequests,
  selectedKey,
  todayKey,
  onSelect,
}: {
  history: Usage[]
  maxRequests: number
  selectedKey: string
  todayKey: string
  onSelect: (date: string | null) => void
}) {
  const width = 960
  const height = 230
  const plotLeft = 24
  const plotRight = 936
  const plotTop = 22
  const plotBottom = 178
  const points = history.map((day, index) => {
    const x = plotLeft + (index / Math.max(1, history.length - 1)) * (plotRight - plotLeft)
    const y = plotBottom - ((day.requests || 0) / maxRequests) * (plotBottom - plotTop)
    return { ...day, x, y, value: day.requests || 0 }
  })
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const area = `${line} L ${plotRight} ${plotBottom} L ${plotLeft} ${plotBottom} Z`
  const selectedPoint = points.find((point) => point.date === selectedKey) ?? points[points.length - 1]
  const hasActivity = points.some((point) => point.value > 0)

  return (
    <div className="relative h-[230px]" role="img" aria-label="Requests per day for the last 14 days">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="usage-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-fill)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="usage-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--chart-line-soft)" />
            <stop offset="52%" stopColor="var(--chart-line)" />
            <stop offset="100%" stopColor="var(--chart-line-soft)" />
          </linearGradient>
        </defs>
        {[plotTop, plotTop + 52, plotTop + 104, plotBottom].map((y) => (
          <line key={y} x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray="2 8" />
        ))}
        <path d={area} fill="url(#usage-area)" />
        <path d={line} fill="none" stroke="url(#usage-line)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {hasActivity ? points.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r={point.date === selectedKey ? 6 : 3.5} fill="var(--chart-dot)" stroke="var(--chart-dot-ring)" strokeWidth="3" />
        )) : (
          <path d={`M ${plotLeft} ${plotBottom} C 220 ${plotBottom - 20}, 350 ${plotBottom + 12}, 480 ${plotBottom - 10} S 740 ${plotBottom - 24}, ${plotRight} ${plotBottom - 4}`} fill="none" stroke="var(--chart-line-soft)" strokeDasharray="5 8" strokeLinecap="round" strokeWidth="2" />
        )}
        {selectedPoint ? <line x1={selectedPoint.x} x2={selectedPoint.x} y1={plotTop} y2={plotBottom} stroke="var(--chart-guide)" strokeDasharray="3 6" /> : null}
      </svg>

      {!hasActivity ? (
        <div className="pointer-events-none absolute inset-x-0 top-[72px] text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-card/85 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
            Your activity will appear here
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex h-11" role="group" aria-label="Select a day">
        {points.map((point) => {
          const active = point.date === selectedKey
          const today = point.date === todayKey
          return (
            <button
              key={point.date}
              type="button"
              className={cn('group relative flex min-w-0 flex-1 items-end justify-center rounded-md pb-1.5 text-[10px] leading-none transition-colors hover:bg-surface-2/70 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', active ? 'text-fg' : 'text-muted-foreground')}
              onClick={() => onSelect(point.date ?? null)}
              aria-pressed={active}
              aria-label={`${formatLong(point.date)}: ${point.value} requests`}
            >
              <span className={cn(today || active ? 'font-semibold' : 'font-normal')}>{formatWeekday(point.date)}</span>
              {today ? <span className="absolute bottom-0.5 h-0.5 w-1 rounded-full bg-accent-fill" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone = 'muted',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'muted' | 'ok' | 'danger'
}) {
  return (
    <div className="dashboard-surface bg-card px-5 py-5">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-raised">{icon}</span>
        {label}
      </div>
      <div className="mt-3 truncate font-display text-3xl tracking-tight tabular-nums">{value}</div>
      {hint ? (
        <div className={cn('mt-0.5 text-[12px]', tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-muted-foreground')}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function Meter({
  icon,
  label,
  value,
  amount,
  ratio,
}: {
  icon: React.ReactNode
  label: string
  value: string
  amount: number
  ratio: number
}) {
  const width = amount <= 0 ? 0 : Math.max(6, Math.round(Math.min(1, Math.max(0, ratio)) * 100))
  return (
    <div className="dashboard-surface bg-card px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-raised">{icon}</span>
          {label}
        </div>
        <p className="shrink-0 font-display text-2xl tabular-nums">{value}</p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-md bg-raised">
        <div className="h-full rounded-md bg-accent-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function fillHistory(history: DashboardPayload['history']) {
  const byDay = new Map(history.map((item) => [item.date?.slice(0, 10), item]))
  const days: Usage[] = []
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - i)
    const key = date.toISOString().slice(0, 10)
    days.push(byDay.get(key) ?? { date: key, requests: 0, tokens: 0, screenAnalyses: 0, realtimeMinutes: 0, audioMinutes: 0, sessions: 0 })
  }
  return days
}

function ratio(value: number | undefined, history: Usage[], key: 'tokens' | 'screenAnalyses' | 'realtimeMinutes' | 'audioMinutes') {
  const max = Math.max(1, ...history.map((day) => Number(day[key] || 0)), Number(value || 0))
  return Number(value || 0) / max
}

function formatNumber(value: number | undefined) {
  return (value ?? 0).toLocaleString()
}

function formatMinutes(value: number | undefined) {
  const minutes = Math.round(value ?? 0)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function formatWeekday(iso?: string) {
  if (!iso) return ''
  const date = parseDay(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { weekday: 'narrow' })
}

function formatDay(iso?: string) {
  if (!iso) return ''
  const date = parseDay(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatLong(iso?: string) {
  if (!iso) return ''
  const date = parseDay(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function parseDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

function statusLabel(status?: string) {
  if (status === 'past_due') return 'Payment past due'
  if (status === 'trialing') return 'Trial'
  if (status === 'active') return 'Active'
  return status || 'Active'
}
