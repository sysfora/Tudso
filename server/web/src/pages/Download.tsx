import { useEffect, useMemo, useState } from 'react'
import { Apple, AppWindow, Copy, Download as DownloadIcon, Monitor, ShieldCheck } from 'lucide-react'
import heroImg from '@/assets/hero-tudso.jpg'
import { MarketingShell } from '@/components/MarketingShell'
import { Button } from '@/components/ui/button'
import { displayFont } from '@/lib/brand'

type ReleaseFile = {
  id: string
  platform: 'Windows' | 'macOS' | 'Linux'
  arch: string
  label: string
  fileName: string
  size: number
  url: string
}

type LatestUpdate = {
  latestVersion: string
  files: ReleaseFile[]
}

const CARDS: Array<{
  id: string
  match: (file: ReleaseFile) => boolean
  title: string
  hint: string
  bg: string
  icon: typeof Monitor
}> = [
  {
    id: 'windows',
    match: (file) => file.platform === 'Windows',
    title: 'Windows',
    hint: 'Installer for Windows 10 and 11',
    bg: 'bg-brand-mint',
    icon: AppWindow,
  },
  {
    id: 'mac',
    match: (file) => file.platform === 'macOS',
    title: 'macOS',
    hint: 'Apple Silicon and Intel',
    bg: 'bg-brand-lavender',
    icon: Apple,
  },
  {
    id: 'linux',
    match: (file) => file.platform === 'Linux',
    title: 'Linux',
    hint: 'AppImage for most distributions',
    bg: 'bg-brand-yellow',
    icon: Monitor,
  },
]

function formatSize(bytes: number) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

const GATEKEEPER_CMD = 'xattr -cr /Applications/Tudso.app && open /Applications/Tudso.app'

function MacGatekeeperHelp({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(GATEKEEPER_CMD)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={compact ? 'mt-4 text-sm text-foreground/80' : 'mx-auto mt-6 max-w-xl rounded-2xl bg-background/70 p-4 text-left text-sm text-foreground/80 sm:mt-8'}>
      <p className="font-medium text-foreground">
        Open the disk image and double-click Install Tudso. That copies the app, clears Gatekeeper, and launches it.
      </p>
      <p className="mt-2">
        Do not open the Tudso icon in the disk image. If Install Tudso is blocked, right-click it and choose Open.
      </p>
      <p className="mt-2">Terminal fallback:</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="block flex-1 overflow-x-auto rounded-xl bg-background px-3 py-2 text-xs">
          {GATEKEEPER_CMD}
        </code>
        <Button type="button" size="sm" onClick={() => void copyCommand()}>
          <Copy className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

function detectPlatform(): 'windows' | 'mac' | 'linux' | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac'
  if (/Linux/i.test(ua)) return 'linux'
  return null
}

export default function Download() {
  const [latest, setLatest] = useState<LatestUpdate | null>(null)
  const [error, setError] = useState('')
  const platform = useMemo(detectPlatform, [])

  useEffect(() => {
    let cancelled = false
    void fetch('/updates/latest')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load downloads')
        return response.json() as Promise<LatestUpdate>
      })
      .then((data) => {
        if (!cancelled) setLatest(data)
      })
      .catch(() => {
        if (!cancelled) setError('Installers are not published yet.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const recommended = latest?.files.find((file) => {
    if (platform === 'windows') return file.platform === 'Windows'
    if (platform === 'linux') return file.platform === 'Linux'
    if (platform === 'mac') return file.id === 'mac-arm64' || file.platform === 'macOS'
    return false
  })

  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-4 sm:px-5">
        <div className="relative overflow-hidden rounded-3xl bg-brand-mint p-6 sm:p-8 md:p-14">
          <h1 className="text-center text-3xl font-black leading-tight sm:text-4xl md:text-6xl" style={displayFont}>
            Download Tudso
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-foreground/80 sm:text-base">
            The floating desktop assistant for Windows, macOS, and Linux. New releases replace the previous installers on this page.
          </p>
          {recommended ? (
            <div className="mt-6 flex flex-col items-center gap-2 sm:mt-8">
              <Button size="lg" asChild>
                <a href={recommended.url}>
                  <DownloadIcon className="h-4 w-4" />
                  Download for {recommended.label}
                </a>
              </Button>
              {latest?.latestVersion ? (
                <p className="text-xs text-foreground/70">Version {latest.latestVersion}</p>
              ) : null}
              {platform === 'mac' ? <MacGatekeeperHelp /> : null}
            </div>
          ) : platform === 'mac' ? (
            <MacGatekeeperHelp />
          ) : null}
          <div className="mt-6 flex justify-center sm:mt-8">
            <img src={heroImg} alt="Tudso mascot" width={1280} height={800} className="w-full max-w-2xl rounded-2xl" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>Choose your system</h2>
          <p className="mt-2 text-sm text-muted-foreground">Always the current version. Older builds are removed when a release goes out.</p>
        </div>
        {error ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">{error}</p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {CARDS.map((card) => {
              const files = (latest?.files ?? []).filter(card.match)
              const Icon = card.icon
              return (
                <div key={card.id} className={`rounded-3xl ${card.bg} p-6 sm:p-8`}>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-background/70">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-black" style={displayFont}>{card.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{card.hint}</p>
                  <div className="mt-5 flex flex-col gap-2">
                    {latest === null && !error ? (
                      <p className="text-sm text-muted-foreground">Checking for the latest build…</p>
                    ) : files.length ? files.map((file) => (
                      <Button key={file.fileName} asChild>
                        <a href={file.url}>
                          <DownloadIcon className="h-4 w-4" />
                          {file.label}
                          {file.size ? <span className="font-normal opacity-70">{formatSize(file.size)}</span> : null}
                        </a>
                      </Button>
                    )) : (
                      <p className="text-sm text-muted-foreground">Not published yet.</p>
                    )}
                    {card.id === 'mac' && platform !== 'mac' ? <MacGatekeeperHelp compact /> : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-8 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-mint" />
          After you install, Tudso checks this site for a newer version.
        </p>
      </section>
    </MarketingShell>
  )
}
