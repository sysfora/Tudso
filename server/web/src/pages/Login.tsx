import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, LogIn, Mail, User, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { AppShell, ThemeToggle } from '@/components/app/AppShell'
import { BrandMark } from '@/components/app/BrandMark'
import { PageLoader } from '@/components/app/Loader'

const GOOGLE_MARK = (
  <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

function appContinueUrl(state: string) {
  return `/auth/desktop?state=${encodeURIComponent(state)}`
}

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const desktopState = params.get('state')
  const [mode, setMode] = React.useState(params.get('mode') === 'register' ? 'register' : 'login')
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [passwordConfirm, setPasswordConfirm] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState(queryError(params.get('error'), params.get('verify')))
  const [busy, setBusy] = React.useState(false)
  const [checking, setChecking] = React.useState(Boolean(params.get('state')))
  const next = params.get('next') || '/dashboard'

  React.useEffect(() => {
    let cancelled = false
    void api.session().then((result) => {
      if (cancelled) return
      if (result.user && desktopState && params.get('prompt') !== '1') {
        window.location.assign(appContinueUrl(desktopState))
        return
      }
      if (result.user && !desktopState) {
        navigate(result.plan === 'none' ? '/dashboard/subscription' : next, { replace: true })
        return
      }
      setChecking(false)
    }).catch(() => {
      if (!cancelled) setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [desktopState, navigate, next, params])

  const goToApp = (plan?: string) => {
    if (desktopState) {
      window.location.assign(appContinueUrl(desktopState))
      return
    }
    navigate(plan === 'none' ? '/dashboard/subscription' : next, { replace: true })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      let plan: string | undefined
      if (mode === 'register') {
        const result = await api.register({ email, password, passwordConfirm, name: name || undefined })
        plan = result.plan
        if (result.needsVerification) {
          setError('Check your email for a verification link, then sign in.')
          setMode('login')
          return
        }
      } else {
        const result = await api.login(email, password)
        plan = result.plan
      }
      goToApp(plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { url } = await api.google(desktopState || undefined)
      window.location.assign(url)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Google sign-in is unavailable.')
    }
  }

  const register = mode === 'register'

  if (checking) {
    return (
      <AppShell className="marketing-page flex min-h-screen flex-col items-center justify-center px-5">
        <PageLoader label={desktopState ? 'Connecting to the Tudso app' : 'Loading'} />
      </AppShell>
    )
  }

  return (
    <AppShell className="marketing-page marketing-auth flex min-h-screen flex-col">
      <ThemeToggle className="fixed right-4 top-4 z-20" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center gap-12 px-5 py-10 sm:px-8 lg:gap-24">
        <div className="hidden max-w-xl flex-none md:block">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
            <BrandMark className="h-8 w-8" alt="Tudso" />
            Tudso
          </Link>
          <p className="mt-12 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your unfair interview advantage</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight lg:text-7xl">
            Walk into every interview with <em className="italic">confidence.</em>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Real-time, private support for live interviews. Your copilot stays invisible while you stay focused.
          </p>
        </div>
        <main className="w-full max-w-[420px] rounded-3xl border border-border bg-card p-6 shadow-xl shadow-secondary/20 sm:p-8">
          <Link to="/" className="mb-7 inline-flex md:hidden">
            <BrandMark className="h-12 w-12" alt="Tudso" />
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{register ? 'Start for free' : 'Welcome back'}</p>
          <h2 className="mt-2 font-display text-4xl tracking-tight">
            {register ? 'Create your account' : 'Sign in'}
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            {register
              ? 'Use this account in the Tudso app without entering your password again.'
              : 'After you sign in here, the Tudso app can connect without asking for your password.'}
          </p>

        {error ? <p className="mt-4 text-[13px] text-danger" role="alert">{error}</p> : null}

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          {register ? (
            <Field icon={<User className="h-3.5 w-3.5" />} label="Name" htmlFor="name">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Your name" autoComplete="name" />
            </Field>
          ) : null}
          <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field
            icon={<Lock className="h-3.5 w-3.5" />}
            label="Password"
            htmlFor="password"
            extra={
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-fg"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          >
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={register ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={register ? 'At least 8 characters' : 'Your password'}
              autoComplete={register ? 'new-password' : 'current-password'}
            />
          </Field>
          {register ? (
            <Field icon={<Lock className="h-3.5 w-3.5" />} label="Confirm password" htmlFor="passwordConfirm">
              <Input
                id="passwordConfirm"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
            </Field>
          ) : null}
          <Button type="submit" variant="fill" size="compact" className="h-10 w-full" disabled={busy} loading={busy}>
            {register ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {register ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="soft" size="compact" className="h-10 w-full" disabled={busy} onClick={() => void google()}>
          {GOOGLE_MARK}
          Continue with Google
        </Button>

        {mode === 'login' ? (
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            <a
              className="text-accent hover:underline"
              href={desktopState ? `/auth/desktop/forgot?state=${encodeURIComponent(desktopState)}` : '/auth/desktop/forgot'}
            >
              Forgot password?
            </a>
          </p>
        ) : null}

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {register ? (
            <>Already have an account? <button type="button" className="font-medium text-fg hover:underline" onClick={() => setMode('login')}>Sign in</button></>
          ) : (
            <>New here? <button type="button" className="font-medium text-fg hover:underline" onClick={() => setMode('register')}>Create an account</button></>
          )}
        </p>
        </main>
      </div>
    </AppShell>
  )
}

function Field({
  icon,
  label,
  htmlFor,
  extra,
  children,
}: {
  icon: React.ReactNode
  label: string
  htmlFor: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </Label>
        {extra}
      </div>
      {children}
    </div>
  )
}

function queryError(error: string | null, verify: string | null) {
  if (verify) return 'Check your email for a verification link, then sign in.'
  if (error === 'expired') return 'That sign-in link expired. Try Google again.'
  if (error === 'oauth') return 'Google sign-in failed. Try email instead.'
  return null
}
