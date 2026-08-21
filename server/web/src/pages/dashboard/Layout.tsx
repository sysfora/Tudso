import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import * as React from 'react'
import { CreditCard, LayoutDashboard, LogOut, User } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AppShell, ThemeToggle } from '@/components/app/AppShell'
import { BrandMark } from '@/components/app/BrandMark'
import { cn } from '@/lib/utils'

type Session = { userId: string; email: string }

export default function DashboardLayout() {
  const navigate = useNavigate()
  const [session, setSession] = React.useState<Session | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    void api.session().then((result) => {
      setSession(result.user)
      setLoading(false)
    }).catch(() => {
      setSession(null)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <AppShell className="flex items-center justify-center px-4 text-[13px] text-muted-foreground">
        Loading…
      </AppShell>
    )
  }
  if (!session) return <Navigate to="/login?next=/dashboard" replace />

  const logout = async () => {
    await api.logout().catch(() => undefined)
    navigate('/')
  }

  return (
    <AppShell>
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <NavLink to="/dashboard" className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <BrandMark />
          Tudso
        </NavLink>
        <nav className="flex flex-wrap items-center gap-0.5">
          <DashLink to="/dashboard" end icon={<LayoutDashboard className="h-3.5 w-3.5" />}>Overview</DashLink>
          <DashLink to="/dashboard/subscription" icon={<CreditCard className="h-3.5 w-3.5" />}>Subscription</DashLink>
          <DashLink to="/dashboard/account" icon={<User className="h-3.5 w-3.5" />}>Account</DashLink>
        </nav>
        <div className="flex items-center gap-1">
          <span className="hidden max-w-[14rem] truncate text-[12px] text-muted-foreground sm:inline">{session.email}</span>
          <ThemeToggle />
          <Button variant="soft" size="compact" onClick={() => void logout()}>
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-5">
        <Outlet context={session} />
      </main>
    </AppShell>
  )
}

function DashLink({ to, end, icon, children }: { to: string; end?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px]',
          isActive ? 'bg-surface-2 font-medium text-fg' : 'text-muted-foreground hover:bg-lift hover:text-fg',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}
