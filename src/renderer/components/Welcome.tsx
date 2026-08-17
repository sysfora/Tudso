import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { useAuthStore } from '@/store/auth-store'

export function Welcome() {
  const startLogin = useAuthStore((state) => state.startLogin)
  const cancelLogin = useAuthStore((state) => state.cancelLogin)
  const loginStatus = useAuthStore((state) => state.loginStatus)
  const loginError = useAuthStore((state) => state.loginError)

  if (loginStatus === 'waiting' || loginStatus === 'completing') {
    const returning = loginStatus === 'completing'
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center" role="status" aria-live="polite">
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
          <Button variant="outline" className="mt-6" onClick={cancelLogin}>
            Cancel
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <Logo className="mb-6 h-20 w-20" />
      <h1 className="text-[22px] font-semibold tracking-tight">Welcome to Tudso</h1>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
        Your personal AI assistant for your desktop. Understand your work. Understand your context. Help you solve problems faster.
      </p>
      {loginError ? <p className="mt-4 max-w-[280px] text-[13px] text-danger">{loginError}</p> : null}
      <div className="mt-6 flex w-full max-w-[240px] flex-col gap-2">
        <Button onClick={() => void startLogin('register')}>Create account</Button>
        <Button variant="outline" onClick={() => void startLogin('login')}>
          Sign in
        </Button>
      </div>
    </div>
  )
}
