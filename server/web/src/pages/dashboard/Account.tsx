import * as React from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Camera,
  Download,
  Eye,
  EyeOff,
  Globe,
  Laptop,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Terminal,
  Trash2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, type Account as AccountRecord, type Device } from '@/lib/api'
import { SkeletonBar } from '@/components/app/Loader'

type DashboardContext = AccountRecord & { setAccount: (account: AccountRecord) => void }

export default function Account() {
  const session = useOutletContext<DashboardContext>()
  const navigate = useNavigate()
  const [devices, setDevices] = React.useState<Device[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [deleteEmail, setDeleteEmail] = React.useState('')
  const [name, setName] = React.useState(session.name ?? '')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [passwordConfirm, setPasswordConfirm] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [preview, setPreview] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setName(session.name ?? '')
  }, [session.name])

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const loadDevices = async () => {
    try {
      setDevices(await api.devices())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load devices.')
      setDevices([])
    } finally {
      setLoaded(true)
    }
  }

  React.useEffect(() => {
    void loadDevices()
  }, [])

  const run = async (key: string, work: () => Promise<unknown>, message: string) => {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await work()
      setStatus(message)
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Could not complete that action.')
    } finally {
      setBusy(null)
    }
  }

  const applyAccount = (account: AccountRecord) => {
    session.setAccount(account)
    setName(account.name)
    if (preview) {
      URL.revokeObjectURL(preview)
      setPreview(null)
    }
  }

  const email = session.email ?? ''
  const canDelete = deleteEmail.trim().toLowerCase() === email.trim().toLowerCase()
  const isCurrent = (device: Device) => Boolean(device.current || device.deviceId === 'web-dashboard')
  const avatarSrc = preview || session.avatarUrl
  const nameDirty = name.trim() !== (session.name ?? '').trim()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Name, avatar, and password. Email cannot be changed. Devices and deletion use the same records as the Tudso app.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Profile</h2>
        <div className="rounded-md bg-surface-2 px-3 py-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-lift"
                onClick={() => fileRef.current?.click()}
                aria-label="Change avatar"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[16px] font-medium">
                    {initials(name, email)}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-fg py-0.5 text-background">
                  <Camera className="h-3 w-3" />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  if (preview) URL.revokeObjectURL(preview)
                  setPreview(URL.createObjectURL(file))
                  void run('avatar', async () => {
                    applyAccount(await api.uploadAvatar(file))
                  }, 'Avatar updated.')
                }}
              />
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-medium">Avatar</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  JPEG, PNG, WebP, or GIF. 2 MB or smaller.
                </p>
                {session.avatarUrl ? (
                  <Button
                    className="mt-2"
                    variant="quiet"
                    size="compact"
                    disabled={Boolean(busy)}
                    loading={busy === 'avatar-remove'}
                    onClick={() => {
                      void run('avatar-remove', async () => {
                        applyAccount(await api.removeAvatar())
                      }, 'Avatar removed.')
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Name" htmlFor="profile-name">
              <Input
                id="profile-name"
                value={name}
                maxLength={80}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" htmlFor="profile-email">
              <Input id="profile-email" value={email} readOnly disabled autoComplete="email" />
            </Field>
          </div>
          <Button
            className="mt-3"
            variant="fill"
            size="compact"
            disabled={Boolean(busy) || !nameDirty || !name.trim()}
            loading={busy === 'name'}
            onClick={() => {
              void run('name', async () => {
                applyAccount(await api.updateName(name.trim()))
              }, 'Name updated.')
            }}
          >
            Save name
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Password</h2>
        <form
          className="space-y-3 rounded-md bg-surface-2 px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault()
            void run('password', async () => {
              await api.changePassword(currentPassword, password, passwordConfirm)
              setCurrentPassword('')
              setPassword('')
              setPasswordConfirm('')
            }, 'Password updated.')
          }}
        >
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            If you signed in with Google and never set a password, use Forgot password first.
          </p>
          <Field icon={<Lock className="h-3.5 w-3.5" />} label="Current password" htmlFor="current-password">
            <Input
              id="current-password"
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              icon={<Lock className="h-3.5 w-3.5" />}
              label="New password"
              htmlFor="new-password"
              extra={
                <button type="button" className="text-muted-foreground hover:text-fg" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}>
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              }
            >
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                minLength={8}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field icon={<Lock className="h-3.5 w-3.5" />} label="Confirm password" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                minLength={8}
                autoComplete="new-password"
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </Field>
          </div>
          <Button
            type="submit"
            variant="fill"
            size="compact"
            disabled={Boolean(busy) || !currentPassword || password.length < 8 || password !== passwordConfirm}
            loading={busy === 'password'}
          >
            Change password
          </Button>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Devices</h2>
        {!loaded ? (
          <div className="space-y-2 rounded-md bg-surface-2 p-3" aria-busy="true" aria-label="Loading devices">
            <SkeletonBar className="h-3 w-5/6" />
            <SkeletonBar className="h-3 w-2/3" delay={80} />
            <SkeletonBar className="h-3 w-3/4" delay={160} />
          </div>
        ) : devices.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] text-muted-foreground">No devices on this account yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
            {devices.map((device) => {
              const current = isCurrent(device)
              return (
                <li key={device.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 text-muted-foreground">{platformIcon(device.platform)}</span>
                    <div>
                      <p className="text-[13px] font-medium">
                        {platformLabel(device.platform)}
                        {current ? ' · This browser' : ''}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {device.appVersion || 'Unknown version'}
                        {device.lastSeen ? ` · ${formatDate(device.lastSeen)}` : ''}
                      </p>
                    </div>
                  </div>
                  {current ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">Current</span>
                  ) : (
                    <Button
                      variant="danger"
                      size="compact"
                      disabled={Boolean(busy)}
                      loading={busy === `device-${device.id}`}
                      onClick={() => {
                        if (!window.confirm('Revoke this device? It must sign in again.')) return
                        void run(`device-${device.id}`, async () => {
                          await api.deleteDevice(device.deviceId)
                          await loadDevices()
                        }, 'Device revoked.')
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {devices.some((device) => !isCurrent(device)) ? (
          <div className="mt-2 flex items-center justify-between gap-4 rounded-md bg-surface-2 px-3 py-2.5">
            <div className="flex min-w-0 items-start gap-2.5">
              <LogOut className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px] font-medium">Sign out other sessions</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">End every session except this browser.</p>
              </div>
            </div>
            <Button
              variant="soft"
              size="compact"
              disabled={Boolean(busy)}
              loading={busy === 'revoke-others'}
              onClick={() => {
                if (!window.confirm('Sign out every other device? This browser stays signed in.')) return
                void run('revoke-others', async () => {
                  await api.revokeOthers()
                  await loadDevices()
                }, 'Other sessions signed out.')
              }}
            >
              Sign out others
            </Button>
          </div>
        ) : null}
      </section>

      <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Data</h2>
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-2 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[13px] font-medium">Export my data</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">Download billing and usage. Profile, chats, and memories stay on the desktop app.</p>
            </div>
          </div>
          <Button
            variant="soft"
            size="compact"
            disabled={Boolean(busy)}
            loading={busy === 'export'}
            onClick={() => {
              if (!window.confirm('Export billing and usage from this account. Continue?')) return
              void run('export', async () => {
                const data = await api.exportData()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `tudso-export-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }, 'Export downloaded.')
            }}
          >
            Export
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Delete account</h2>
        <div className="rounded-md bg-surface-2 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Permanently removes this account, devices, and billing. Profile, chats, memories, and PIN on the desktop app are not deleted. Type {email || 'your email'} to confirm.
            </p>
          </div>
          <Input className="mt-3" autoComplete="off" value={deleteEmail} placeholder={email || 'Email'} onChange={(e) => setDeleteEmail(e.target.value)} />
          <Button
            className="mt-2"
            variant="danger"
            size="compact"
            disabled={Boolean(busy) || !canDelete}
            loading={busy === 'delete'}
            onClick={() => {
              void run('delete', async () => {
                await api.deleteAccount(deleteEmail.trim())
                await api.logout().catch(() => undefined)
                navigate('/')
              }, 'Account deleted.')
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete account
          </Button>
        </div>
      </section>
      </div>
      </div>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted-foreground">{status}</p> : null}
    </div>
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

function initials(name: string, email: string) {
  const source = name.trim() || email.trim()
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2)
}

function platformIcon(value: string) {
  if (value === 'darwin') return <Laptop className="h-3.5 w-3.5" />
  if (value === 'linux') return <Terminal className="h-3.5 w-3.5" />
  if (value === 'web') return <Globe className="h-3.5 w-3.5" />
  return <Monitor className="h-3.5 w-3.5" />
}

function platformLabel(value: string) {
  if (value === 'win32') return 'Windows'
  if (value === 'darwin') return 'Mac'
  if (value === 'linux') return 'Linux'
  if (value === 'web') return 'Web'
  return value || 'Unknown'
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(date)
}
