import type { LocalProfile, ParsedResume, ResumeImportResult } from './types'

export const CUSTOM_CONTEXT_MAX = 1800
export const RESUME_PROMPT_TEXT_MAX = 8000
const SKILL_MAX = 40
const GOAL_MAX = 20

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const YEAR = '(?:19|20)\\d{2}'
const DATE_TOKEN = `(?:${MONTH}\\.?\\s*)?${YEAR}`
const DATE_RANGE = new RegExp(
  `\\b(${DATE_TOKEN})\\s*(?:[-–—]|to)\\s*(${DATE_TOKEN}|present|current|now|today)\\b`,
  'i',
)

const SECTION_ALIASES: Array<{ keys: string[]; section: string }> = [
  { keys: ['technical skills', 'tech skills', 'core skills', 'skills', 'skill'], section: 'skills' },
  { keys: ['work experience', 'professional experience', 'employment', 'experience', 'work history', 'work'], section: 'experience' },
  { keys: ['education', 'academic'], section: 'education' },
  { keys: ['personal projects', 'side projects', 'projects', 'project'], section: 'projects' },
  { keys: ['certifications', 'certificates', 'certification'], section: 'certifications' },
  { keys: ['spoken languages', 'languages', 'language'], section: 'languages' },
  { keys: ['achievements', 'awards', 'honors', 'accomplishments', 'achievement'], section: 'achievements' },
  { keys: ['summary', 'profile', 'about me', 'about'], section: 'summary' },
  { keys: ['career objective', 'objective', 'career goals', 'goals', 'goal'], section: 'goals' },
]

const TITLE_HINT =
  /\b(engineer|developer|designer|manager|intern|analyst|founder|scientist|consultant|architect|lead|director|specialist|officer|researcher|product|programmer|administrator|coordinator|executive|president|ceo|cto|cfo|vp|head|principal|staff|senior|junior|associate|fellow)\b/i

const JUNIOR_HINT = /\b(intern|internship|junior|entry[- ]level|student|graduate trainee|associate intern)\b/i
const SENIOR_HINT =
  /\b(senior|staff|principal|lead|head|director|manager|architect|fellow|vp|vice president|cto|ceo|chief)\b/i

const SPOKEN_LANGUAGES = new Set([
  'english',
  'spanish',
  'hindi',
  'french',
  'german',
  'mandarin',
  'chinese',
  'arabic',
  'portuguese',
  'japanese',
  'korean',
  'italian',
  'russian',
  'urdu',
  'bengali',
  'tamil',
  'telugu',
  'punjabi',
  'turkish',
  'dutch',
  'polish',
  'swedish',
  'vietnamese',
  'thai',
  'indonesian',
  'malay',
  'filipino',
  'tagalog',
  'greek',
  'hebrew',
  'persian',
  'farsi',
  'ukrainian',
  'czech',
  'romanian',
  'hungarian',
  'norwegian',
  'danish',
  'finnish',
  'catalan',
  'swahili',
  'gujarati',
  'marathi',
  'kannada',
  'malayalam',
])

export function emptyParsedResume(): ParsedResume {
  return {
    skills: [],
    languages: [],
    goals: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    achievements: [],
  }
}

