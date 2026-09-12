import { useEffect, useRef, useState } from 'react'
import { Camera, Download, Eye, EyeOff, Globe, KeyRound, Laptop, Lock, LogOut, Mail, Monitor, Terminal, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { api, fetchAccountAvatar } from '@/lib/api'
import { LogoutButton } from '@/components/LogoutButton'
import { formatMemoryDate } from '@/lib/format'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'

type Device = {
  id: string
  deviceId: string
  platform: string
  appVersion: string
  lastSeen: string
  current?: boolean
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

function initials(name: string, email: string) {
  const source = name.trim() || email.trim()
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2)
}

async function refreshLock() {
  const lock = await desktop.app.getLockState()
  const settings = useAppStore.getState().settings
  useAppStore.setState({
    lockEnabled: lock.enabled,
    settings: { ...settings, lockEnabled: lock.enabled },
  })
}

export function Account() {
  const session = useAuthStore((state) => state.session)
  const logout = useAuthStore((state) => state.logout)
  const lockEnabled = useAppStore((state) => state.lockEnabled)
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoaded, setDevicesLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadDevices = async () => {
    try {
      const list = await api.devices.list()
      setDevices(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load devices.')
      setDevices([])
    } finally {
      setDevicesLoaded(true)
    }
  }

  useEffect(() => {
    // U-3: Guard all async setState calls so they do nothing if the component unmounts first
    let mounted = true
    api.devices.list()
      .then((list) => { if (mounted) setDevices(list) })
      .catch((err) => { if (mounted) { setError(err instanceof Error ? err.message : 'Could not load devices.'); setDevices([]) } })
      .finally(() => { if (mounted) setDevicesLoaded(true) })
    api.me.getAccount()
      .then((account) => {
        if (!mounted) return
        setName(account.name)
        setSavedName(account.name)
        setAvatarUrl(account.avatarUrl)
      })
      .catch(() => undefined)
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    void fetchAccountAvatar(avatarUrl).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      objectUrl = url
      setAvatarSrc(url)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [avatarUrl])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

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

  const isCurrent = (device: Device) => Boolean(device.current || (session?.deviceId && device.deviceId === session.deviceId))
  const email = session?.email ?? ''
  const canDelete = deleteEmail.trim().toLowerCase() === email.trim().toLowerCase()
  const shownAvatar = preview || avatarSrc
  const nameDirty = name.trim() !== savedName.trim()

  const savePin = () => {
    if (pin !== pinConfirm) {
      setError('The new PIN entries do not match.')
      return
    }
    void run('pin', async () => {
      await desktop.app.setPin(pin, currentPin || undefined)
      await refreshLock()
      setPin('')
      setPinConfirm('')
      setCurrentPin('')
    }, lockEnabled ? 'PIN updated.' : 'PIN lock is on.')
  }

  const turnOffPin = () => {
    void run('pin-off', async () => {
      const ok = await desktop.app.clearPin(currentPin)
      if (!ok) throw new Error('Current PIN does not match.')
      await refreshLock()
      setCurrentPin('')
      setPin('')
      setPinConfirm('')
    }, 'PIN lock is off.')
  }

  return (
    <div className="space-y-6">
      <p className="text-[12px] leading-relaxed text-muted">
        Name, avatar, and password. Email cannot be changed. Devices and PIN stay on this page.
      </p>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Profile</h3>
        <div className="rounded-md bg-surface-2 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-lift"
                onClick={() => fileRef.current?.click()}
                aria-label="Change avatar"
              >
                {shownAvatar ? (
                  <img src={shownAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[16px] font-medium">
                    {initials(name, email)}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-fg py-0.5 text-bg">
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
                  const url = URL.createObjectURL(file)
                  setPreview(url)
                  void run('avatar', async () => {
                    const account = await api.me.uploadAvatar(file)
                    setSavedName(account.name)
                    setAvatarUrl(account.avatarUrl)
                    URL.revokeObjectURL(url)
                    setPreview(null)
                  }, 'Avatar updated.')
                }}
              />
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-medium">Avatar</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">JPEG, PNG, WebP, or GIF. 2 MB or smaller.</p>
                {avatarUrl ? (
                  <Button
                    className="mt-2"
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(busy)}
                    loading={busy === 'avatar-remove'}
                    onClick={() => {
                      void run('avatar-remove', async () => {
                        const account = await api.me.removeAvatar()
                        setAvatarUrl(account.avatarUrl)
                        setPreview(null)
                      }, 'Avatar removed.')
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <LogoutButton className="shrink-0 text-muted hover:bg-danger/20 hover:text-danger" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="inline-flex items-center gap-1.5 text-[13px]">
                <User className="h-3.5 w-3.5 text-muted" />
                Name
              </Label>
              <Input id="profile-name" value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="inline-flex items-center gap-1.5 text-[13px]">
                <Mail className="h-3.5 w-3.5 text-muted" />
                Email
              </Label>
              <Input id="profile-email" value={email} readOnly disabled autoComplete="email" />
            </div>
          </div>
          <Button
            className="mt-3"
            size="sm"
            disabled={Boolean(busy) || !nameDirty || !name.trim()}
            loading={busy === 'name'}
            onClick={() => {
              void run('name', async () => {
                const account = await api.me.updateName(name.trim())
                setName(account.name)
                setSavedName(account.name)
              }, 'Name updated.')
            }}
          >
            Save name
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Password</h3>
        <form
          className="space-y-3 rounded-md bg-surface-2 px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault()
            void run('password', async () => {
              await api.me.changePassword(currentPassword, password, passwordConfirm)
              setCurrentPassword('')
              setPassword('')
              setPasswordConfirm('')
            }, 'Password updated.')
          }}
        >
          <p className="text-[12px] leading-relaxed text-muted">
            If you signed in with Google and never set a password, reset it from the sign-in page first.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="inline-flex items-center gap-1.5 text-[13px]">
              <Lock className="h-3.5 w-3.5 text-muted" />
              Current password
            </Label>
            <Input
              id="current-password"
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="new-password" className="inline-flex items-center gap-1.5 text-[13px]">
                  <Lock className="h-3.5 w-3.5 text-muted" />
                  New password
                </Label>
                <button type="button" className="text-muted hover:text-fg" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}>
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                minLength={8}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="inline-flex items-center gap-1.5 text-[13px]">
                <Lock className="h-3.5 w-3.5 text-muted" />
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                minLength={8}
                autoComplete="new-password"
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={Boolean(busy) || !currentPassword || password.length < 8 || password !== passwordConfirm}
            loading={busy === 'password'}
          >
            Change password
          </Button>
        </form>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Devices</h3>
        {!devicesLoaded ? (
          <div className="space-y-2 rounded-md bg-surface-2 p-3" aria-busy="true" aria-label="Loading devices">
            <div className="skeleton-bar h-3 w-5/6" />
            <div className="skeleton-bar h-3 w-2/3" style={{ animationDelay: '80ms' }} />
          </div>
        ) : devices.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] leading-relaxed text-muted">
            No devices on this account yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
            {devices.map((device) => {
              const current = isCurrent(device)
              const seen = formatMemoryDate(device.lastSeen)
              return (
                <li key={device.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 text-muted">{platformIcon(device.platform)}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">
                        {platformLabel(device.platform)}
                        {current ? ' · This device' : ''}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                        {device.appVersion || 'Unknown version'}
                        {seen ? ` · ${seen}` : ''}
                      </p>
                    </div>
                  </div>
                  {current ? (
                    <p className="shrink-0 text-[11px] text-muted">Current</p>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={Boolean(busy)}
                      loading={busy === `device-${device.id}`}
                      onClick={() => {
                        if (!window.confirm('Revoke this device? It is signed out and must sign in again.')) return
                        void run(`device-${device.id}`, async () => {
                          await api.devices.delete(device.deviceId)
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
              <LogOut className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <div>
                <p className="text-[13px] font-medium">Sign out other sessions</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">End every session except this one.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(busy)}
              loading={busy === 'revoke-others'}
              onClick={() => {
                if (!window.confirm('Sign out every other device? This one stays signed in.')) return
                void run('revoke-others', async () => {
                  await api.devices.revokeOthers()
                  await loadDevices()
                }, 'Other sessions signed out.')
              }}
            >
              Sign out others
            </Button>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Security</h3>
        <div className="space-y-2">
          <div className="rounded-md bg-surface-2 p-3">
            <div className="flex items-start gap-2.5">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div>
                <p className="text-[13px] font-medium">PIN lock</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              {lockEnabled
                ? 'Tudso asks for this PIN when it opens. Kept only on this device. Enter the current PIN to change or turn it off.'
                : 'Require a 4 to 8 digit PIN when Tudso opens. Kept only on this device.'}
            </p>
            <div className="mt-3 space-y-2">
              {lockEnabled ? (
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  value={currentPin}
                  placeholder="Current PIN"
                  aria-label="Current PIN"
                  onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ''))}
                />
              ) : null}
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={pin}
                placeholder={lockEnabled ? 'New PIN' : 'PIN'}
                aria-label={lockEnabled ? 'New PIN' : 'PIN'}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              />
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={pinConfirm}
                placeholder={lockEnabled ? 'Confirm new PIN' : 'Confirm PIN'}
                aria-label={lockEnabled ? 'Confirm new PIN' : 'Confirm PIN'}
                onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, ''))}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={Boolean(busy) || pin.length < 4 || pinConfirm.length < 4 || (lockEnabled && currentPin.length < 4)}
                  loading={busy === 'pin'}
                  onClick={savePin}
                >
                  {lockEnabled ? 'Change PIN' : 'Turn on'}
                </Button>
                {lockEnabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Boolean(busy) || currentPin.length < 4}
                    loading={busy === 'pin-off'}
                    onClick={turnOffPin}
                  >
                    Turn off
                  </Button>
                ) : null}
              </div>
            </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Data</h3>
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-2 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            <div>
              <p className="text-[13px] font-medium">Export my data</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">Download profile, chats, and memories from this device, plus billing from your account.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(busy)}
            loading={busy === 'export'}
            onClick={() => {
              if (!window.confirm('Export includes chats, profile, and memories stored on this device. Continue?')) return
              void run('export', async () => {
                const userId = session?.userId
                const [account, local, conversations] = await Promise.all([
                  api.me.export(),
                  userId ? desktop.profile.get(userId) : Promise.resolve(null),
                  desktop.conversations.list(),
                ])
                const data = {
                  ...(account as object),
                  profile: local?.profile ?? null,
                  resume: local?.resume ? { fileName: local.resume.fileName, mimeType: local.resume.mimeType } : null,
                  onboardingComplete: local?.complete === true,
                  memories: local?.memories ?? [],
                  memoryEnabled: local?.memoryEnabled !== false,
                  conversations,
                  note: 'Profile, resume, chats, memories, and PIN stay on this device. Billing is from the account.',
                }
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
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Delete account</h3>
        <div className="rounded-md bg-surface-2 p-3">
          <div className="flex items-start gap-2.5">
            <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            <div>
              <p className="text-[13px] font-medium">Delete this account</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            Permanently removes this account, devices, and billing. Chats, profile, memories, and PIN stay on this device until you clear local data. Type {email || 'your email'} to confirm.
          </p>
          <Input
            className="mt-3"
            autoComplete="off"
            value={deleteEmail}
            placeholder={email || 'Email'}
            aria-label="Type your email to confirm deletion"
            onChange={(event) => setDeleteEmail(event.target.value)}
          />
          <div className="mt-2">
            <Button
              variant="danger"
              size="sm"
              disabled={Boolean(busy) || !canDelete}
              loading={busy === 'delete'}
              onClick={() => {
                void run('delete', async () => {
                  await api.me.deleteAccount(deleteEmail.trim())
                  await logout()
                }, 'Account deleted.')
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </Button>
          </div>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted">{status}</p> : null}
    </div>
  )
}
