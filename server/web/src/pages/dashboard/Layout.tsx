import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as React from 'react'
import { CreditCard, LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react'
import { api, type Account } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AppShell, ThemeSwitch } from '@/components/app/AppShell'
import { BrandMark } from '@/components/app/BrandMark'
import { PageLoader } from '@/components/app/Loader'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'

type DashboardContext = Account & { setAccount: (account: Account) => void }

const NAV = [
  { label: 'Workspace', items: [{ to: '/dashboard', end: true, icon: LayoutDashboard, title: 'Overview' }] },
  { label: 'Billing', items: [{ to: '/dashboard/subscription', icon: CreditCard, title: 'Subscription' }] },
  { label: 'Account', items: [{ to: '/dashboard/account', icon: User, title: 'Account' }] },
] as const

export default function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = React.useState<Account | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [logoutOpen, setLogoutOpen] = React.useState(false)

  React.useEffect(() => {
    void api.session().then((result) => {
      setSession(result.user)
      setLoading(false)
    }).catch(() => {
      setSession(null)
      setLoading(false)
    })
  }, [])

  React.useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  React.useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  if (loading) {
    return (
      <AppShell className="flex h-dvh items-center justify-center px-4">
        <PageLoader label="Loading dashboard" />
      </AppShell>
    )
  }
  if (!session) return <Navigate to="/login?next=/dashboard" replace />

  const logout = async () => {
    await api.logout().catch(() => undefined)
    navigate('/')
  }

  return (
    <AppShell className="dashboard-page flex h-dvh overflow-hidden">
      <button
        type="button"
        className={cn(
          'fixed inset-0 z-20 bg-fg/30 opacity-0 transition-opacity duration-300 ease-out md:hidden',
          menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none',
        )}
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-[236px] flex-col border-r border-border bg-card/80 backdrop-blur transition-transform duration-300 ease-out md:static md:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        aria-label="Dashboard"
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-4">
          <NavLink to="/dashboard" className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
            <BrandMark />
            Tudso
          </NavLink>
          <Button type="button" variant="quiet" size="icon" className="md:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <DashLink to={item.to} end={'end' in item ? item.end : undefined} icon={<item.icon className="h-3.5 w-3.5" />}>
                      {item.title}
                    </DashLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <ThemeSwitch className="mb-2 w-full" />
          <div className="flex items-center gap-2 px-1 py-0.5">
            <Avatar name={session.name} email={session.email} src={session.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium" title={session.name || session.email}>
                {session.name || 'Account'}
              </p>
              <p className="truncate text-[11px] text-muted-foreground" title={session.email}>
                {session.email}
              </p>
            </div>
          </div>
          <Button
            variant="soft"
            size="compact"
            className="mt-2 w-full text-muted-foreground hover:bg-danger/20 hover:text-danger"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:hidden">
          <Button type="button" variant="quiet" size="icon" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
          <span className="text-[13px] font-medium">{pageTitle(location.pathname)}</span>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
            <Outlet context={{ ...session, setAccount: setSession } satisfies DashboardContext} />
          </div>
        </main>
      </div>
      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Log out of this browser?"
        description="Your session will end on this browser. You can sign in again at any time."
        confirmLabel="Log out"
        destructive
        onConfirm={() => {
          setLogoutOpen(false)
          void logout()
        }}
      />
    </AppShell>
  )
}

function pageTitle(path: string) {
  if (path.startsWith('/dashboard/subscription')) return 'Subscription'
  if (path.startsWith('/dashboard/account')) return 'Account'
  return 'Overview'
}

function DashLink({ to, end, icon, children }: { to: string; end?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-all duration-200 ease-out',
          isActive ? 'bg-surface-2 font-medium text-fg' : 'text-muted-foreground hover:bg-lift hover:text-fg',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

function initials(name: string, email: string) {
  const source = name.trim() || email.trim()
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2)
}

function Avatar({ name, email, src }: { name: string; email: string; src: string | null }) {
  if (src) {
    return <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-medium">
      {initials(name, email)}
    </span>
  )
}
