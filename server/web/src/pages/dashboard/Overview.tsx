import * as React from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Monitor,
  Radio,
  ScanSearch,
  Mic,
  Coins,
  MessageSquare,
} from 'lucide-react'
import { api, type DashboardPayload } from '@/lib/api'
import { isPaidPlan, planDisplayName } from '@/lib/plans'
import { cn } from '@/lib/utils'

export default function Overview() {
  const session = useOutletContext<{ email: string }>()
  const [params] = useSearchParams()
  const [data, setData] = React.useState<DashboardPayload | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    void api.dashboard().then(setData).catch((err) => setError(err instanceof Error ? err.message : 'Could not load analytics.'))
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  if (error) return <p className="text-[13px] text-danger">{error}</p>
  if (!data) return <p className="text-[13px] text-muted-foreground">Loading analytics…</p>

  const paid = isPaidPlan(data.entitlement?.plan, data.entitlement?.status)
  const planName = paid ? planDisplayName(data.entitlement?.plan) : 'No plan'
  const billingNote = params.get('billing') === 'success'
    ? { tone: 'ok' as const, text: 'Payment complete. Your plan updates in a moment.' }
    : params.get('billing') === 'cancel'
      ? { tone: 'muted' as const, text: 'Checkout was canceled.' }
      : null
  const usage = data.usage
  const maxRequests = Math.max(1, ...data.history.map((day) => day.requests || 0))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Signed in as {data.email || session.email}. Opening the Tudso app uses this session without asking for a password.
        </p>
        {billingNote ? (
          <p className={cn('mt-2 inline-flex items-center gap-1.5 text-[12px]', billingNote.tone === 'ok' ? 'text-ok' : 'text-muted-foreground')}>
            {billingNote.tone === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {billingNote.text}
          </p>
        ) : null}
      </div>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Account</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat icon={<CreditCard className="h-3.5 w-3.5" />} label="Plan" value={planName} hint={paid ? (data.entitlement?.status ?? 'active') : 'Subscribe to use the app'} />
          <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Sessions" value={String(data.sessionCount ?? data.conversationCount ?? 0)} />
          <Stat icon={<Monitor className="h-3.5 w-3.5" />} label="Devices" value={String(data.deviceCount)} />
          <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Requests today" value={String(usage.requests ?? 0)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Usage today</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat icon={<Coins className="h-3.5 w-3.5" />} label="Tokens" value={(usage.tokens ?? 0).toLocaleString()} />
          <Stat icon={<ScanSearch className="h-3.5 w-3.5" />} label="Screen answers" value={String(usage.screenAnalyses ?? 0)} />
          <Stat icon={<Radio className="h-3.5 w-3.5" />} label="Live minutes" value={String(Math.round(usage.realtimeMinutes ?? 0))} />
          <Stat icon={<Mic className="h-3.5 w-3.5" />} label="Voice minutes" value={String(Math.round(usage.audioMinutes ?? 0))} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Last 14 days</h2>
        <p className="mb-3 text-[12px] text-muted-foreground">Requests per day</p>
        <div className="flex h-36 items-end gap-1 rounded-md bg-surface-2 px-3 py-3">
          {fillHistory(data.history).map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-sm bg-accent-fill"
                style={{ height: `${Math.max(4, Math.round(((day.requests || 0) / maxRequests) * 100))}%` }}
                title={`${day.date}: ${day.requests || 0} requests`}
              />
            </div>
          ))}
        </div>
      </section>

      {!paid ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" />
          No active plan.{' '}
          <Link className="font-medium text-fg hover:underline" to="/dashboard/subscription">Choose a plan</Link>
          {' '}to use chat, screen answers, and live copilot.
        </p>
      ) : null}
    </div>
  )
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[16px] font-medium">{value}</div>
      {hint ? <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function fillHistory(history: DashboardPayload['history']) {
  const byDay = new Map(history.map((item) => [item.date?.slice(0, 10), item]))
  const days = []
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - i)
    const key = date.toISOString().slice(0, 10)
    days.push(byDay.get(key) ?? { date: key, requests: 0, tokens: 0, screenAnalyses: 0, realtimeMinutes: 0, audioMinutes: 0, sessions: 0 })
  }
  return days
}
