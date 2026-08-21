import * as React from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Download, Globe, Laptop, LogOut, Mail, Monitor, Terminal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, type Device } from '@/lib/api'

export default function Account() {
  const session = useOutletContext<{ email: string; userId: string }>()
  const navigate = useNavigate()
  const [devices, setDevices] = React.useState<Device[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [deleteEmail, setDeleteEmail] = React.useState('')

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

  const email = session.email ?? ''
  const canDelete = deleteEmail.trim().toLowerCase() === email.trim().toLowerCase()
  const isCurrent = (device: Device) => Boolean(device.current || device.deviceId === 'web-dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Devices, export, and deletion. These are the same server records the Tudso app uses.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Signed in</h2>
        <div className="flex items-start gap-2.5 rounded-md bg-surface-2 px-3 py-2.5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-[14px] font-medium">{email || 'Unknown account'}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Open the Tudso app while this tab is signed in to connect without a password.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Devices</h2>
        {!loaded ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] text-muted-foreground">Loading devices…</p>
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

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted-foreground">{status}</p> : null}
    </div>
  )
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