export function parseResumeText(text: string): ParsedResume {
  const lines = normalizeLines(text)
  const parsed = emptyParsedResume()
  if (!lines.length) return parsed

  let currentSection: string | null = null
  const buckets: Record<string, string[]> = {}
  const headerLines: string[] = []

  for (const line of lines) {
    const section = detectSection(line)
    if (section) {
      currentSection = section
      continue
    }
    if (!currentSection) {
      headerLines.push(line)
      continue
    }
    ;(buckets[currentSection] ??= []).push(line)
  }

  applyHeader(parsed, headerLines)
  parsed.skills = uniqueStrings(splitSkillLines(buckets.skills ?? []).filter(isKeepSkill), SKILL_MAX)
  parsed.languages = uniqueStrings([
    ...splitSkillLines(buckets.languages ?? []),
    ...parsed.skills.filter((skill) => SPOKEN_LANGUAGES.has(skill.toLowerCase())),
  ], 20)
  parsed.summary = joinSentences(buckets.summary ?? [])
  parsed.goals = uniqueStrings([...(buckets.goals ?? []).flatMap(splitGoals), ...goalsFromSummary(parsed.summary)], GOAL_MAX)
  parsed.experience = parseExperience(buckets.experience ?? [])
  parsed.education = parseEducation(buckets.education ?? [])
  parsed.projects = parseProjects(buckets.projects ?? [])
  parsed.certifications = uniqueStrings(buckets.certifications ?? [], 16)
  parsed.achievements = uniqueStrings(buckets.achievements ?? [], 16)
  parsed.skills = uniqueStrings(
    [...parsed.skills, ...parsed.projects.flatMap((project) => project.technologies ?? [])],
    SKILL_MAX,
  )
  parsed.industry = inferIndustry(parsed)
  parsed.technicalLevel = inferTechnicalLevel(parsed)
  if (!parsed.headline) parsed.headline = parsed.experience[0]?.role
  return parsed
}

export function profileFromResume(parsed: ParsedResume): Partial<LocalProfile> {
  const latest = parsed.experience[0]
  const education = formatEducation(parsed.education)
  const skills = uniqueStrings(parsed.skills, SKILL_MAX)
  const goals = uniqueStrings(parsed.goals, GOAL_MAX)
  const customContext = resumeContext(parsed)
  return {
    preferredName: clip(parsed.name, 120),
    profession: clip(parsed.headline || latest?.role, 160),
    role: clip(latest?.role || parsed.headline, 160),
    industry: clip(parsed.industry, 160),
    education: clip(education, 200),
    skills,
    goals,
    technicalLevel: parsed.technicalLevel,
    customContext,
  }
}

export function mergeResumeIntoProfile(current: LocalProfile, parsed: ParsedResume): LocalProfile {
  const incoming = profileFromResume(parsed)
  const customContext = mergeContext(current.customContext, incoming.customContext)
  return {
    ...current,
    preferredName: current.preferredName?.trim() || incoming.preferredName,
    profession: current.profession?.trim() || incoming.profession,
    role: current.role?.trim() || incoming.role,
    industry: current.industry?.trim() || incoming.industry,
    education: current.education?.trim() || incoming.education,
    skills: uniqueStrings([...(current.skills ?? []), ...(incoming.skills ?? [])], SKILL_MAX),
    goals: uniqueStrings([...(current.goals ?? []), ...(incoming.goals ?? [])], GOAL_MAX),
    technicalLevel: pickTechnicalLevel(current.technicalLevel, incoming.technicalLevel),
    customContext,
  }
}

