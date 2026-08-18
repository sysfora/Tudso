import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'

export function LockScreen() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const setLocked = useAppStore((state) => state.setLocked)

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <Logo className="mb-4 h-8 w-8 text-accent" />
      <h1 className="text-lg font-semibold">Tudso is locked</h1>
      <p className="mt-1 mb-4 max-w-[240px] text-[13px] text-muted">Enter your PIN to continue.</p>
      <form
        className="w-full max-w-[220px] space-y-2"
        onSubmit={async (event) => {
          event.preventDefault()
          if (unlocking) return
          setUnlocking(true)
          setError(null)
          try {
            const ok = await desktop.app.unlock(pin)
            if (ok) {
              setLocked(false)
              return
            }
            setError('That PIN does not match. After five tries, wait 30 seconds.')
          } finally {
            setUnlocking(false)
          }
        }}
      >
        <Input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          aria-label="PIN"
        />
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button className="w-full" type="submit" loading={unlocking}>
          Unlock
        </Button>
      </form>
    </div>
  )
}
