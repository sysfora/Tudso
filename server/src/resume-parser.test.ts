import { describe, expect, it } from 'vitest'
import { parseResume } from './resume-parser.js'

describe('resume parser', () => {
  it('extracts skills from a skills section', () => {
    const text = [
      'John Doe',
      'Skills',
      'React, TypeScript, Node.js',
      'Experience',
      'Company A, Software Engineer',
    ].join('\n')
    const parsed = parseResume(text)
    expect(parsed.name).toBe('John Doe')
    expect(parsed.skills).toContain('React')
    expect(parsed.skills).toContain('TypeScript')
  })

  it('extracts education entries', () => {
    const text = [
      'Education',
      'BS Computer Science, MIT',
    ].join('\n')
    const parsed = parseResume(text)
    expect(parsed.education.length).toBeGreaterThan(0)
    expect(parsed.education[0]?.institution).toContain('MIT')
  })
})
