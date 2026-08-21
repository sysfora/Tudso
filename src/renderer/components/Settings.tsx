import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import { FONT_SIZE_MAX, FONT_SIZE_MIN, DEFAULT_SETTINGS, MODEL_OPTIONS, resolveChatModel } from '@shared/defaults'
import { canHideFromCapture } from '@shared/plans'
import type { Settings, SettingsSection, ThemeMode } from '@shared/types'
import { ShortcutManager } from '@/components/ShortcutManager'
import { Subscription } from '@/components/Subscription'
import { Account } from '@/components/Account'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconButton } from '@/components/ui/icon-button'
import { Input, Kbd, Textarea } from '@/components/ui/input'
import type { MemoryEntry, UserProfile } from '@/types/api'
import { MAX_MEMORIES, MAX_MEMORY_CHARS, resolveProfilePreferences } from '@/types/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { desktop } from '@/lib/desktop'
import { cn } from '@/lib/cn'
import { createId, formatMemoryDate } from '@/lib/format'
import { previewAppearance } from '@/hooks/use-theme'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'

const NAV: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'ai', label: 'AI' },
  { id: 'shortcuts', label: 'Keyboard' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'profile', label: 'Profile' },
  { id: 'memory', label: 'Memory' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'account', label: 'Account' },
]

const SettingsSearchContext = createContext('')
const SettingsSearchSectionContext = createContext('')

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function matchesSearch(query: string, ...parts: Array<string | undefined>) {
  const needle = normalizeSearch(query)
  if (!needle) return true
  return parts.some((part) => part?.toLowerCase().includes(needle))
}

function useSettingVisible(...parts: Array<string | undefined>) {
  const query = useContext(SettingsSearchContext)
  const section = useContext(SettingsSearchSectionContext)
  return matchesSearch(query, section, ...parts)
}

