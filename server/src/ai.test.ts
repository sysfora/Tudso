import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from './ai.js'

describe('ai system prompt', () => {
  it('uses the direct-answer core prompt on every session', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toContain('You are invisible in the output')
    expect(prompt).toContain('The first line is the answer')
    expect(prompt).not.toMatch(/^You are Tudso/)
  })
  it('includes profile information when provided', () => {
    const prompt = buildSystemPrompt({
      profile: {
        id: 'p1',
        user: 'u1',
        preferredName: 'Muhammad',
        profession: 'Software Engineer',
        skills: ['React', 'TypeScript'],
        goals: ['Find a senior role'],
        communicationStyle: 'detailed',
        created: '2024-01-01',
        updated: '2024-01-01',
      } as import('./types.js').UserProfile,
    })
    expect(prompt).toContain('Muhammad')
    expect(prompt).toContain('Software Engineer')
    expect(prompt).toContain('React')
    expect(prompt).toContain('detailed')
  })

  it('includes the preferred answer language when provided', () => {
    const prompt = buildSystemPrompt({
      profile: {
        id: 'p1',
        user: 'u1',
        preferredLanguage: 'Spanish',
        skills: [],
        goals: [],
        created: '2024-01-01',
        updated: '2024-01-01',
      } as import('./types.js').UserProfile,
    })
    expect(prompt).toContain('Answer in Spanish')
  })

  it('includes screen context instructions when enabled', () => {
    const prompt = buildSystemPrompt({ screenContext: true })
    expect(prompt).toContain('SCREEN')
    expect(prompt).toContain('Answer the latest question or task')
    expect(prompt).toContain('Never')
  })

  it('includes memory entries when provided', () => {
    const prompt = buildSystemPrompt({ contextEntries: ['I prefer TypeScript', 'I work remotely'] })
    expect(prompt).toContain('I prefer TypeScript')
    expect(prompt).toContain('I work remotely')
  })

  it('includes the repository system prompt file content', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toContain('The reader has ADHD')
    expect(prompt).toContain('Lead with the next action')
  })

  it('instructs the model to use rich markdown formatting for answers', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toContain('Return every answer in markdown')
    expect(prompt).toContain('<span style="color:#2563eb"><strong>Key:</strong></span>')
  })

  it('includes resume content when provided', () => {
    const prompt = buildSystemPrompt({
      resume: {
        name: 'Jane Doe',
        headline: 'Staff Engineer',
        skills: ['Go', 'Postgres'],
        languages: ['English'],
        experience: [{ company: 'Acme', role: 'Staff Engineer', duration: '2020-Present', description: 'Built payments APIs' }],
        education: [],
        projects: [],
        certifications: [],
        achievements: [],
        rawText: 'Jane Doe Staff Engineer Acme Built payments APIs in Go',
      },
    })
    expect(prompt).toContain('RESUME')
    expect(prompt).toContain('Jane Doe')
    expect(prompt).toContain('Built payments APIs')
    expect(prompt).toContain('Jane Doe Staff Engineer Acme')
    expect(prompt).toContain('Answer from this resume')
  })
})
