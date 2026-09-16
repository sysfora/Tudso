import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { desktop } from '@/lib/desktop'
import { pickResumeFile } from '@/lib/pick-resume'
import { importPickedResume } from '@/lib/import-resume'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { snapshotLocalProfile } from '@/types/api'
import { planDisplayName, remainingSessionsDisplay, sessionMinutesForPlan } from '@shared/plans'

type SetupStep = 'resume' | 'details'

export function SessionSetup() {
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const entitlement = useAuthStore((state) => state.entitlement)
  const startSession = useAppStore((state) => state.startSession)
  const cancelSessionSetup = useAppStore((state) => state.cancelSessionSetup)
  const [resumeName, setResumeName] = useState('')
  const [hasCurrentResume, setHasCurrentResume] = useState(false)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [positionTitle, setPositionTitle] = useState('')
  const [step, setStep] = useState<SetupStep>('details')
  const [pendingResumeFile, setPendingResumeFile] = useState<{ fileName: string; mimeType: string; data: ArrayBuffer } | null>(null)
  const [pendingResumeImport, setPendingResumeImport] = useState<any | null>(null)
  const timeLimitMinutes = sessionMinutesForPlan(entitlement?.plan)
  const remainingSessions = remainingSessionsDisplay(entitlement?.plan, entitlement?.status, entitlement?.interviewCredits)
  const planLabel = planDisplayName(entitlement?.plan)

  useEffect(() => {
    const userId = session?.userId
    if (!userId) return
    void desktop.profile.get(userId).then((local) => {
      const nextHasResume = Boolean(local.resume?.fileName)
      setHasCurrentResume(nextHasResume)
      if (nextHasResume) setResumeName(local.resume?.fileName ?? '')
    })
  }, [session?.userId])

  const handleSelectedResume = async (picked: { fileName: string; mimeType: string; data: ArrayBuffer }, imported: any) => {
    if (imported.extractedChars < 40 || !hasUsefulProfile(imported.profile)) {
      setResumeError('Could not extract enough profile information. Try a clearer PDF, DOCX, or TXT resume.')
      return
    }
    setPendingResumeFile(picked)
    setPendingResumeImport(imported)
    setResumeName(picked.fileName)
    setResumeError('')
    setStep('resume')
  }

  const uploadResume = async () => {
    if (resumeUploading) return
    setResumeUploading(true)
    setResumeError('')
    try {
      const picked = await pickResumeFile()
      if (!picked) return
      const imported = await importPickedResume(picked)
      await handleSelectedResume(picked, imported)
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not read your resume')
    } finally {
      setResumeUploading(false)
    }
  }

  const startFromDetails = async () => {
    if (resumeUploading) return
    setResumeUploading(true)
    setResumeError('')
    try {
      const baseProfile = snapshotLocalProfile(profile)
      if (pendingResumeFile && pendingResumeImport) {
        const nextProfile = {
          ...baseProfile,
          ...pendingResumeImport.profile,
          skills: pendingResumeImport.profile.skills ?? baseProfile.skills,
          goals: pendingResumeImport.profile.goals ?? baseProfile.goals,
        }
        await startSession({
          profile: nextProfile,
          usedDefaults: false,
          resumeFile: pendingResumeFile,
          resumeImport: pendingResumeImport,
          memoryFacts: pendingResumeImport.memories,
          companyName: companyName.trim(),
          position: positionTitle.trim(),
        })
        return
      }

      await startSession({
        profile: baseProfile,
        usedDefaults: true,
        companyName: companyName.trim(),
        position: positionTitle.trim(),
      })
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not start this interview session')
    } finally {
      setResumeUploading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-5">
      <div className="w-full max-w-[420px] text-center">
        <p className="text-[12px] font-medium text-muted">New interview session</p>

        {step === 'details' ? (
          <>
            <h1 className="mt-1 text-[20px] font-semibold tracking-tight">Session details</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Review your plan, confirm the interview timing, and add any application context.
            </p>

            <div className="mt-4 rounded-xl border border-border bg-surface-2/80 px-3 py-2 text-left">
              <div className="flex items-center justify-between gap-3 text-[12px] text-muted">
                <span>Plan</span>
                <span className="font-medium text-fg">{planLabel}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted">
                <span>Time limit</span>
                <span className="font-medium text-fg">{timeLimitMinutes} min</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted">
                <span>Remaining sessions</span>
                <span className="font-medium text-fg">{remainingSessions}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-left">
              <div>
                <label htmlFor="session-company" className="mb-1.5 block text-[12px] font-medium text-muted">
                  Company name <span className="text-[11px] text-muted">(optional)</span>
                </label>
                <input
                  id="session-company"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] text-fg outline-none placeholder:text-muted focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="session-position" className="mb-1.5 block text-[12px] font-medium text-muted">
                  Position <span className="text-[11px] text-muted">(optional)</span>
                </label>
                <input
                  id="session-position"
                  value={positionTitle}
                  onChange={(event) => setPositionTitle(event.target.value)}
                  placeholder="e.g. Senior Product Engineer"
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] text-fg outline-none placeholder:text-muted focus:border-accent"
                />
              </div>
            </div>

            {resumeName ? <p className="mt-3 text-[12px] text-muted">Using: {resumeName}</p> : null}
            {resumeError ? <p className="mt-3 text-[12px] text-danger">{resumeError}</p> : null}

            <div className="mt-5 space-y-3">
              <Button className="w-full" onClick={() => setStep('resume')} disabled={resumeUploading}>
                Continue to resume
              </Button>
              <Button variant="outline" className="w-full" onClick={cancelSessionSetup} disabled={resumeUploading}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-[20px] font-semibold tracking-tight">
              {hasCurrentResume ? 'Use your current resume to start' : 'Upload your resume to start'}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {hasCurrentResume
                ? 'Your saved resume is ready to use for this session.'
                : 'Tudso will extract everything it needs before starting your session.'}
            </p>

            {hasCurrentResume ? (
              <>
                <Button className="mt-5 w-full" onClick={() => void startFromDetails()} disabled={resumeUploading} loading={resumeUploading}>
                  Continue with current resume
                </Button>
                <Button variant="outline" className="mt-3 w-full" onClick={() => void uploadResume()} disabled={resumeUploading} loading={resumeUploading}>
                  Upload a different resume
                </Button>
              </>
            ) : (
              <Button className="mt-5 w-full" onClick={() => void uploadResume()} disabled={resumeUploading} loading={resumeUploading}>
                Upload resume
              </Button>
            )}

            {resumeName ? <p className="mt-2 text-[12px] text-muted">{resumeName}</p> : null}
            {pendingResumeImport ? (
              <Button className="mt-3 w-full" onClick={() => void startFromDetails()} disabled={resumeUploading} loading={resumeUploading}>
                Start session
              </Button>
            ) : null}
            {resumeError ? <p className="mt-3 text-[12px] text-danger">{resumeError}</p> : null}
            <Button variant="outline" className="mt-3 w-full" onClick={() => setStep('details')} disabled={resumeUploading}>
              Back to details
            </Button>
            <p className="mt-4 text-[11px] text-muted">PDF, DOCX, or TXT</p>
          </>
        )}
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
