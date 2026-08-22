import { useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  PROFILE_SETUP_STEPS,
  ProfileSetupFields,
  splitList,
  type ProfileSetupValues,
} from '@/components/ProfileSetup'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { DEFAULT_PROFILE_PREFERENCES, snapshotLocalProfile } from '@/types/api'

export function SessionSetup() {
  const profile = useAuthStore((state) => state.profile)
  const startSession = useAppStore((state) => state.startSession)
  const cancelSessionSetup = useAppStore((state) => state.cancelSessionSetup)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<ProfileSetupValues>({
    preferredName: '',
    profession: '',
    role: '',
    skills: '',
    goals: '',
    communicationStyle: DEFAULT_PROFILE_PREFERENCES.communicationStyle,
    technicalLevel: DEFAULT_PROFILE_PREFERENCES.technicalLevel,
  })
  const [resumeFile, setResumeFile] = useState<{ fileName: string; mimeType: string; data: ArrayBuffer } | null>(null)
  const [resumeName, setResumeName] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [resumeUploading, setResumeUploading] = useState(false)
  const [saving, setSaving] = useState<'defaults' | 'custom' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const last = step === PROFILE_SETUP_STEPS.length - 1
  const busy = saving !== null || resumeUploading
  const defaultLabel = profile?.preferredName
    ? `Use default info (${profile.preferredName})`
    : 'Use default info'

  const finish = async (usedDefaults: boolean, resume?: { fileName: string; mimeType: string; data: ArrayBuffer } | null) => {
    if (busy) return
    setSaving(usedDefaults ? 'defaults' : 'custom')
    try {
      const nextProfile = usedDefaults
        ? snapshotLocalProfile(profile)
        : snapshotLocalProfile({
            ...DEFAULT_PROFILE_PREFERENCES,
            preferredName: values.preferredName.trim() || undefined,
            profession: values.profession.trim() || undefined,
            role: values.role.trim() || undefined,
            skills: splitList(values.skills, ','),
            goals: splitList(values.goals, '\n'),
            communicationStyle: values.communicationStyle,
            technicalLevel: values.technicalLevel,
          })
      await startSession({
        profile: nextProfile,
        usedDefaults,
        resumeFile: usedDefaults ? undefined : resume ?? undefined,
      })
    } finally {
      setSaving(null)
    }
  }

  const next = async () => {
    if (busy) return
    if (!last) {
      setStep(step + 1)
      return
    }
    await finish(false, resumeFile)
  }

  const pickResume = async (file: File) => {
    setResumeUploading(true)
    setResumeError('')
    try {
      setResumeFile({
        fileName: file.name,
        mimeType: file.type,
        data: await file.arrayBuffer(),
      })
      setResumeName(`${file.name} for this session only.`)
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not read resume')
      setResumeFile(null)
      setResumeName('')
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
        <p className="text-[12px] font-medium text-muted">This session only</p>
        <h1 className="mt-1 text-[18px] font-semibold tracking-tight">Set up this session</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Same details as onboarding. Used for this session and not saved to your profile.
        </p>

        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => void finish(true)}
          disabled={busy}
          loading={saving === 'defaults'}
        >
          {defaultLabel}
        </Button>

        <p className="mt-4 text-[12px] font-medium text-muted">
          Step {step + 1} of {PROFILE_SETUP_STEPS.length}
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-tight">{PROFILE_SETUP_STEPS[step].title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{PROFILE_SETUP_STEPS[step].description}</p>

        <ProfileSetupFields
          step={step}
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          onEnter={onEnter}
          fileRef={fileRef}
          onPickFile={(file) => void pickResume(file)}
          onPickClick={() => fileRef.current?.click()}
          resumeName={resumeName}
          resumeError={resumeError}
          resumeUploading={resumeUploading}
        />

        <div className="mt-4 flex gap-2">
          {step > 0 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)} disabled={busy}>
              Back
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={cancelSessionSetup} disabled={busy}>
              Cancel
            </Button>
          )}
          {step === 1 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step + 1)} disabled={resumeUploading}>
              {resumeName ? 'Continue' : 'Skip'}
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => void next()} loading={saving === 'custom'}>
              {last ? 'Start session' : 'Next'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
