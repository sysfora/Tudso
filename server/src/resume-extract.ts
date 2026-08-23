import type { ParsedResume } from './types.js'

export const RESUME_EXTRACT_SYSTEM = `Extract a structured resume from messy OCR or PDF text.

Decide what each token is. Do not dump the whole document into skills.

Rules:
- skills: real tools, languages, frameworks, clouds, databases, and named practices only (e.g. TypeScript, React, Prisma, System Design, RBAC, OpenAPI).
- Never put section titles, page markers, or project/company names in skills. Drop "Core", "Also", "SELECTED PROJECTS", "-- 1 of 3 --", "Projects".
- "System Design" is one skill. Do not split it into "System" and "Design".
- projects: product or repo names and what they are (e.g. Roboticela). Include technologies used on that project.
- experience: jobs with company, role, dates, and a short description.
- education, certifications, achievements, spoken languages, and career goals in their own arrays.
- Ignore contact noise, headers, footers, and page numbers.
- memories: up to 40 short facts an assistant should remember about this person. Third person is fine ("Built Roboticela with Tauri and Rust."). Prefer durable facts over slogans.

Return JSON only with this shape:
{
  "name": "",
  "headline": "",
  "summary": "",
  "industry": "",
  "technicalLevel": "beginner|intermediate|advanced",
  "skills": [],
  "languages": [],
  "goals": [],
  "experience": [{"company":"","role":"","duration":"","description":""}],
  "education": [{"institution":"","degree":"","year":""}],
  "projects": [{"name":"","description":"","technologies":[]}],
  "certifications": [],
  "achievements": [],
  "memories": []
}`

const SKILL_MAX = 40
const JUNK_SKILL =
  /^(core|also|selected projects?|projects?|experience|education|work(?: history)?|skills?|summary|objective|profile|certifications?|achievements?|languages?|page(?:\s+\d+)?|\d+\s*of\s*\d+|system|design|software|computer|tools?|technologies|stack)$/i

export function normalizeResumeExtraction(raw: unknown): { parsed: ParsedResume; memories: string[] } {
  const data = asRecord(raw)
  const skills = unique(strList(data.skills).filter(keepSkill), SKILL_MAX)
  const projects = objectList(data.projects)
    .map((item) => ({
      name: clip(str(item.name), 120),
      description: clip(str(item.description), 400),
      technologies: unique(strList(item.technologies).filter(keepSkill), 16),
    }))
    .filter((item) => item.name || item.description)
  const projectNames = new Set(projects.map((project) => project.name?.toLowerCase()).filter(Boolean) as string[])
  const parsed: ParsedResume = {
    name: clip(str(data.name), 120),
    headline: clip(str(data.headline), 160),
    summary: clip(str(data.summary), 800),
    industry: clip(str(data.industry), 160),
    skills: skills.filter((skill) => !projectNames.has(skill.toLowerCase())),
    languages: unique(strList(data.languages), 20),
    goals: unique(strList(data.goals), 20),
    experience: objectList(data.experience)
      .map((item) => ({
        company: clip(str(item.company), 120),
        role: clip(str(item.role), 160),
        duration: clip(str(item.duration), 80),
        description: clip(str(item.description), 500),
      }))
      .filter((item) => item.company || item.role || item.description),
    education: objectList(data.education)
      .map((item) => ({
        institution: clip(str(item.institution), 160),
        degree: clip(str(item.degree), 160),
        year: clip(str(item.year), 40),
      }))
      .filter((item) => item.institution || item.degree),
    projects,
    certifications: unique(strList(data.certifications), 16),
    achievements: unique(strList(data.achievements), 16),
  }
  const level = str(data.technicalLevel)?.toLowerCase()
  if (level === 'beginner' || level === 'intermediate' || level === 'advanced') parsed.technicalLevel = level
  if (!parsed.headline) parsed.headline = parsed.experience[0]?.role
  const memories = unique(
    strList(data.memories)
      .map((item) => clip(item, 400))
      .filter(Boolean) as string[],
    50,
  )
  return { parsed, memories }
}

function keepSkill(item: string) {
  const value = item.replace(/\s+/g, ' ').trim()
  if (value.length < 2 || value.length > 40) return false
  if (JUNK_SKILL.test(value)) return false
  if (/\b\d+\s*of\s*\d+\b/.test(value)) return false
  if (/^[-–—\d\s/]+$/.test(value)) return false
  return true
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function strList(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[,;|/]/).map((item) => item.trim()).filter(Boolean)
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => (typeof item === 'string' ? [item] : str(item) ? [str(item)!] : []))
}

function objectList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function unique(items: Array<string | undefined>, max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const value = item?.replace(/\s+/g, ' ').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= max) break
  }
  return out
}

function clip(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text
}