export function memoriesFromResume(parsed: ParsedResume): string[] {
  const facts: string[] = []
  const latest = parsed.experience[0]
  if (parsed.name && (latest?.role || parsed.headline)) {
    facts.push(
      `${parsed.name} works as ${latest?.role || parsed.headline}${latest?.company ? ` at ${latest.company}` : ''}.`,
    )
  } else if (parsed.name) {
    facts.push(`The user's name is ${parsed.name}.`)
  }
  if (parsed.headline && parsed.headline !== latest?.role) facts.push(`Professional headline: ${parsed.headline}.`)
  if (parsed.summary) facts.push(clip(`Background: ${parsed.summary}`, 400) ?? '')
  if (parsed.industry) facts.push(`Works in ${parsed.industry}.`)
  for (const job of parsed.experience.slice(0, 8)) {
    const who = [job.role ? `as ${job.role}` : '', job.company ? `at ${job.company}` : '', job.duration ? `(${job.duration})` : '']
      .filter(Boolean)
      .join(' ')
    const detail = job.description ? `: ${job.description}` : ''
    facts.push(clip(`Worked ${who}${detail}`.replace(/\s+/g, ' '), 400) ?? '')
  }
  if (parsed.skills.length) facts.push(clip(`Technologies and skills: ${parsed.skills.join(', ')}.`, 400) ?? '')
  if (parsed.languages.length) facts.push(`Speaks ${joinAnd(parsed.languages)}.`)
  for (const project of parsed.projects.slice(0, 8)) {
    const tech = project.technologies?.length ? ` Used ${project.technologies.join(', ')}.` : ''
    facts.push(clip(`Project ${project.name ?? 'work'}: ${project.description ?? 'personal project.'}${tech}`, 400) ?? '')
  }
  for (const item of parsed.education.slice(0, 4)) {
    facts.push(
      clip(
        `Studied ${[item.degree, item.institution ? `at ${item.institution}` : '', item.year].filter(Boolean).join(' ')}.`,
        400,
      ) ?? '',
    )
  }
  for (const item of parsed.certifications.slice(0, 6)) facts.push(`Certification: ${clip(item, 360)}.`)
  for (const item of parsed.achievements.slice(0, 8)) facts.push(clip(`Achievement: ${item}`, 400) ?? '')
  for (const goal of parsed.goals.slice(0, 6)) facts.push(`Goal: ${clip(goal, 380)}.`)
  for (const problem of problemsFromResume(parsed).slice(0, 8)) facts.push(problem)
  return uniqueStrings(facts.filter(Boolean), 50)
}

function normalizeLines(text: string): string[] {
  const cleaned = text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[•●▪◦‣∙]/g, '\n• ')
  const lines: string[] = []
  for (const raw of cleaned.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line) continue
    if (line.length > 220 && /[.!?];/.test(line)) {
      lines.push(...line.split(/(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean))
      continue
    }
    lines.push(line)
  }
  return lines
}

function detectSection(line: string): string | null {
  const lower = line.toLowerCase().replace(/[:|]/g, '').replace(/\s+/g, ' ').trim()
  if (!lower || lower.length > 40) return null
  if (lower.split(' ').length > 4) return null
  if (/^page\s+\d+/.test(lower)) return null
  for (const alias of SECTION_ALIASES) {
    if (alias.keys.includes(lower)) return alias.section
  }
  return null
}

function applyHeader(parsed: ParsedResume, lines: string[]) {
  const useful = lines.filter((line) => !isContactLine(line) && !detectSection(line))
  parsed.name = useful[0] ? clip(useful[0], 80) : undefined
  const next = useful[1]
  if (next && next.length <= 90 && !DATE_RANGE.test(next)) parsed.headline = clip(next, 160)
  const leftover = useful.slice(parsed.headline ? 2 : 1).filter((line) => !isContactLine(line))
  if (leftover.length) parsed.summary = joinSentences(leftover.slice(0, 4))
}

