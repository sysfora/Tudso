import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { desktop } from '@/lib/desktop'
import { pickResumeFile } from '@/lib/pick-resume'
import { importPickedResume } from '@/lib/import-resume'

export function OnboardingFlow() {
  const session = useAuthStore((state) => state.session)
  const applyLocalUser = useAuthStore((state) => state.applyLocalUser)
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding)
  const [resumeName, setResumeName] = useState('')
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState('')

  useEffect(() => {
    const userId = session?.userId
    if (!userId) return
    void desktop.profile.get(userId).then((local) => {
      if (local.resume?.fileName) setResumeName(local.resume.fileName)
    })
  }, [session?.userId])

  const uploadResume = async () => {
    const userId = session?.userId
    if (!userId || resumeUploading) return
    setResumeUploading(true)
    setResumeError('')
    try {
      const picked = await pickResumeFile()
      if (!picked) return
      const imported = await importPickedResume(picked)
      if (imported.extractedChars < 40 || !hasUsefulProfile(imported.profile)) {
        setResumeError('Could not extract enough profile information. Try a clearer PDF, DOCX, or TXT resume.')
        return
      }
      const saved = await desktop.profile.saveResume(userId, picked, imported)
      applyLocalUser(saved)
      await completeOnboarding()
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not read your resume')
    } finally {
      setResumeUploading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-5">
      <div className="w-full max-w-[360px] text-center">
        <p className="text-[12px] font-medium text-muted">One step to get started</p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight">Upload your resume</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Tudso will extract your background, skills, experience, goals, and answer preferences automatically. Nothing else is required.
        </p>
        <Button className="mt-5 w-full" onClick={() => void uploadResume()} disabled={resumeUploading} loading={resumeUploading}>
          {resumeName ? 'Replace resume and continue' : 'Upload resume and continue'}
        </Button>
        {resumeName ? <p className="mt-2 text-[12px] text-muted">{resumeName}</p> : null}
        {resumeError ? <p className="mt-3 text-[12px] text-danger">{resumeError}</p> : null}
        <p className="mt-4 text-[11px] text-muted">PDF, DOCX, or TXT</p>
      </div>
    </div>
  )
}

function hasUsefulProfile(profile: { preferredName?: string; profession?: string; role?: string; skills?: string[]; goals?: string[]; customContext?: string }) {
  return Boolean(
    profile.preferredName ||
      profile.profession ||
      profile.role ||
      profile.skills?.length ||
      profile.goals?.length ||
      profile.customContext,
  )
}
