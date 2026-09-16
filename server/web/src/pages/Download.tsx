import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Download as DownloadIcon, ExternalLink } from 'lucide-react'
import heroImg from '@/assets/hero-desktop.jpg'
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
  releaseNotesUrl?: string
  source?: 'local' | 'github'
}

const CARDS: Array<{
  id: string
  match: (file: ReleaseFile) => boolean
  title: string
  hint: string
  bg: string
  icon: string
}> = [
  {
    id: 'windows',
    match: (file) => file.platform === 'Windows',
    title: 'Windows',
    hint: 'Installer for Windows 10 and 11',
    bg: 'bg-brand-mint',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows8/windows8-original.svg',
  },
  {
    id: 'mac',
    match: (file) => file.platform === 'macOS',
    title: 'macOS',
    hint: 'Apple Silicon and Intel',
    bg: 'bg-brand-lavender',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apple/apple-original.svg',
  },
  {
    id: 'linux',
    match: (file) => file.platform === 'Linux',
    title: 'Linux',
    hint: 'AppImage for most distributions',
    bg: 'bg-brand-yellow',
    icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg',
  },
]

function formatSize(bytes: number) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

const GATEKEEPER_CMD = 'xattr -cr /Applications/Tudso.app && open /Applications/Tudso.app'

function MacGatekeeperHelp() {
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
    <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-background/70 p-4 text-left text-sm text-foreground/80 sm:mt-8">
      <p className="font-medium text-foreground">
        After copying Tudso to your App folder, type the following command in your terminal.
      </p>
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
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-5 sm:pt-28">
        <div className="relative overflow-hidden rounded-[2rem] bg-secondary text-secondary-foreground shadow-2xl shadow-secondary/15">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(196,198,255,0.28),transparent_30%),radial-gradient(circle_at_20%_100%,rgba(226,244,237,0.16),transparent_35%)]" />
          <div className="relative grid items-center gap-10 p-6 sm:p-10 md:grid-cols-[1.05fr_.95fr] md:p-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-secondary-foreground/15 bg-secondary-foreground/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/75">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-mint" />
                Desktop app
              </div>
              <h1 className="mt-6 max-w-xl text-4xl font-black leading-[0.98] sm:text-5xl md:text-7xl" style={displayFont}>
                Your best answers, always within reach.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-secondary-foreground/70 sm:text-base">
                Keep Tudso ready for your next interview with a focused desktop copilot for Windows, macOS, and Linux.
              </p>
              {recommended ? (
                <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <Button size="lg" className="bg-white text-black shadow-lg shadow-black/10 hover:bg-white/90" asChild>
                    <a href={recommended.url}>
                      <DownloadIcon className="h-4 w-4" />
                      Download for {recommended.label}
                    </a>
                  </Button>
                  {latest?.latestVersion ? <span className="text-xs text-secondary-foreground/55">v{latest.latestVersion}</span> : null}
                </div>
              ) : null}
              {latest?.source === 'github' ? (
                <p className="mt-4 inline-flex items-center gap-2 text-xs text-secondary-foreground/55">
                  <Check className="h-3.5 w-3.5 text-brand-mint" />
                  Latest release served directly from GitHub
                </p>
              ) : null}
              {platform === 'mac' ? <MacGatekeeperHelp /> : null}
            </div>
            <div className="relative">
              <div className="absolute -inset-5 rounded-[2rem] border border-white/10" />
              <img src={heroImg} alt="Tudso interview copilot over a live interview" width={1920} height={1200} className="relative w-full rounded-[1.5rem] border border-white/10 shadow-2xl" />
              <div className="absolute -bottom-4 left-4 rounded-xl border border-secondary-foreground/15 bg-secondary/90 px-3 py-2 text-xs text-secondary-foreground/75 shadow-xl backdrop-blur sm:left-6">
                Private by design <span className="mx-1 text-secondary-foreground/30">·</span> Built for focus
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Choose your setup</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl" style={displayFont}>Ready for every platform</h2>
          </div>
          {latest?.releaseNotesUrl ? (
            <a href={latest.releaseNotesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              View release notes <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
        {error ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">{error}</p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {CARDS.map((card) => {
              const files = (latest?.files ?? []).filter(card.match)
              return (
                <div key={card.id} className={`group rounded-3xl ${card.bg} p-6 sm:p-8`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-background/70">
                      <img src={card.icon} alt={`${card.title} logo`} className="h-6 w-6" />
                    </div>
                  </div>
                  <h3 className="mt-5 text-xl font-black" style={displayFont}>{card.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{card.hint}</p>
                  <div className="mt-5 flex flex-col gap-2">
                    {latest === null && !error ? (
                      <p className="text-sm text-muted-foreground">Checking for the latest build…</p>
                    ) : files.length ? files.map((file) => (
                      <Button key={file.fileName} className="bg-white text-black hover:bg-white/90" asChild>
                        <a href={file.url}>
                          <DownloadIcon className="h-4 w-4" />
                          {file.label}
                          {file.size ? <span className="font-normal opacity-70">{formatSize(file.size)}</span> : null}
                        </a>
                      </Button>
                    )) : (
                      <p className="rounded-xl bg-background/45 px-3 py-2 text-sm text-muted-foreground">No installer available for this platform yet.</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </MarketingShell>
  )
}