function isContactLine(line: string) {
  const value = line.trim()
  if (/@/.test(value) || /https?:\/\//i.test(value)) return true
  if (/(linkedin|github|portfolio|twitter|leetcode)\.com/i.test(value)) return true
  if (/^(phone|email|mobile|tel|address)\b/i.test(value)) return true
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 && /[\d+]/.test(value) && value.length <= 28
}

function splitSkillLines(lines: string[]): string[] {
  const items: string[] = []
  for (const line of lines) {
    const cleaned = line.replace(/^(skills?|technologies|tools|stack)\s*[:|-]\s*/i, '')
    items.push(
      ...cleaned
        .split(/[,|/•;]| {2,}|\band\b/i)
        .map((item) => item.trim())
        .filter((item) => item.length > 1 && item.length <= 40 && !/\s{3,}/.test(item)),
    )
  }
  return items
}

function skillListFrom(text: string): string[] {
  if (!/[,|/]/.test(text) && text.split(/\s+/).length > 4) return []
  return uniqueStrings(
    splitSkillLines([text]).filter((item) => item.length <= 32 && !/\b(using|with|that|this|from)\b/i.test(item)),
    12,
  )
}

function splitGoals(line: string): string[] {
  return line
    .split(/[.;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8)
}

function goalsFromSummary(summary?: string): string[] {
  if (!summary) return []
  const match = summary.match(/\b(?:seeking|looking for|aiming to|want to|goal is to)\s+([^.]{8,160})/i)
  return match?.[1] ? [match[1].trim()] : []
}

function parseExperience(lines: string[]): ParsedResume['experience'] {
  const jobs: ParsedResume['experience'] = []
  let current: ParsedResume['experience'][number] | null = null
  const flush = () => {
    if (!current) return
    if (current.description) current.description = clip(current.description, 500)
    jobs.push(current)
    current = null
  }
  for (const line of lines) {
    if (isBullet(line)) {
      const text = stripBullet(line)
      if (!current) current = {}
      current.description = current.description
        ? `${current.description.replace(/[.!?]$/, '')}. ${text}`
        : text
      harvestInlineSkills(text, current)
      continue
    }
    if (looksLikeJobHeader(line)) {
      flush()
      current = parseJobHeader(line)
      continue
    }
    if (current) {
      current.description = current.description ? `${current.description} ${line}` : line
    } else {
      current = parseJobHeader(line)
    }
  }
  flush()
  return jobs.filter((job) => job.role || job.company || job.description)
}

function looksLikeJobHeader(line: string) {
  if (isBullet(line) || line.length > 140) return false
  if (DATE_RANGE.test(line)) return true
  if (/\sat\s+/i.test(line)) return true
  if (/[|—–]/.test(line)) return true
  const parts = line.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length === 2 && parts.every((part) => part.length < 70)
}

function parseJobHeader(line: string): ParsedResume['experience'][number] {
  const duration = line.match(DATE_RANGE)?.[0]
  let rest = duration ? line.replace(duration, ' ').replace(/[|—–,-]\s*$/, '').replace(/\s+/g, ' ').trim() : line
  rest = rest.replace(/^[,|—–-]\s*|[,|—–-]\s*$/g, '').trim()
  const at = rest.match(/^(.+?)\s+at\s+(.+)$/i)
  if (at) return { role: clip(at[1], 120), company: clip(at[2], 120), duration: duration ? clip(duration, 40) : undefined }
  const parts = rest.split(/\s*[|—–]\s*/).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const [first, second] = parts
    if (TITLE_HINT.test(first) && !TITLE_HINT.test(second)) return { role: clip(first, 120), company: clip(second, 120), duration: duration ? clip(duration, 40) : undefined }
    if (TITLE_HINT.test(second) && !TITLE_HINT.test(first)) return { company: clip(first, 120), role: clip(second, 120), duration: duration ? clip(duration, 40) : undefined }
    return { role: clip(first, 120), company: clip(second, 120), duration: duration ? clip(duration, 40) : undefined }
  }
  const comma = rest.split(',').map((part) => part.trim()).filter(Boolean)
  if (comma.length === 2) {
    if (TITLE_HINT.test(comma[1])) return { company: clip(comma[0], 120), role: clip(comma[1], 120), duration: duration ? clip(duration, 40) : undefined }
    if (TITLE_HINT.test(comma[0])) return { role: clip(comma[0], 120), company: clip(comma[1], 120), duration: duration ? clip(duration, 40) : undefined }
  }
  if (TITLE_HINT.test(rest)) return { role: clip(rest, 120), duration: duration ? clip(duration, 40) : undefined }
  return { company: clip(rest, 120), duration: duration ? clip(duration, 40) : undefined }
}

function harvestInlineSkills(text: string, job: ParsedResume['experience'][number]) {
  const match = text.match(/^(?:tech(?:nologies)?|stack|tools|skills)\s*[:|-]\s*(.+)$/i)
  if (!match) return
  const extra = splitSkillLines([match[1]])
  if (!extra.length) return
  job.description = [job.description, `Technologies: ${extra.join(', ')}`].filter(Boolean).join(' ')
}

function parseEducation(lines: string[]): ParsedResume['education'] {
  const entries: ParsedResume['education'] = []
  let current: ParsedResume['education'][number] | null = null
  const flush = () => {
    if (current && (current.institution || current.degree)) entries.push(current)
    current = null
  }
  for (const line of lines) {
    if (isBullet(line) && current) {
      const text = stripBullet(line)
      current.degree = current.degree ? `${current.degree}; ${text}` : text
      continue
    }
    flush()
    const year = line.match(/\b((?:19|20)\d{2})\b/)?.[1]
    const cleaned = year ? line.replace(year, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim() : line
    const parts = cleaned.split(/\s*[,|—–-]\s*/).map((part) => part.trim()).filter(Boolean)
    if (parts.length >= 2) {
      const degreeLike = parts.find((part) => /\b(b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?|mba|bachelor|master|diploma|degree)\b/i.test(part))
      const institution = parts.find((part) => part !== degreeLike) ?? parts[0]
      current = { institution: clip(institution, 120), degree: clip(degreeLike ?? parts[0], 120), year }
    } else {
      current = { institution: clip(cleaned, 160), year }
    }
  }
  flush()
  return entries
}

function parseProjects(lines: string[]): ParsedResume['projects'] {
  const projects: ParsedResume['projects'] = []
  let current: ParsedResume['projects'][number] | null = null
  const flush = () => {
    if (!current) return
    if (current.description) current.description = clip(current.description, 400)
    projects.push(current)
    current = null
  }
  for (const line of lines) {
    if (isBullet(line)) {
      const text = stripBullet(line)
      if (!current) current = { name: clip(text, 80) }
      else current.description = current.description ? `${current.description} ${text}` : text
      const tech = text.match(/\(([^)]{3,80})\)/)
      if (tech) current.technologies = uniqueStrings([...(current.technologies ?? []), ...skillListFrom(tech[1])], 12)
      continue
    }
    flush()
    const [name, rest] = line.split(/\s*[|—–:]\s*/, 2)
    current = {
      name: clip(name, 80),
      description: rest ? clip(rest, 400) : undefined,
      technologies: rest ? skillListFrom(rest) : undefined,
    }
  }
  flush()
  return projects.filter((project) => project.name || project.description)
}

function inferIndustry(parsed: ParsedResume): string | undefined {
  const hay = [parsed.headline, parsed.summary, parsed.experience[0]?.description, parsed.experience[0]?.company]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const map: Array<[RegExp, string]> = [
    [/\b(fintech|investment bank|payments? platform|hedge fund)\b/, 'Finance'],
    [/\b(health|clinic|hospital|biotech|medtech)\b/, 'Healthcare'],
    [/\b(e-?commerce|retail|marketplace)\b/, 'E-commerce'],
    [/\b(educat|e-?learning|edtech)\b/, 'Education'],
    [/\b(game|gaming|unity|unreal)\b/, 'Gaming'],
    [/\b(cyber|security|infosec)\b/, 'Security'],
    [/\b(saas|b2b|enterprise software)\b/, 'Software'],
    [/\b(ai|machine learning|mlops|llm)\b/, 'Artificial intelligence'],
  ]
  return map.find(([pattern]) => pattern.test(hay))?.[1]
}

function inferTechnicalLevel(parsed: ParsedResume): LocalProfile['technicalLevel'] | undefined {
  const hay = [parsed.headline, ...parsed.experience.map((job) => `${job.role ?? ''} ${job.description ?? ''}`)].join(' ')
  if (SENIOR_HINT.test(hay)) return 'advanced'
  if (JUNIOR_HINT.test(hay) && parsed.experience.length <= 2) return 'beginner'
  if (parsed.experience.length >= 3 || parsed.skills.length >= 12) return 'intermediate'
  return undefined
}

function pickTechnicalLevel(
  current?: LocalProfile['technicalLevel'],
  incoming?: LocalProfile['technicalLevel'],
): LocalProfile['technicalLevel'] | undefined {
  if (incoming === 'advanced' || incoming === 'beginner') return incoming
  return current ?? incoming
}

function resumeContext(parsed: ParsedResume): string | undefined {
  const parts: string[] = []
  if (parsed.headline) parts.push(parsed.headline)
  if (parsed.summary) parts.push(parsed.summary)
  if (parsed.experience.length) {
    parts.push(
      `Previous work: ${parsed.experience
        .slice(0, 6)
        .map((job) =>
          [job.role, job.company ? `at ${job.company}` : '', job.duration ? `(${job.duration})` : '', job.description]
            .filter(Boolean)
            .join(' '),
        )
        .join('; ')}`,
    )
  }
  if (parsed.projects.length) {
    parts.push(
      `Projects: ${parsed.projects
        .slice(0, 6)
        .map((project) => [project.name, project.description].filter(Boolean).join(' — '))
        .join('; ')}`,
    )
  }
  if (parsed.languages.length) parts.push(`Languages: ${parsed.languages.join(', ')}`)
  if (parsed.certifications.length) parts.push(`Certifications: ${parsed.certifications.join('; ')}`)
  if (parsed.achievements.length) parts.push(`Achievements: ${parsed.achievements.join('; ')}`)
  const text = parts.join('\n')
  return text ? clip(text, CUSTOM_CONTEXT_MAX) : undefined
}

function mergeContext(current?: string, incoming?: string) {
  const existing = current?.trim() ?? ''
  const next = incoming?.trim() ?? ''
  if (!next) return existing || undefined
  if (!existing) return next
  if (existing.includes(next.slice(0, 80))) return existing
  return clip(`${existing}\n${next}`, CUSTOM_CONTEXT_MAX)
}

function formatEducation(entries: ParsedResume['education']) {
  if (!entries.length) return undefined
  return entries
    .slice(0, 3)
    .map((item) => [item.degree, item.institution, item.year].filter(Boolean).join(', '))
    .join('; ')
}

function problemsFromResume(parsed: ParsedResume): string[] {
  const blobs = [
    ...parsed.experience.map((job) => job.description ?? ''),
    ...parsed.projects.map((project) => project.description ?? ''),
    ...parsed.achievements,
  ]
  const facts: string[] = []
  for (const blob of blobs) {
    const sentences = blob.split(/(?<=[.!])\s+/).map((item) => item.trim()).filter(Boolean)
    for (const sentence of sentences) {
      if (!/\b(built|led|solved|fixed|reduced|improved|designed|launched|shipped|migrated|scaled|automated|increased|decreased)\b/i.test(sentence)) {
        continue
      }
      facts.push(clip(`Problem or result: ${sentence}`, 400) ?? '')
    }
  }
  return facts
}

function isBullet(line: string) {
  return /^[-–—*•●▪◦‣∙]\s+/.test(line) || /^\d+[.)]\s+/.test(line)
}

