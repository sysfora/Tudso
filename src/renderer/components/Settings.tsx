import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import { FONT_SIZE_MAX, FONT_SIZE_MIN, DEFAULT_SETTINGS } from '@shared/defaults'
import type { Settings, SettingsSection, ThemeMode } from '@shared/types'
import { ShortcutManager } from '@/components/ShortcutManager'
import { Subscription } from '@/components/Subscription'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconButton } from '@/components/ui/icon-button'
import { Input, Kbd, Textarea } from '@/components/ui/input'
import type { UserProfile } from '@/types/api'
import { resolveProfilePreferences } from '@/types/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'

const NAV: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
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
        <SearchablePanel
          title="Memory"
          terms={['memories', 'remember', 'facts', 'context', 'Add facts the assistant should remember']}
        >
          <MemorySection />
        </SearchablePanel>
      ) : null}
      {searching || section === 'subscription' ? (
        <SearchablePanel title="Subscription" terms={['plan', 'billing', 'upgrade', 'pro', 'premium', 'free', 'manage']}>
          <SubscriptionSection />
        </SearchablePanel>
      ) : null}
      {searching || section === 'account' ? (
        <SearchablePanel
          title="Account"
          terms={['signed in', 'email', 'devices', 'export', 'delete account', 'log out', 'logout', 'data']}
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
      <Row title="Hide from screen share" description="Stay invisible in screenshots, recordings, and shared screens.">
        <Switch checked={settings.hideFromCapture} onCheckedChange={(value) => void setSettings({ hideFromCapture: value })} />
      </Row>
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
          disabled={!settingsAreCustomized(settings)}
          onClick={() => {
            if (!window.confirm('Reset all settings to their defaults? Keyboard shortcuts will not change.')) return
            void resetSettings()
          }}
        >
          Reset
        </Button>
      </Row>
    </div>
  )
}

function AppearanceSection() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)

  return (
    <div>
      <Row title="Theme">
        <Select value={settings.theme} onValueChange={(value) => void setSettings({ theme: value as ThemeMode })}>
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
        <Switch checked={settings.compactMode} onCheckedChange={(value) => void setSettings({ compactMode: value })} />
      </Row>
      <Row title="Font size" description={`${settings.fontSize}px`}>
        <div className="w-[140px]">
          <Slider
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={[settings.fontSize]}
            onValueChange={([value]) => void setSettings({ fontSize: value ?? 14 })}
          />
        </div>
      </Row>
      <Row title="Transparency" description="See the desktop through the window.">
        <Switch
          checked={settings.transparency}
          onCheckedChange={(value) => void setSettings({ transparency: value })}
        />
      </Row>
      <Row title="Amount" description={settings.transparency ? `${settings.transparencyAmount}% see-through` : 'Turn on transparency to adjust.'}>
        <div className="w-[140px]">
          <Slider
            min={5}
            max={80}
            step={1}
            disabled={!settings.transparency}
            value={[settings.transparencyAmount]}
            onValueChange={([value]) => void setSettings({ transparencyAmount: value ?? 40 })}
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

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const next: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(value)
  }
  return next
}

