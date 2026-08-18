import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth-store'
import { desktop } from '@/lib/desktop'
import { cn } from '@/lib/cn'
import { DEFAULT_PROFILE_PREFERENCES } from '@/types/api'

const STEPS = [
  {
    title: 'About you',
    description: 'A name and what you do help Tudso sound like it knows you.',
  },
  {
    title: 'Add your resume',
    description: 'Optional. Saved on this device. You can skip.',
  },
  {
    title: 'Skills and goals',
    description: 'A few skills and what you are working toward.',
  },
  {
    title: 'How should answers sound?',
    description: 'Pick a style and how technical to be.',
  },
] as const

export function OnboardingFlow() {
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding)
  const [step, setStep] = useState(0)
  const [preferredName, setPreferredName] = useState(profile?.preferredName ?? '')
  const [profession, setProfession] = useState(profile?.profession ?? '')
  const [role, setRole] = useState(profile?.role ?? '')
  const [skills, setSkills] = useState(profile?.skills?.join(', ') ?? '')
  const [goals, setGoals] = useState(profile?.goals?.join('\n') ?? '')
  const [communicationStyle, setCommunicationStyle] = useState<'concise' | 'balanced' | 'detailed'>(
    profile?.communicationStyle ?? DEFAULT_PROFILE_PREFERENCES.communicationStyle,
  )
  const [technicalLevel, setTechnicalLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(
    profile?.technicalLevel ?? DEFAULT_PROFILE_PREFERENCES.technicalLevel,
  )
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeName, setResumeName] = useState('')
  const [saving, setSaving] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!profile || hydrated.current) return
    hydrated.current = true
    setPreferredName(profile.preferredName ?? '')
    setProfession(profile.profession ?? '')
    setRole(profile.role ?? '')
    setSkills(profile.skills?.join(', ') ?? '')
    setGoals(profile.goals?.join('\n') ?? '')
    if (profile.communicationStyle) setCommunicationStyle(profile.communicationStyle)
    if (profile.technicalLevel) setTechnicalLevel(profile.technicalLevel)
  }, [profile])

  useEffect(() => {
    const userId = session?.userId
    if (!userId) return
    void desktop.profile.get(userId).then((local) => {
      if (local.resume?.fileName) setResumeName(local.resume.fileName)
    })
  }, [session?.userId])

  const last = step === STEPS.length - 1
  const busy = saving || resumeUploading

  const splitList = (value: string, separator: string) =>
    value.split(separator).map((item) => item.trim()).filter(Boolean)

  const next = async () => {
    if (busy) return
    setSaving(true)
    try {
      if (step === 0) {
        await updateProfile({
          preferredName: preferredName.trim() || undefined,
          profession: profession.trim() || undefined,
          role: role.trim() || undefined,
        })
      } else if (step === 2) {
        await updateProfile({
          skills: splitList(skills, ','),
          goals: splitList(goals, '\n'),
        })
      }
      if (!last) {
        setStep(step + 1)
        return
      }
      await updateProfile({
        skills: splitList(skills, ','),
        goals: splitList(goals, '\n'),
        ...DEFAULT_PROFILE_PREFERENCES,
        communicationStyle,
        technicalLevel,
      })
      await completeOnboarding()
    } finally {
      setSaving(false)
    }
  }

  const uploadResume = async (file: File) => {
    const userId = session?.userId
    if (!userId) {
      setResumeError('Sign in to save a resume on this device.')
      return
    }
    setResumeUploading(true)
    setResumeError('')
    try {
      const saved = await desktop.profile.saveResume(userId, {
        fileName: file.name,
        mimeType: file.type,
        data: await file.arrayBuffer(),
      })
      setResumeName(saved.fileName || file.name)
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not save resume')
    } finally {
      setResumeUploading(false)
    }
  }

  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || step === 1) return
    event.preventDefault()
    void next()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-5">
      <div className="w-full max-w-[340px]">
        <p className="text-[12px] font-medium text-muted">Step {step + 1} of {STEPS.length}</p>
        <h1 className="mt-1 text-[18px] font-semibold tracking-tight">{STEPS[step].title}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{STEPS[step].description}</p>

        <div className="mt-4 space-y-3">
          {step === 0 && (
            <>
              <Field label="Preferred name">
                <Input
                  value={preferredName}
                  onChange={(event) => setPreferredName(event.target.value)}
                  onKeyDown={onEnter}
                  placeholder="Alex"
                  autoFocus
                />
              </Field>
              <Field label="Profession">
                <Input
                  value={profession}
                  onChange={(event) => setProfession(event.target.value)}
                  onKeyDown={onEnter}
                  placeholder="Product designer"
                />
              </Field>
              <Field label="Role">
                <Input
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  onKeyDown={onEnter}
                  placeholder="Lead, intern, founder…"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadResume(file)
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={resumeUploading}
                loading={resumeUploading}
              >
                Upload resume (PDF, DOCX, TXT)
              </Button>
              {resumeName ? <p className="text-[12px] text-muted">{resumeName} saved on this device.</p> : null}
              {resumeError ? <p className="text-[12px] text-danger">{resumeError}</p> : null}
            </div>
          )}

          {step === 2 && (
            <>
              <Field label="Skills">
                <Input
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  onKeyDown={onEnter}
                  placeholder="React, TypeScript, design"
                  autoFocus
                />
              </Field>
              <Field label="Goals">
                <Textarea
                  value={goals}
                  onChange={(event) => setGoals(event.target.value)}
                  placeholder="One per line"
                  className="h-20"
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Style">
                <Choice
                  value={communicationStyle}
                  options={['concise', 'balanced', 'detailed']}
                  onChange={setCommunicationStyle}
                />
              </Field>
              <Field label="Technical level">
                <Choice
                  value={technicalLevel}
                  options={['beginner', 'intermediate', 'advanced']}
                  onChange={setTechnicalLevel}
                />
              </Field>
            </>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {step > 0 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)} disabled={busy}>
              Back
            </Button>
          ) : null}
          {step === 1 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step + 1)} disabled={resumeUploading}>
              {resumeName ? 'Continue' : 'Skip'}
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => void next()} loading={saving}>
              {last ? 'Finish' : 'Next'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-left">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[13px] capitalize',
            value === option ? 'bg-accent-fill text-accent-fill-fg' : 'bg-surface-2 text-fg hover:bg-lift',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
