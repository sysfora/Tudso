import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { desktop } from '@/lib/desktop'
import type { Plan } from '@/types/api'

export function Subscription() {
  const entitlement = useAuthStore((state) => state.entitlement)
  const checkout = useAuthStore((state) => state.checkout)
  const plan = entitlement?.plan ?? 'free'
  const status = entitlement?.status ?? 'active'

  const openPortal = async () => {
    const { url } = await fetch(`${import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000'}/billing/portal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('tudso.token') ?? ''}` },
    }).then((r) => r.json()) as { url: string }
    await desktop.app.openExternal(url)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-surface-2 p-3">
        <p className="text-[12px] text-muted">Current Plan</p>
        <p className="text-[16px] font-semibold capitalize">{plan}</p>
        <p className="text-[12px] text-muted capitalize">Status: {status}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {( ['free', 'pro', 'premium'] as Plan[]).map((p) => (
          <div key={p} className={`rounded-lg border p-2 text-center ${plan === p ? 'border-accent bg-raised' : 'border-border'}`}>
            <p className="text-[13px] font-medium capitalize">{p}</p>
            {plan === p ? (
              <p className="text-[11px] text-muted">Current</p>
            ) : (
              <Button size="sm" className="mt-1 w-full text-[11px]" onClick={() => void checkout(p)}>
                Upgrade
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => void openPortal()}>
        Manage Subscription
      </Button>
    </div>
  )
}
