import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth-store'
import { api } from '@/lib/api'
import { DEFAULT_PROFILE_PREFERENCES } from '@/types/api'

export function OnboardingFlow() {
  const profile = useAuthStore((state) => state.profile)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding)
  const [step, setStep] = useState(0)
  const [preferredName, setPreferredName] = useState(profile?.preferredName ?? '')
  const [profession, setProfession] = useState(profile?.profession ?? '')
  const [skills, setSkills] = useState(profile?.skills?.join(', ') ?? '')
  const [goals, setGoals] = useState(profile?.goals?.join('\n') ?? '')
  const [communicationStyle, setCommunicationStyle] = useState<'concise' | 'balanced' | 'detailed'>(profile?.communicationStyle ?? 'balanced')
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const steps = ['name', 'profession', 'resume', 'skills', 'goals', 'preferences']

  const next = async () => {
    if (step === 0) {
      await updateProfile({ preferredName: preferredName || undefined })
    } else if (step === 1) {
      await updateProfile({ profession: profession || undefined })
    }
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      await updateProfile({
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        goals: goals.split('\n').map((s) => s.trim()).filter(Boolean),
        ...DEFAULT_PROFILE_PREFERENCES,
        communicationStyle,
      })
      await completeOnboarding()
    }
  }

  const uploadResume = async (file: File) => {
    setResumeUploading(true)
    setResumeError('')
    try {
      const result = await api.resume.upload(file)
      await updateProfile({ skills: result.skills })
      setSkills(result.skills.join(', '))
      setStep(step + 1)
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not upload resume')
    } finally {
      setResumeUploading(false)
    }
  }

  const titles = [
    'What should we call you?',
    'What do you do?',
    'Add your resume',
    'What are your skills?',
    'What are your goals?',
    'How should the assistant answer?',
  ]
  const descriptions = [
    'This helps the assistant personalize its responses.',
    'Add your role or industry.',
    'Uploading a resume helps the assistant understand your background. You can skip this step.',
    'Comma-separated skills, e.g. React, TypeScript, Design.',
    'Short-term or long-term goals, one per line.',
    'Choose your preferred communication style.',
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="w-full max-w-[320px]">
        <p className="mb-1 text-[12px] font-medium text-muted">Step {step + 1} of {steps.length}</p>
        <h1 className="text-[18px] font-semibold tracking-tight">{titles[step]}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{descriptions[step]}</p>
        <div className="mt-4 space-y-3">
          {step === 0 && <Input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="Preferred name" />}
          {step === 1 && <Input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Profession or role" />}
          {step === 2 && (
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadResume(file)
              }} />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={resumeUploading}>
                {resumeUploading ? 'Uploading…' : 'Upload resume (PDF, DOCX, TXT)'}
              </Button>
              {resumeError ? <p className="text-[12px] text-danger">{resumeError}</p> : null}
              <Button variant="ghost" className="w-full" onClick={() => setStep(step + 1)}>
                Skip
              </Button>
            </div>
          )}
          {step === 3 && <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Skills" />}
          {step === 4 && <textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Goals" className="h-24 w-full rounded-md bg-surface-2 px-2.5 py-2 text-[13px] outline-none placeholder:text-muted" />}
          {step === 5 && (
            <div className="flex justify-center gap-2">
              {(['concise', 'balanced', 'detailed'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setCommunicationStyle(style)}
                  className={`rounded-md px-3 py-1.5 text-[13px] capitalize ${communicationStyle === style ? 'bg-accent-fill text-accent-fill-fg' : 'bg-surface-2 text-fg'}`}
                >
                  {style}
                </button>
              ))}
            </div>
          )}
        </div>
        {step !== 2 && (
          <div className="mt-6 flex gap-2">
            {step > 0 && <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>Back</Button>}
            <Button className="flex-1" onClick={() => void next()}>{step === steps.length - 1 ? 'Finish' : 'Next'}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