export function Settings() {
  const section = useAppStore((state) => state.settingsSection)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const [query, setQuery] = useState('')
  const showSearch = section !== 'shortcuts'
  const searching = showSearch && Boolean(normalizeSearch(query))

  useEffect(() => {
    if (section === 'shortcuts') setQuery('')
  }, [section])

  return (
    <div className="flex min-h-0 flex-1 flex-col anim-fade">
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        <h2 className="text-[15px] font-semibold">Settings</h2>
        <IconButton label="Close settings" className="hover:bg-danger/20 hover:text-danger" onClick={() => setSettingsOpen(false)}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav className="w-[148px] shrink-0 border-r border-border p-2" aria-label="Settings sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSettingsOpen(true, item.id)}
              aria-current={section === item.id ? 'page' : undefined}
              className={cn(
                'mb-0.5 w-full rounded-md bg-transparent px-2 py-1.5 text-left text-[13px] text-muted transition-colors duration-150 hover:bg-lift hover:text-fg',
                section === item.id && 'bg-raised font-medium text-fg hover:bg-lift',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showSearch ? (
            <div className="shrink-0 px-4 pt-3" role="search">
              <div className="flex items-center gap-2 rounded-md bg-surface-2 px-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search settings"
                  className="h-9 border-0 bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent"
                  aria-label="Search settings"
                />
                {query ? (
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-lift hover:text-fg"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <ScrollArea className="min-h-0 flex-1">
            <SettingsSearchContext.Provider value={showSearch ? query : ''}>
              <div className="p-4">
                {searching ? (
                  <div className="space-y-6 has-[[data-setting]]:[&_.settings-empty]:hidden">
                    <p className="settings-empty py-8 text-center text-[13px] text-muted">
                      No settings match “{query.trim()}”.
                    </p>
                    <SettingsPages section={section} searching />
                  </div>
                ) : (
                  <SettingsPages section={section} searching={false} />
                )}
              </div>
            </SettingsSearchContext.Provider>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function SettingsPages({ section, searching }: { section: SettingsSection; searching: boolean }) {
  return (
    <>
      {searching || section === 'general' ? (
        <SearchSection title="General">
          <GeneralSection />
        </SearchSection>
      ) : null}
      {searching || section === 'appearance' ? (
        <SearchSection title="Appearance">
          <AppearanceSection />
        </SearchSection>
      ) : null}
      {searching || section === 'ai' ? (
        <SearchSection title="AI">
          <AiSection />
        </SearchSection>
      ) : null}
      {!searching && section === 'shortcuts' ? <ShortcutManager /> : null}
      {searching || section === 'privacy' ? (
        <SearchSection title="Privacy">
          <PrivacySection />
        </SearchSection>
      ) : null}
      {searching || section === 'profile' ? (
        <SearchSection title="Profile">
          <ProfileSection />
        </SearchSection>
      ) : null}
      {searching || section === 'memory' ? (
        <SearchSection title="Memory">
          <MemorySection />
        </SearchSection>
      ) : null}
      {searching || section === 'subscription' ? (
          <SearchablePanel title="Subscription" terms={['plan', 'billing', 'upgrade', 'weekly', 'monthly', 'yearly', 'manage', 'cancel', 'subscribe']}>
          <SubscriptionSection />
        </SearchablePanel>
      ) : null}
      {searching || section === 'account' ? (
        <SearchablePanel
          title="Account"
          terms={['signed in', 'email', 'devices', 'export', 'delete account', 'log out', 'logout', 'data', 'pin', 'security', 'revoke']}
        >
          <AccountSection />
        </SearchablePanel>
      ) : null}
    </>
  )
}

function SearchSection({ title, children }: { title: string; children: ReactNode }) {
  const query = useContext(SettingsSearchContext)
  const searching = Boolean(normalizeSearch(query))
  return (
    <SettingsSearchSectionContext.Provider value={title}>
      <section className={cn(searching && '[&:not(:has([data-setting]))]:hidden')}>
        {searching ? (
          <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">{title}</h3>
        ) : null}
        {children}
      </section>
    </SettingsSearchSectionContext.Provider>
  )
}

function SearchablePanel({
  title,
  terms,
  children,
}: {
  title: string
  terms: string[]
  children: ReactNode
}) {
  const query = useContext(SettingsSearchContext)
  const searching = Boolean(normalizeSearch(query))
  if (!matchesSearch(query, title, ...terms)) return null
  return (
    <section data-setting>
      {searching ? (
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">{title}</h3>
      ) : null}
      {children}
    </section>
  )
}

function Row({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const visible = useSettingVisible(title, description)
  if (!visible) return null
  return (
    <div data-setting className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        {description ? <p className="mt-0.5 max-w-[280px] text-[12px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function settingsAreCustomized(settings: Settings) {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).some((key) => {
    if (key === 'defaultsRevision' || key === 'alwaysOnTop') return false
    return settings[key] !== DEFAULT_SETTINGS[key]
  })
}

function GeneralSection() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const resetSettings = useAppStore((state) => state.resetSettings)
  const entitlement = useAuthStore((state) => state.entitlement)
  const hideAllowed = canHideFromCapture(entitlement?.plan, entitlement?.status)
  const [resetting, setResetting] = useState(false)

  return (
    <div>
      <Row title="Launch at startup" description="Open Tudso when you sign in.">
        <Switch checked={settings.launchAtStartup} onCheckedChange={(value) => void setSettings({ launchAtStartup: value })} />
      </Row>
      <Row title="Start minimized" description="Start hidden until you summon it with the toggle shortcut.">
        <Switch checked={settings.startMinimized} onCheckedChange={(value) => void setSettings({ startMinimized: value })} />
      </Row>
      <Row title="Remember window position">
        <Switch checked={settings.rememberPosition} onCheckedChange={(value) => void setSettings({ rememberPosition: value })} />
      </Row>
      <Row title="Remember window size">
        <Switch checked={settings.rememberSize} onCheckedChange={(value) => void setSettings({ rememberSize: value })} />
      </Row>
      {hideAllowed ? (
        <Row title="Hide from screen share" description="Stay invisible in screenshots, recordings, and shared screens.">
          <Switch checked={settings.hideFromCapture} onCheckedChange={(value) => void setSettings({ hideFromCapture: value })} />
        </Row>
      ) : null}
      <Row title="Show in taskbar" description="Keep a taskbar button after you sign in. Sign-in and onboarding always show one.">
        <Switch checked={settings.showInTaskbar} onCheckedChange={(value) => void setSettings({ showInTaskbar: value })} />
      </Row>
      <Row title="Show in system tray" description="Keep a tray icon after you sign in so you can reopen a hidden window.">
        <Switch checked={settings.showInTray} onCheckedChange={(value) => void setSettings({ showInTray: value })} />
      </Row>
      <Row title="Minimize to system tray" description="Minimize hides the window to the tray instead of collapsing to the title bar.">
        <Switch checked={settings.minimizeToTray} onCheckedChange={(value) => void setSettings({ minimizeToTray: value })} />
      </Row>
      <Row title="Reset all settings" description="Restore every setting to its default. Keyboard shortcuts are not changed.">
        <Button
          variant="outline"
          size="sm"
          disabled={!settingsAreCustomized(settings) || resetting}
          loading={resetting}
          onClick={() => {
            if (!window.confirm('Reset all settings to their defaults? Keyboard shortcuts will not change.')) return
            setResetting(true)
            void resetSettings().finally(() => setResetting(false))
          }}
        >
          Reset
        </Button>
      </Row>
    </div>
  )
}

function AiSection() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const current = resolveChatModel(settings.model)

  return (
    <div>
      <Row
        title="Model"
        description={`Fast for quick answers. Intelligent (GPT-4.1) for coding challenges and harder problems. ${formatAccelerator(shortcuts.toggleModel, desktop.platform)} switches.`}
      >
        <div className="grid w-[200px] grid-cols-2 gap-1 rounded-md bg-surface-2 p-0.5">
          {MODEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={current === option.value}
              className={cn(
                'h-8 rounded-md px-2 text-[12px] transition-colors duration-150',
                current === option.value ? 'bg-raised font-medium text-fg' : 'text-muted hover:bg-lift hover:text-fg',
              )}
              onClick={() => void setSettings({ model: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Row>
      {MODEL_OPTIONS.map((option) => (
        <Row key={option.value} title={`${option.label} · ${option.detail}`} description={option.description}>
          <span className="text-[12px] text-muted">{current === option.value ? 'Selected' : ''}</span>
        </Row>
      ))}
    </div>
  )
}

function AppearanceSection() {
  const theme = useAppStore((state) => state.settings.theme)
  const compactMode = useAppStore((state) => state.settings.compactMode)
  const fontSize = useAppStore((state) => state.settings.fontSize)
  const transparency = useAppStore((state) => state.settings.transparency)
  const transparencyAmount = useAppStore((state) => state.settings.transparencyAmount)
  const setSettings = useAppStore((state) => state.setSettings)
  const [liveFontSize, setLiveFontSize] = useState(fontSize)
  const [liveTransparency, setLiveTransparency] = useState(transparencyAmount)
  const draggingFont = useRef(false)
  const draggingTransparency = useRef(false)

  useEffect(() => {
    if (!draggingFont.current) setLiveFontSize(fontSize)
  }, [fontSize])
  useEffect(() => {
    if (!draggingTransparency.current) setLiveTransparency(transparencyAmount)
  }, [transparencyAmount])

  return (
    <div>
      <Row title="Theme">
        <Select value={theme} onValueChange={(value) => void setSettings({ theme: value as ThemeMode })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row title="Compact mode" description="Reduce padding for smaller screens.">
        <Switch checked={compactMode} onCheckedChange={(value) => void setSettings({ compactMode: value })} />
      </Row>
      <Row title="Font size" description={`${liveFontSize}px`}>
        <div className="w-[140px]">
          <Slider
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={[liveFontSize]}
            onValueChange={([value]) => {
              const next = value ?? liveFontSize
              draggingFont.current = true
              setLiveFontSize(next)
              previewAppearance({ fontSize: next })
            }}
            onValueCommit={([value]) => {
              const next = value ?? liveFontSize
              draggingFont.current = false
              setLiveFontSize(next)
              previewAppearance({ fontSize: next })
              void setSettings({ fontSize: next })
            }}
          />
        </div>
      </Row>
      <Row title="Transparency" description="See the desktop through the window.">
        <Switch
          checked={transparency}
          onCheckedChange={(value) => void setSettings({ transparency: value })}
        />
      </Row>
      <Row title="Amount" description={transparency ? `${liveTransparency}% see-through` : 'Turn on transparency to adjust.'}>
        <div className="w-[140px]">
          <Slider
            min={5}
            max={80}
            step={1}
            disabled={!transparency}
            value={[liveTransparency]}
            onValueChange={([value]) => {
              const next = value ?? liveTransparency
              draggingTransparency.current = true
              setLiveTransparency(next)
              previewAppearance({ transparencyAmount: next })
            }}
            onValueCommit={([value]) => {
              const next = value ?? liveTransparency
              draggingTransparency.current = false
              setLiveTransparency(next)
              previewAppearance({ transparencyAmount: next })
              void setSettings({ transparencyAmount: next })
            }}
          />
        </div>
      </Row>
    </div>
  )
}

function parseCommaList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function ProfileSection() {
  const query = useContext(SettingsSearchContext)
  const searching = Boolean(normalizeSearch(query))
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const fileRef = useRef<HTMLInputElement>(null)
  const prefs = resolveProfilePreferences(profile)
  const [preferredName, setPreferredName] = useState(profile?.preferredName ?? '')
  const [profession, setProfession] = useState(profile?.profession ?? '')
  const [role, setRole] = useState(profile?.role ?? '')
  const [industry, setIndustry] = useState(profile?.industry ?? '')
  const [education, setEducation] = useState(profile?.education ?? '')
  const [skills, setSkills] = useState(profile?.skills?.join(', ') ?? '')
  const [goals, setGoals] = useState(profile?.goals?.join('\n') ?? '')
  const [communicationStyle, setCommunicationStyle] = useState(prefs.communicationStyle)
  const [technicalLevel, setTechnicalLevel] = useState(prefs.technicalLevel)
  const [formal, setFormal] = useState(prefs.formal)
  const [stepByStep, setStepByStep] = useState(prefs.stepByStep)
  const [examples, setExamples] = useState(prefs.examples)
  const [explainTerms, setExplainTerms] = useState(prefs.explainTerms)
  const [customContext, setCustomContext] = useState(profile?.customContext ?? '')
  const [resumeName, setResumeName] = useState<string | null>(null)
  const [resumeBusy, setResumeBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const userId = session?.userId
    if (!userId) return
    void desktop.profile.get(userId).then((local) => {
      setResumeName(local.resume?.fileName ?? null)
    })
  }, [session?.userId])

  const payload = (overrides: Partial<UserProfile> = {}): Partial<UserProfile> => ({
    preferredName: preferredName.trim(),
    profession: profession.trim(),
    role: role.trim(),
    industry: industry.trim(),
    education: education.trim(),
    skills: parseCommaList(skills),
    goals: parseLines(goals),
    communicationStyle,
    technicalLevel,
    formal,
    stepByStep,
    examples,
    explainTerms,
    customContext: customContext.trim(),
    ...overrides,
  })

  const save = (overrides: Partial<UserProfile> = {}) => {
    setError(null)
    void updateProfile(payload(overrides))
      .then(() => setStatus('Saved'))
      .catch((err: Error) => {
        setStatus(null)
        setError(err.message || 'Could not save profile.')
      })
  }

  const uploadResume = async (file: File) => {
    const userId = session?.userId
    if (!userId) {
      setError('Sign in to save a resume on this device.')
      return
    }
    setResumeBusy(true)
    setError(null)
    try {
      const saved = await desktop.profile.saveResume(userId, {
        fileName: file.name,
        mimeType: file.type,
        data: await file.arrayBuffer(),
      })
      setResumeName(saved.fileName || file.name)
      setStatus('Resume saved on this device.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save resume.')
    } finally {
      setResumeBusy(false)
    }
  }

  const removeResume = async () => {
    const userId = session?.userId
    if (!userId) return
    if (!window.confirm('Remove the resume stored on this device?')) return
    setResumeBusy(true)
    setError(null)
    try {
      await desktop.profile.deleteResume(userId)
      setResumeName(null)
      setStatus('Resume removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove resume.')
    } finally {
      setResumeBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {searching ? null : (
        <p className="text-[12px] leading-relaxed text-muted">
          Tudso uses this to personalize answers on this device. You can leave anything blank.
        </p>
      )}

      <section className="[&:not(:has([data-setting]))]:hidden">
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">About you</h3>
        <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
          <ProfileField title="Preferred name" description="What Tudso should call you.">
            <Input
              value={preferredName}
              onChange={(event) => setPreferredName(event.target.value)}
              onBlur={() => save()}
              placeholder="Alex"
              maxLength={120}
              className="bg-surface hover:bg-lift focus-visible:bg-lift"
              aria-label="Preferred name"
            />
          </ProfileField>
          <ProfileField title="Profession" description="Your field or craft.">
            <Input
              value={profession}
              onChange={(event) => setProfession(event.target.value)}
              onBlur={() => save()}
              placeholder="Software engineer"
              maxLength={160}
              className="bg-surface hover:bg-lift focus-visible:bg-lift"
              aria-label="Profession"
            />
          </ProfileField>
          <ProfileField title="Role" description="Your current title or job.">
            <Input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              onBlur={() => save()}
              placeholder="Staff engineer"
              maxLength={160}
              className="bg-surface hover:bg-lift focus-visible:bg-lift"
              aria-label="Role"
            />
          </ProfileField>
          <ProfileField title="Industry" description="The space you work in.">
            <Input
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              onBlur={() => save()}
              placeholder="Healthcare"
              maxLength={160}
              className="bg-surface hover:bg-lift focus-visible:bg-lift"
              aria-label="Industry"
            />
          </ProfileField>
          <ProfileField title="Education" description="Degrees, schools, or certifications.">
            <Input
              value={education}
              onChange={(event) => setEducation(event.target.value)}
              onBlur={() => save()}
              placeholder="B.S. Computer Science"
              className="bg-surface hover:bg-lift focus-visible:bg-lift"
              aria-label="Education"
            />
          </ProfileField>
        </div>
      </section>

      <section className="[&:not(:has([data-setting]))]:hidden">
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Skills and goals</h3>
        <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
          <ProfileField title="Skills" description="Separate with commas.">
            <Input
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              onBlur={() => save()}
              placeholder="React, TypeScript, public speaking"
              className="bg-surface hover:bg-lift focus-visible:bg-lift"
              aria-label="Skills"
            />
          </ProfileField>
          <ProfileField title="Goals" description="One goal per line.">
            <Textarea
              value={goals}
              onChange={(event) => setGoals(event.target.value)}
              onBlur={() => save()}
              placeholder={'Ship the Q3 launch\nPrepare for staff-engineer interviews'}
              className="h-24 bg-surface text-fg hover:bg-lift focus-visible:bg-lift"
              aria-label="Goals"
            />
          </ProfileField>
        </div>
      </section>

      <section className="[&:not(:has([data-setting]))]:hidden">
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">How Tudso should answer</h3>
        <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
          <ProfileControl
            title="Communication style"
            description="How long and how dense answers should be."
          >
            <Select
              value={communicationStyle}
              onValueChange={(value) => {
                const next = value as NonNullable<UserProfile['communicationStyle']>
                setCommunicationStyle(next)
                save({ communicationStyle: next })
              }}
            >
              <SelectTrigger className="w-[148px] bg-surface hover:bg-lift data-[state=open]:bg-lift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </ProfileControl>
          <ProfileControl
            title="Technical level"
            description="How much expertise Tudso should assume."
          >
            <Select
              value={technicalLevel}
              onValueChange={(value) => {
                const next = value as NonNullable<UserProfile['technicalLevel']>
                setTechnicalLevel(next)
                save({ technicalLevel: next })
              }}
            >
              <SelectTrigger className="w-[148px] bg-surface hover:bg-lift data-[state=open]:bg-lift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </ProfileControl>
          <ProfileControl title="Formal language" description="Prefer a more professional tone.">
            <Switch
              checked={formal}
              onCheckedChange={(value) => {
                setFormal(value)
                save({ formal: value })
              }}
              aria-label="Formal language"
            />
          </ProfileControl>
          <ProfileControl title="Step by step" description="Break answers into numbered steps when it helps.">
            <Switch
              checked={stepByStep}
              onCheckedChange={(value) => {
                setStepByStep(value)
                save({ stepByStep: value })
              }}
              aria-label="Step by step"
            />
          </ProfileControl>
          <ProfileControl title="Include examples" description="Add a short example when the idea is abstract.">
            <Switch
              checked={examples}
              onCheckedChange={(value) => {
                setExamples(value)
                save({ examples: value })
              }}
              aria-label="Include examples"
            />
          </ProfileControl>
          <ProfileControl title="Explain terms" description="Define jargon the first time it appears.">
            <Switch
              checked={explainTerms}
              onCheckedChange={(value) => {
                setExplainTerms(value)
                save({ explainTerms: value })
              }}
              aria-label="Explain terms"
            />
          </ProfileControl>
        </div>
      </section>

      <section className="[&:not(:has([data-setting]))]:hidden">
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">More context</h3>
        <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
          <ProfileField
            title="Notes for Tudso"
            description="Anything else it should know: tools, constraints, or how you like to work."
          >
            <Textarea
              value={customContext}
              onChange={(event) => setCustomContext(event.target.value)}
              onBlur={() => save()}
              placeholder="I work in a regulated environment. Prefer answers I can paste into Slack."
              className="h-24 bg-surface text-fg hover:bg-lift focus-visible:bg-lift"
              aria-label="Notes for Tudso"
            />
          </ProfileField>
          <ProfileControl
            title="Resume"
            description={
              resumeName
                ? `${resumeName}. Kept on this device.`
                : 'Optional. Kept on this device, not uploaded to the server.'
            }
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void uploadResume(file)
              }}
            />
            <div className="flex shrink-0 items-center gap-1">
              {resumeName ? (
                <Button variant="danger" size="sm" disabled={resumeBusy} loading={resumeBusy} onClick={() => void removeResume()}>
                  Remove
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={resumeBusy}
                loading={resumeBusy}
                onClick={() => fileRef.current?.click()}
              >
                {resumeName ? 'Replace' : 'Upload'}
              </Button>
            </div>
          </ProfileControl>
        </div>
      </section>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {status && !error ? <p className="text-[12px] text-muted">{status}</p> : null}
    </div>
  )
}

function ProfileField({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const visible = useSettingVisible(title, description)
  if (!visible) return null
  return (
    <div data-setting className="space-y-1.5 px-3 py-2.5">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        {description ? <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function ProfileControl({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const visible = useSettingVisible(title, description)
  if (!visible) return null
  return (
    <div data-setting className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{title}</p>
        {description ? <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function SubscriptionSection() {
  return <Subscription />
}

function MemorySection() {
  const query = useContext(SettingsSearchContext)
  const searching = Boolean(normalizeSearch(query))
  const memories = useAuthStore((state) => state.memories)
  const memoriesLoaded = useAuthStore((state) => state.memoriesLoaded)
  const memoryEnabled = useAuthStore((state) => state.memoryEnabled)
  const loadMemories = useAuthStore((state) => state.loadMemories)
  const saveMemories = useAuthStore((state) => state.saveMemories)
  const setMemoryEnabled = useAuthStore((state) => state.setMemoryEnabled)
  const clearMemories = useAuthStore((state) => state.clearMemories)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const atLimit = memories.length >= MAX_MEMORIES

  useEffect(() => {
    // Refresh so facts learned from recent chats show up.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMemories()
  }, [loadMemories])

  const persist = async (next: MemoryEntry[], message: string) => {
    setBusy(true)
    setError(null)
    try {
      await saveMemories(next)
      setStatus(message)
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Could not save memories.')
    } finally {
      setBusy(false)
    }
  }

  const toggleMemory = async (enabled: boolean) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await setMemoryEnabled(enabled)
      setStatus(enabled
        ? 'Memory is on. Tudso will learn from chats and use saved facts.'
        : 'Memory is off. Tudso will not learn or use saved facts.')
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Could not update memory.')
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const text = draft.replace(/\s+/g, ' ').trim()
    if (!text || busy || atLimit) return
    if (text.length > MAX_MEMORY_CHARS) {
      setError(`Keep each memory under ${MAX_MEMORY_CHARS} characters.`)
      return
    }
    if (memories.some((entry) => entry.text.toLowerCase() === text.toLowerCase())) {
      setError('That is already saved.')
      return
    }
    setDraft('')
    void persist(
      [{ id: createId(), text, created: new Date().toISOString(), source: 'manual' }, ...memories],
      memoryEnabled ? 'Saved. Tudso will use this in answers.' : 'Saved. Turn memory on to use this in answers.',
    )
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const update = (id: string, text: string) => {
    const nextText = text.replace(/\s+/g, ' ').trim()
    const current = memories.find((entry) => entry.id === id)
    if (!current || nextText === current.text) return
    if (!nextText) {
      void persist(memories.filter((entry) => entry.id !== id), 'Memory removed.')
      return
    }
    void persist(
      memories.map((entry) => (entry.id === id ? { ...entry, text: nextText.slice(0, MAX_MEMORY_CHARS), source: 'manual' } : entry)),
      'Saved.',
    )
  }

  const remove = (id: string) => {
    void persist(memories.filter((entry) => entry.id !== id), 'Memory removed.')
  }

  const clear = () => {
    if (!memories.length || busy) return
    if (!window.confirm('Clear every saved memory?')) return
    setBusy(true)
    setError(null)
    void clearMemories()
      .then(() => setStatus('All memories cleared.'))
      .catch((err: Error) => {
        setStatus(null)
        setError(err.message || 'Could not clear memories.')
      })
      .finally(() => setBusy(false))
  }

  const toggleVisible = useSettingVisible('Memory', 'automatic learn chats facts answers')
  const composerVisible = useSettingVisible('Add a memory', 'facts remember keep across sessions')
  const listVisible = useSettingVisible('Saved memories', ...memories.map((entry) => entry.text))
  const clearVisible = useSettingVisible('Clear all memories')

  return (
    <div className="space-y-6">
      {searching ? null : (
        <p className="text-[12px] leading-relaxed text-muted">
          Tudso learns durable facts from your chats — tools, preferences, constraints — and uses them in later answers. Saved on this device. You can add or remove anything here.
        </p>
      )}

      {toggleVisible ? (
        <section data-setting>
          <div className="overflow-hidden rounded-md bg-surface-2">
            <PrivacyToggle
              title="Memory"
              description={memoryEnabled
                ? 'On. Learns from chats and uses saved facts in answers.'
                : 'Off. Will not learn from chats or use saved facts.'}
              checked={memoryEnabled}
              disabled={busy || !memoriesLoaded}
              onCheckedChange={(value) => void toggleMemory(value)}
            />
          </div>
        </section>
      ) : null}

      {composerVisible ? (
        <section data-setting>
          <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Add</h3>
          <div className="overflow-hidden rounded-md bg-surface-2 p-3">
            <label htmlFor="memory-input" className="sr-only">
              New memory
            </label>
            <Textarea
              id="memory-input"
              ref={inputRef}
              value={draft}
              rows={3}
              maxLength={MAX_MEMORY_CHARS}
              disabled={busy || atLimit}
              placeholder="I prefer TypeScript. I work in UTC+5. Never use class components."
              className="min-h-[72px] bg-surface hover:bg-lift focus-visible:bg-lift"
              onChange={(event) => {
                setDraft(event.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  add()
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted">
                {atLimit
                  ? `Limit reached · ${MAX_MEMORIES} memories`
                  : `${draft.trim().length}/${MAX_MEMORY_CHARS} · Enter to save`}
              </p>
              <Button onClick={add} disabled={busy || atLimit || !draft.trim()} loading={busy}>
                Save
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {listVisible ? (
        <section data-setting>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-[12px] font-medium tracking-wide text-muted uppercase">Saved</h3>
            {memoriesLoaded ? (
              <p className="text-[11px] text-muted">
                {memories.length === 0 ? 'None yet' : `${memories.length} of ${MAX_MEMORIES}`}
              </p>
            ) : null}
          </div>

          {!memoriesLoaded ? (
            <div className="space-y-2 rounded-md bg-surface-2 p-3" aria-busy="true" aria-label="Loading memories">
              <div className="skeleton-bar h-3 w-5/6" />
              <div className="skeleton-bar h-3 w-2/3" style={{ animationDelay: '80ms' }} />
              <div className="skeleton-bar h-3 w-4/5" style={{ animationDelay: '160ms' }} />
            </div>
          ) : memories.length === 0 ? (
            <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] leading-relaxed text-muted">
              {memoryEnabled
                ? 'Nothing saved yet. Tudso will learn facts from chats, or you can add one here.'
                : 'Nothing saved yet. Turn memory on to learn from chats, or add a fact here.'}
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
              {memories.map((entry) => (
                <MemoryRow
                  key={entry.id}
                  entry={entry}
                  disabled={busy}
                  onSave={(text) => update(entry.id, text)}
                  onRemove={() => remove(entry.id)}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {memories.length > 0 && clearVisible ? (
        <section data-setting>
          <div className="flex items-center justify-between gap-4 rounded-md bg-surface-2 px-3 py-2.5">
            <div>
              <p className="text-[13px] font-medium">Clear all</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">Remove every saved memory from this device.</p>
            </div>
            <Button variant="danger" size="sm" disabled={busy} loading={busy} onClick={clear}>
              Clear
            </Button>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && status ? <p className="text-[12px] text-muted">{status}</p> : null}
    </div>
  )
}

function MemoryRow({
  entry,
  disabled,
  onSave,
  onRemove,
}: {
  entry: MemoryEntry
  disabled: boolean
  onSave: (text: string) => void
  onRemove: () => void
}) {
  const [text, setText] = useState(entry.text)
  const visible = useSettingVisible(entry.text)

  useEffect(() => {
    setText(entry.text)
  }, [entry.text])

  if (!visible) return null

  const date = formatMemoryDate(entry.created)
  const meta = [entry.source === 'auto' ? 'Learned' : null, date].filter(Boolean).join(' · ')

  return (
    <li data-setting className="flex items-start gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <Textarea
          value={text}
          rows={2}
          maxLength={MAX_MEMORY_CHARS}
          disabled={disabled}
          aria-label="Memory"
          className="min-h-[44px] bg-surface hover:bg-lift focus-visible:bg-lift"
          onChange={(event) => setText(event.target.value)}
          onBlur={() => onSave(text)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              ;(event.target as HTMLTextAreaElement).blur()
            }
          }}
        />
        {meta ? <p className="mt-1 text-[11px] text-muted">{meta}</p> : null}
      </div>
      <IconButton label="Remove memory" disabled={disabled} className="mt-0.5 hover:bg-danger/20 hover:text-danger" onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </li>
  )
}

function AccountSection() {
  return <Account />
}

function PrivacySection() {
  const settings = useAppStore((state) => state.settings)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const setSettings = useAppStore((state) => state.setSettings)
  const clearConversations = useAppStore((state) => state.clearConversations)
  const deleteLocalData = useAppStore((state) => state.deleteLocalData)
  const entitlement = useAuthStore((state) => state.entitlement)
  const hideAllowed = canHideFromCapture(entitlement?.plan, entitlement?.status)
  const [status, setStatus] = useState<string | null>(null)
  const hint = (value: string) => formatAccelerator(value, desktop.platform)

  return (
    <div className="space-y-6">
      <section className="[&:not(:has([data-setting]))]:hidden">
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">On screen</h3>
        <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
          {hideAllowed ? (
            <PrivacyToggle
              title="Hide from screen share"
              description="Stay invisible in screenshots, recordings, and shared screens."
              hint={hint(shortcuts.toggleHideFromCapture)}
              checked={settings.hideFromCapture}
              onCheckedChange={(value) => void setSettings({ hideFromCapture: value })}
            />
          ) : null}
          <PrivacyToggle
            title="Privacy mode"
            description="Hide message text if someone can see your display."
            hint={hint(shortcuts.togglePrivacy)}
            checked={settings.privacyMode}
            onCheckedChange={(value) => void setSettings({ privacyMode: value })}
          />
        </div>
      </section>

      <section className="[&:not(:has([data-setting]))]:hidden">
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">This device</h3>
        <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
          <PrivacyAction
            title="Clear sessions"
            description="Remove every session stored on this device."
            action="Clear"
            onAction={() => {
              if (!window.confirm('Clear all sessions on this device?')) return
              void clearConversations().then(() => setStatus('Sessions cleared.'))
            }}
          />
          <PrivacyAction
            title="Delete local data"
            description="Erase local settings, shortcuts, and sessions on this device."
            action="Delete"
            danger
            onAction={() => {
              if (!window.confirm('Delete all local Tudso data on this device? This cannot be undone.')) return
              void deleteLocalData()
            }}
          />
        </div>
      </section>

      {status ? <p className="text-[12px] text-muted">{status}</p> : null}
    </div>
  )
}

function PrivacyToggle({
  title,
  description,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string
  description: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (value: boolean) => void
}) {
  const visible = useSettingVisible(title, description)
  if (!visible) return null
  return (
    <div data-setting className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {hint ? <Kbd>{hint}</Kbd> : null}
        <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={title} />
      </div>
    </div>
  )
}

function PrivacyAction({
  title,
  description,
  action,
  danger,
  onAction,
}: {
  title: string
  description: string
  action: string
  danger?: boolean
  onAction: () => void | Promise<void>
}) {
  const visible = useSettingVisible(title, description, action)
  const [loading, setLoading] = useState(false)
  if (!visible) return null
  return (
    <div data-setting className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
      </div>
      <Button
        variant={danger ? 'danger' : 'outline'}
        size="sm"
        className="shrink-0"
        loading={loading}
        onClick={() => {
          setLoading(true)
          void Promise.resolve(onAction()).finally(() => setLoading(false))
        }}
      >
        {action}
      </Button>
    </div>
  )
}