function stripBullet(line: string) {
  return line.replace(/^[-–—*•●▪◦‣∙]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()
}

function joinSentences(lines: string[]) {
  const text = lines.join(' ').replace(/\s+/g, ' ').trim()
  return text ? clip(text, 700) : undefined
}

function joinAnd(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export function clipResumeText(text: string): string {
  return text.replace(/\u0000/g, '').trim().slice(0, RESUME_PROMPT_TEXT_MAX)
}

export function promptResumeFromImport(imported: { parsed: ParsedResume; text?: string }): { parsed: ParsedResume; text: string } | undefined {
  const text = clipResumeText(imported.text ?? '')
  const parsed = imported.parsed
  const hasParsed =
    Boolean(parsed.name || parsed.headline || parsed.summary) ||
    parsed.skills.length > 0 ||
    parsed.experience.length > 0 ||
    parsed.education.length > 0 ||
    parsed.projects.length > 0 ||
    parsed.languages.length > 0 ||
    parsed.certifications.length > 0 ||
    parsed.achievements.length > 0
  if (!hasParsed && !text) return undefined
  return { parsed, text }
}

export function mergePromptMemories(groups: Array<string[] | undefined>, max = 120): string[] {
  return uniqueStrings(groups.flatMap((group) => group ?? []), max)
}

export function resumeImportFromParsed(
  text: string,
  parsed: ParsedResume,
  memories?: string[],
): ResumeImportResult {
  const clipped = clipResumeText(text)
  return {
    parsed,
    profile: profileFromResume(parsed),
    memories: memories?.length ? uniqueStrings(memories, 50) : memoriesFromResume(parsed),
    text: clipped,
    extractedChars: clipped.replace(/\s+/g, ' ').trim().length,
  }
}

export function parsedResumeFromModelJson(raw: unknown): ParsedResume {
  const data = asRecord(raw)
  const parsed = emptyParsedResume()
  parsed.name = clip(str(data.name), 120)
  parsed.headline = clip(str(data.headline), 160)
  parsed.summary = clip(str(data.summary), 800)
  parsed.industry = clip(str(data.industry), 160)
  parsed.skills = uniqueStrings(strList(data.skills).filter(isKeepSkill), SKILL_MAX)
  parsed.languages = uniqueStrings(strList(data.languages), 20)
  parsed.goals = uniqueStrings(strList(data.goals), GOAL_MAX)
  parsed.experience = objectList(data.experience).map((item) => ({
    company: clip(str(item.company), 120),
    role: clip(str(item.role), 160),
    duration: clip(str(item.duration), 80),
    description: clip(str(item.description), 500),
  })).filter((item) => item.company || item.role || item.description)
  parsed.education = objectList(data.education).map((item) => ({
    institution: clip(str(item.institution), 160),
    degree: clip(str(item.degree), 160),
    year: clip(str(item.year), 40),
  })).filter((item) => item.institution || item.degree)
  parsed.projects = objectList(data.projects).map((item) => ({
    name: clip(str(item.name), 120),
    description: clip(str(item.description), 400),
    technologies: uniqueStrings(strList(item.technologies).filter(isKeepSkill), 16),
  })).filter((item) => item.name || item.description)
  parsed.certifications = uniqueStrings(strList(data.certifications), 16)
  parsed.achievements = uniqueStrings(strList(data.achievements), 16)
  const level = str(data.technicalLevel)?.toLowerCase()
  if (level === 'beginner' || level === 'intermediate' || level === 'advanced') parsed.technicalLevel = level
  const projectNames = new Set(
    parsed.projects.map((project) => project.name?.toLowerCase()).filter(Boolean) as string[],
  )
  parsed.skills = parsed.skills.filter((skill) => !projectNames.has(skill.toLowerCase()))
  if (!parsed.industry) parsed.industry = inferIndustry(parsed)
  if (!parsed.technicalLevel) parsed.technicalLevel = inferTechnicalLevel(parsed)
  if (!parsed.headline) parsed.headline = parsed.experience[0]?.role
  return parsed
}

export function memoriesFromModelJson(raw: unknown, parsed: ParsedResume): string[] {
  const fromModel = strList(asRecord(raw).memories)
    .map((item) => clip(item, 400))
    .filter(Boolean) as string[]
  if (fromModel.length) return uniqueStrings(fromModel, 50)
  return memoriesFromResume(parsed)
}

export function uniqueStrings(items: Array<string | undefined>, max: number): string[] {
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

const JUNK_SKILL =
  /^(core|also|selected projects?|projects?|experience|education|work(?: history)?|skills?|summary|objective|profile|certifications?|achievements?|languages?|page(?:\s+\d+)?|\d+\s*of\s*\d+|system|design|software|computer|tools?|technologies|stack)$/i

function isKeepSkill(item: string) {
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
  if (typeof value === 'string') {
    return value.split(/[,;|/]/).map((item) => item.trim()).filter(Boolean)
  }
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => (typeof item === 'string' ? [item] : str(item) ? [str(item)!] : []))
}

function objectList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}
