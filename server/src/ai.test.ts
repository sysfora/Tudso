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
})
