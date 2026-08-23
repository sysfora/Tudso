import { api } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import { memoriesFromModelJson, parsedResumeFromModelJson, resumeImportFromParsed } from '@shared/resume-parse'
import type { ParsedResume, PickedResume, ResumeImportResult } from '@shared/types'

export async function importPickedResume(file: PickedResume): Promise<ResumeImportResult> {
  const extracted = await desktop.resume.extract(file)
  if (extracted.text.trim()) {
    try {
      const result = await api.ai.parseResume(extracted.text)
      const parsed = parsedResumeFromModelJson(result.parsed)
      if (hasUsefulParse(parsed)) {
        return resumeImportFromParsed(extracted.text, parsed, memoriesFromModelJson(result, parsed))
      }
    } catch {
      // Fall back to local section heuristics when the model is unavailable.
    }
  }
  return desktop.resume.parse(file)
}

function hasUsefulParse(parsed: ParsedResume) {
  return Boolean(
    parsed.skills.length ||
      parsed.projects.length ||
      parsed.experience.length ||
      parsed.education.length ||
      parsed.name ||
      parsed.summary,
  )
}