function ProfileSection() {
  const query = useContext(SettingsSearchContext)
  const searching = Boolean(normalizeSearch(query))
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
    // Data fetch on mount; resume filename is needed for the row.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void api.resume
      .get()
      .then((resume) => setResumeName(resume.fileName || 'Resume'))
      .catch(() => setResumeName(null))
  }, [])

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
    setResumeBusy(true)
    setError(null)
    try {
      const result = await api.resume.upload(file)
      const mergedSkills = uniqueStrings([...parseCommaList(skills), ...result.skills])
      setResumeName(result.fileName || file.name)
      setSkills(mergedSkills.join(', '))
      await updateProfile(payload({ skills: mergedSkills }))
      setStatus(result.skills.length ? 'Resume saved. Skills were updated from the file.' : 'Resume saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload resume.')
    } finally {
      setResumeBusy(false)
    }
  }

  const removeResume = async () => {
    if (!window.confirm('Remove the uploaded resume?')) return
    setResumeBusy(true)
    setError(null)
    try {
      await api.resume.delete()
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
          Tudso uses this to personalize answers. You can leave anything blank.
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
                ? `${resumeName}. Used for career, skills, and background questions.`
                : 'Optional. Helps with career, skills, and background questions.'
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
                <Button variant="danger" size="sm" disabled={resumeBusy} onClick={() => void removeResume()}>
                  Remove
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={resumeBusy}
                onClick={() => fileRef.current?.click()}
              >
                {resumeBusy ? 'Uploading…' : resumeName ? 'Replace' : 'Upload'}
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
  const [entries, setEntries] = useState<Array<{ id: string; text: string; created: string }>>([])
  const [newText, setNewText] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    const context = await api.context.get()
    setEntries(context?.entries ?? [])
    setLoaded(true)
  }

  useEffect(() => {
    // Data fetch on mount; loading state is needed for UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const save = async (next: Array<{ id: string; text: string; created: string }>) => {
    setEntries(next)
    await api.context.update(next)
  }

  const add = () => {
    if (!newText.trim()) return
    const entry = { id: crypto.randomUUID(), text: newText.trim(), created: new Date().toISOString() }
    void save([entry, ...entries])
    setNewText('')
  }

  const remove = (id: string) => {
    void save(entries.filter((e) => e.id !== id))
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-muted">
        Add facts the assistant should remember. These are included in the AI context when relevant.
      </p>
      <div className="flex gap-2">
        <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Remember that I prefer…" />
        <Button onClick={add}>Add</Button>
      </div>
      {loaded && entries.length === 0 ? <p className="text-[12px] text-muted">No memories yet.</p> : null}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-2 rounded-md bg-surface-2 p-2">
            <p className="text-[13px] leading-relaxed">{entry.text}</p>
            <Button variant="ghost" size="sm" onClick={() => remove(entry.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      {entries.length > 0 ? (
        <Button variant="outline" className="w-full text-danger hover:bg-danger/20 hover:text-danger" onClick={() => {
          if (window.confirm('Clear all memories?')) void api.context.delete().then(load)
        }}>
          Clear all
        </Button>
      ) : null}
    </div>
  )
}

function AccountSection() {
  const session = useAuthStore((state) => state.session)
  const logout = useAuthStore((state) => state.logout)
  const [devices, setDevices] = useState<Array<{ id: string; deviceId: string; platform: string; appVersion: string; lastSeen: string }>>([])
  const [status, setStatus] = useState<string | null>(null)

  const loadDevices = async () => {
    const list = await api.devices.list()
    setDevices(list)
  }

  useEffect(() => {
    // Data fetch on mount; loading state is needed for UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDevices()
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-surface-2 p-3">
        <p className="text-[12px] text-muted">Signed in as</p>
        <p className="text-[14px] font-medium">{session?.email}</p>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium">Devices</p>
        <div className="space-y-1">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between rounded-md bg-surface-2 p-2 text-[12px]">
              <div>
                <p className="font-medium">{device.platform}</p>
                <p className="text-muted">{device.appVersion} · {new Date(device.lastSeen).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void api.devices.delete(device.deviceId).then(loadDevices)}>
                Revoke
              </Button>
            </div>
          ))}
          {devices.length === 0 ? <p className="text-[12px] text-muted">No other devices found.</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-medium">Data</p>
        <Button variant="outline" className="w-full" onClick={async () => {
          const data = await api.me.export()
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `tudso-export-${new Date().toISOString().slice(0, 10)}.json`
          a.click()
          URL.revokeObjectURL(url)
          setStatus('Export downloaded.')
        }}>
          Export my data
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-medium">Danger zone</p>
        <Button variant="outline" className="w-full text-danger hover:bg-danger/20 hover:text-danger" onClick={() => {
          if (window.confirm('Delete your Tudso account and all data? This cannot be undone.')) {
            void api.me.deleteAccount().then(() => logout())
          }
        }}>
          Delete account
        </Button>
      </div>

      <Button variant="outline" className="w-full" onClick={() => void logout()}>
        Log out
      </Button>
      {status ? <p className="text-[12px] text-muted">{status}</p> : null}
    </div>
  )
}

function PrivacySection() {
  const settings = useAppStore((state) => state.settings)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const setSettings = useAppStore((state) => state.setSettings)
  const clearConversations = useAppStore((state) => state.clearConversations)
  const deleteLocalData = useAppStore((state) => state.deleteLocalData)
  const [status, setStatus] = useState<string | null>(null)
  const hint = (value: string) => formatAccelerator(value, desktop.platform)

  return (
    <div className="space-y-6">
      <section className="[&:not(:has([data-setting]))]:hidden">
        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">On screen</h3>
        <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
          <PrivacyToggle
            title="Hide from screen share"
            description="Stay invisible in screenshots, recordings, and shared screens."
            hint={hint(shortcuts.toggleHideFromCapture)}
            checked={settings.hideFromCapture}
            onCheckedChange={(value) => void setSettings({ hideFromCapture: value })}
          />
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
          {settings.lockEnabled ? (
            <PrivacyAction
              title="PIN lock"
              description="Tudso currently asks for a PIN when it opens."
              action="Turn off"
              onAction={() => {
                void setSettings({ lockEnabled: false }).then(() => setStatus('PIN lock turned off.'))
              }}
            />
          ) : null}
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
  onCheckedChange,
}: {
  title: string
  description: string
  hint?: string
  checked: boolean
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
        <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
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
  onAction: () => void
}) {
  const visible = useSettingVisible(title, description, action)
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
        onClick={onAction}
      >
        {action}
      </Button>
    </div>
  )
}
