import { useEffect, useState } from 'react'
import { Download, Globe, KeyRound, Laptop, LogOut, Mail, Monitor, Terminal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const isCurrent = (device: Device) => Boolean(device.current || (session?.deviceId && device.deviceId === session.deviceId))
  const email = session?.email ?? ''
  const canDelete = deleteEmail.trim().toLowerCase() === email.trim().toLowerCase()

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
        This account, signed-in devices, and actions that change access. Destructive steps ask for confirmation here.
      </p>

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Signed in</h3>
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-2 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">{email || 'Unknown account'}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">Log out only ends this session.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={Boolean(busy)} loading={busy === 'logout'} onClick={() => void run('logout', () => logout(), 'Signed out.')}>
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
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
