import type { KeyboardEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/cn'

export const PROFILE_SETUP_STEPS = [
  {
    title: 'About you',
    description: 'A name and what you do help Tudso sound like it knows you.',
  },
  {
    title: 'Add your resume',
    description: 'We extract skills, work history, projects, and goals into your profile and memory.',
  },
  {
    title: 'Skills and goals',
    description: 'A few skills and what you are working toward. Filled from your resume when we can.',
  },
  {
    title: 'How should answers sound?',
    description: 'Pick a style and how technical to be.',
  },
] as const

export interface ProfileSetupValues {
  preferredName: string
  profession: string
  role: string
  skills: string
  goals: string
  communicationStyle: 'concise' | 'balanced' | 'detailed'
  technicalLevel: 'beginner' | 'intermediate' | 'advanced'
}

export function splitList(value: string, separator: string) {
  return value.split(separator).map((item) => item.trim()).filter(Boolean)
}

function mergeComma(current: string, incoming?: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...splitList(current, ','), ...(incoming ?? [])]) {
    const key = item.toLowerCase()
    if (!item || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out.join(', ')
}

function mergeLines(current: string, incoming?: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...splitList(current, '\n'), ...(incoming ?? [])]) {
    const key = item.toLowerCase()
    if (!item || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out.join('\n')
}

export function mergeSetupValuesFromProfile(
  current: ProfileSetupValues,
  profile: Partial<{
    preferredName?: string
    profession?: string
    role?: string
    skills?: string[]
    goals?: string[]
    technicalLevel?: ProfileSetupValues['technicalLevel']
  }>,
): ProfileSetupValues {
  return {
    preferredName: current.preferredName.trim() || profile.preferredName || '',
    profession: current.profession.trim() || profile.profession || '',
    role: current.role.trim() || profile.role || '',
    skills: mergeComma(current.skills, profile.skills),
    goals: mergeLines(current.goals, profile.goals),
    communicationStyle: current.communicationStyle,
    technicalLevel: profile.technicalLevel ?? current.technicalLevel,
  }
}

export function ProfileSetupField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-left">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export function ProfileSetupChoice<T extends string>({
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

export function ProfileSetupFields({
  step,
  values,
  onChange,
  onEnter,
  onPickClick,
  resumeName,
  resumeError,
  resumeUploading,
}: {
  step: number
  values: ProfileSetupValues
  onChange: (patch: Partial<ProfileSetupValues>) => void
  onEnter: (event: KeyboardEvent<HTMLInputElement>) => void
  onPickClick: () => void
  resumeName: string
  resumeError: string
  resumeUploading: boolean
}) {
  return (
    <div className="mt-4 space-y-3">
      {step === 0 && (
        <>
          <ProfileSetupField label="Preferred name">
            <Input
              value={values.preferredName}
              onChange={(event) => onChange({ preferredName: event.target.value })}
              onKeyDown={onEnter}
              placeholder="Alex"
              autoFocus
            />
          </ProfileSetupField>
          <ProfileSetupField label="Profession">
            <Input
              value={values.profession}
              onChange={(event) => onChange({ profession: event.target.value })}
              onKeyDown={onEnter}
              placeholder="Product designer"
            />
          </ProfileSetupField>
          <ProfileSetupField label="Role">
            <Input
              value={values.role}
              onChange={(event) => onChange({ role: event.target.value })}
              onKeyDown={onEnter}
              placeholder="Lead, intern, founder…"
            />
          </ProfileSetupField>
        </>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={onPickClick}
            disabled={resumeUploading}
            loading={resumeUploading}
          >
            Upload resume (PDF, DOCX, TXT)
          </Button>
          {resumeName ? <p className="text-[12px] text-muted">{resumeName}</p> : null}
          {resumeError ? <p className="text-[12px] text-danger">{resumeError}</p> : null}
        </div>
      )}

      {step === 2 && (
        <>
          <ProfileSetupField label="Skills">
            <Input
              value={values.skills}
              onChange={(event) => onChange({ skills: event.target.value })}
              onKeyDown={onEnter}
              placeholder="React, TypeScript, design"
              autoFocus
            />
          </ProfileSetupField>
          <ProfileSetupField label="Goals">
            <Textarea
              value={values.goals}
              onChange={(event) => onChange({ goals: event.target.value })}
              placeholder="One per line"
              className="h-20"
            />
          </ProfileSetupField>
        </>
      )}

      {step === 3 && (
        <>
          <ProfileSetupField label="Style">
            <ProfileSetupChoice
              value={values.communicationStyle}
              options={['concise', 'balanced', 'detailed']}
              onChange={(communicationStyle) => onChange({ communicationStyle })}
            />
          </ProfileSetupField>
          <ProfileSetupField label="Technical level">
            <ProfileSetupChoice
              value={values.technicalLevel}
              options={['beginner', 'intermediate', 'advanced']}
              onChange={(technicalLevel) => onChange({ technicalLevel })}
            />
          </ProfileSetupField>
        </>
      )}
    </div>
  )
}
