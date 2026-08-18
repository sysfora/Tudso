import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { useAuthStore } from '@/store/auth-store'

export function Welcome() {
  const startLogin = useAuthStore((state) => state.startLogin)
  const cancelLogin = useAuthStore((state) => state.cancelLogin)
  const loginStatus = useAuthStore((state) => state.loginStatus)
  const loginError = useAuthStore((state) => state.loginError)
  const [starting, setStarting] = useState<'login' | 'register' | null>(null)

  const begin = async (mode: 'login' | 'register') => {
    if (starting) return
    setStarting(mode)
    await startLogin(mode)
    setStarting(null)
  }

  if (loginStatus === 'waiting' || loginStatus === 'completing') {
    const returning = loginStatus === 'completing'
    return (
      <div className="flex h-full flex-col">
        <div className="h-11 shrink-0" aria-hidden />
        <div className="drag-region flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center" role="status" aria-live="polite">
        <LoaderCircle className="mb-4 h-8 w-8 animate-spin text-accent" aria-hidden />
        <h1 className="text-[22px] font-semibold tracking-tight">
          {returning ? 'Signing you in' : 'Waiting for sign in'}
        </h1>
        <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
          {returning
            ? 'Welcome back. Finishing your session in Tudso.'
            : 'Complete sign in in the browser. This window will continue automatically when you return.'}
        </p>
        {loginStatus === 'waiting' ? (
          <Button variant="outline" className="no-drag mt-6" onClick={cancelLogin}>
            Cancel
          </Button>
        ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="h-11 shrink-0" aria-hidden />
      <div className="drag-region flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
      <Logo className="mb-6 h-20 w-20" />
      <h1 className="text-[22px] font-semibold tracking-tight">Welcome to Tudso</h1>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
        Your personal AI assistant for your desktop. Understand your work. Understand your context. Help you solve problems faster.
      </p>
      {loginError ? <p className="mt-4 max-w-[280px] text-[13px] text-danger">{loginError}</p> : null}
      <div className="no-drag mt-6 flex w-full max-w-[240px] flex-col gap-2">
        <Button loading={starting === 'register'} disabled={Boolean(starting)} onClick={() => void begin('register')}>
          Create account
        </Button>
        <Button
          variant="outline"
          loading={starting === 'login'}
          disabled={Boolean(starting)}
          onClick={() => void begin('login')}
        >
          Sign in
        </Button>
      </div>
      </div>
    </div>
  )
}
