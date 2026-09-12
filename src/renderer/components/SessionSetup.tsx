import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { pickResumeFile } from '@/lib/pick-resume'
import { importPickedResume } from '@/lib/import-resume'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { snapshotLocalProfile } from '@/types/api'

export function SessionSetup() {
  const profile = useAuthStore((state) => state.profile)
  const startSession = useAppStore((state) => state.startSession)
  const cancelSessionSetup = useAppStore((state) => state.cancelSessionSetup)
  const [resumeName, setResumeName] = useState('')
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState('')

  const uploadAndStart = async () => {
    if (resumeUploading) return
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
      setResumeName(picked.fileName)
      const baseProfile = snapshotLocalProfile(profile)
      await startSession({
        profile: {
          ...baseProfile,
          ...imported.profile,
          skills: imported.profile.skills ?? baseProfile.skills,
          goals: imported.profile.goals ?? baseProfile.goals,
        },
        usedDefaults: false,
        resumeFile: picked,
        resumeImport: imported,
        memoryFacts: imported.memories,
      })
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not read your resume')
    } finally {
      setResumeUploading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-5">
      <div className="w-full max-w-[360px] text-center">
        <p className="text-[12px] font-medium text-muted">New interview session</p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight">Upload your resume to start</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Tudso will extract everything it needs and continue directly into your session.
        </p>
        <Button className="mt-5 w-full" onClick={() => void uploadAndStart()} disabled={resumeUploading} loading={resumeUploading}>
          Upload resume and start session
        </Button>
        {resumeName ? <p className="mt-2 text-[12px] text-muted">{resumeName}</p> : null}
        {resumeError ? <p className="mt-3 text-[12px] text-danger">{resumeError}</p> : null}
        <Button variant="outline" className="mt-3 w-full" onClick={cancelSessionSetup} disabled={resumeUploading}>
          Cancel
        </Button>
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
