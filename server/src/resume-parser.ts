import fs from 'node:fs/promises'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import type { ParsedResume } from './types.js'

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: await fs.readFile(filePath) })
    try {
      const result = await parser.getText()
      return result.text
    } finally {
      await parser.destroy()
    }
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return fs.readFile(filePath, 'utf-8')
  }
  return ''
}

const SECTION_HEADERS = new Set([
  'skills',
  'skill',
  'experience',
  'work experience',
  'work',
  'education',
  'projects',
  'project',
  'certifications',
  'certification',
  'languages',
  'language',
  'achievements',
  'achievement',
  'summary',
  'objective',
  'profile',
])

function detectSection(line: string): string | null {
  const lower = line.toLowerCase().replace(/[:]/g, '').trim()
  if (lower.includes('skill')) return 'skills'
  if (lower.includes('experience') || lower === 'work') return 'experience'
  if (lower.includes('education')) return 'education'
  if (lower.includes('project')) return 'projects'
  if (lower.includes('certification')) return 'certifications'
  if (lower.includes('language')) return 'languages'
  if (lower.includes('achievement')) return 'achievements'
  if (lower.includes('summary') || lower.includes('objective')) return 'summary'
  return null
}

function isSectionHeader(line: string): boolean {
  const lower = line.toLowerCase().replace(/[:]/g, '').trim()
  return SECTION_HEADERS.has(lower) || Boolean(detectSection(line) && lower.split(/\s+/).length <= 3)
}

export function parseResume(text: string): ParsedResume {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const skills: string[] = []
  const experience: ParsedResume['experience'] = []
  const education: ParsedResume['education'] = []
  const projects: ParsedResume['projects'] = []
  const certifications: string[] = []
  const languages: string[] = []
  const achievements: string[] = []
  let summary: string | undefined
  let name: string | undefined

  let currentSection: string | null = null
  for (const line of lines) {
    if (!name && !currentSection && !detectSection(line)) {
      name = line
      continue
    }
    const section = detectSection(line)
    if (section && isSectionHeader(line)) {
      currentSection = section
      continue
    }

    if (currentSection === 'skills') {
      skills.push(...line.split(/[,•|]/).map((item) => item.trim()).filter(Boolean))
    } else if (currentSection === 'experience') {
      experience.push({ description: line })
    } else if (currentSection === 'education') {
      education.push({ institution: line })
    } else if (currentSection === 'projects') {
      projects.push({ description: line })
    } else if (currentSection === 'certifications') {
      certifications.push(line)
    } else if (currentSection === 'languages') {
      languages.push(line)
    } else if (currentSection === 'achievements') {
      achievements.push(line)
    } else if (currentSection === 'summary') {
      summary = summary ? `${summary} ${line}` : line
    }
  }

  return {
    name,
    summary,
    skills,
    experience,
    education,
    projects,
    certifications,
    languages,
    achievements,
  }
}
