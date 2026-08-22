import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { desktop } from '@/lib/desktop'
import { DEFAULT_PROFILE_PREFERENCES } from '@/types/api'
import {
  PROFILE_SETUP_STEPS,
  ProfileSetupFields,
  splitList,
  type ProfileSetupValues,
} from '@/components/ProfileSetup'

export function OnboardingFlow() {
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<ProfileSetupValues>({
    preferredName: profile?.preferredName ?? '',
    profession: profile?.profession ?? '',
    role: profile?.role ?? '',
    skills: profile?.skills?.join(', ') ?? '',
    goals: profile?.goals?.join('\n') ?? '',
    communicationStyle: profile?.communicationStyle ?? DEFAULT_PROFILE_PREFERENCES.communicationStyle,
    technicalLevel: profile?.technicalLevel ?? DEFAULT_PROFILE_PREFERENCES.technicalLevel,
  })
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeName, setResumeName] = useState('')
  const [saving, setSaving] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!profile || hydrated.current) return
    hydrated.current = true
    setValues({
      preferredName: profile.preferredName ?? '',
      profession: profile.profession ?? '',
      role: profile.role ?? '',
      skills: profile.skills?.join(', ') ?? '',
      goals: profile.goals?.join('\n') ?? '',
      communicationStyle: profile.communicationStyle ?? DEFAULT_PROFILE_PREFERENCES.communicationStyle,
      technicalLevel: profile.technicalLevel ?? DEFAULT_PROFILE_PREFERENCES.technicalLevel,
    })
  }, [profile])

  useEffect(() => {
    const userId = session?.userId
    if (!userId) return
    void desktop.profile.get(userId).then((local) => {
      if (local.resume?.fileName) setResumeName(local.resume.fileName)
    })
  }, [session?.userId])

  const last = step === PROFILE_SETUP_STEPS.length - 1
  const busy = saving || resumeUploading

  const next = async () => {
    if (busy) return
    setSaving(true)
    try {
      if (step === 0) {
        await updateProfile({
          preferredName: values.preferredName.trim() || undefined,
          profession: values.profession.trim() || undefined,
          role: values.role.trim() || undefined,
        })
      } else if (step === 2) {
        await updateProfile({
          skills: splitList(values.skills, ','),
          goals: splitList(values.goals, '\n'),
        })
      }
      if (!last) {
        setStep(step + 1)
        return
      }
      await updateProfile({
        skills: splitList(values.skills, ','),
        goals: splitList(values.goals, '\n'),
        ...DEFAULT_PROFILE_PREFERENCES,
        communicationStyle: values.communicationStyle,
        technicalLevel: values.technicalLevel,
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
      setResumeName(`${saved.fileName || file.name} saved on this device.`)
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
        <p className="text-[12px] font-medium text-muted">Step {step + 1} of {PROFILE_SETUP_STEPS.length}</p>
        <h1 className="mt-1 text-[18px] font-semibold tracking-tight">{PROFILE_SETUP_STEPS[step].title}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{PROFILE_SETUP_STEPS[step].description} Saved on this device.</p>

        <ProfileSetupFields
          step={step}
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          onEnter={onEnter}
          fileRef={fileRef}
          onPickFile={(file) => void uploadResume(file)}
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
