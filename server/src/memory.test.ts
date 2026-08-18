import { describe, expect, it } from 'vitest'
import {
  mergeAutoMemories,
  parseExtractedFacts,
  parseUserContext,
  serializeUserContext,
  shouldLearnFromMessage,
} from './memory.js'

describe('parseUserContext', () => {
  it('treats a legacy array as enabled memory', () => {
    const parsed = parseUserContext([{ id: '1', text: 'I prefer TypeScript', created: '2026-01-01' }])
    expect(parsed.enabled).toBe(true)
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].text).toBe('I prefer TypeScript')
  })

  it('defaults missing enabled to on', () => {
    expect(parseUserContext({ items: [] }).enabled).toBe(true)
    expect(parseUserContext(null).enabled).toBe(true)
  })

  it('reads an explicit off flag', () => {
    const parsed = parseUserContext({ enabled: false, items: [{ id: '1', text: 'Keep this', created: '2026-01-01' }] })
    expect(parsed.enabled).toBe(false)
    expect(parsed.entries[0].text).toBe('Keep this')
  })
})

describe('serializeUserContext', () => {
  it('wraps entries so enabled survives a rewrite', () => {
    const stored = serializeUserContext([{ id: '1', text: 'I work remotely', created: '2026-01-01', source: 'manual' }], false)
    expect(stored.enabled).toBe(false)
    expect(stored.items[0].text).toBe('I work remotely')
    expect(parseUserContext(stored).enabled).toBe(false)
  })
})

describe('mergeAutoMemories', () => {
  it('prepends unique auto facts and skips duplicates', () => {
    const existing = [{ id: '1', text: 'I prefer TypeScript', created: '2026-01-01', source: 'manual' as const }]
    const next = mergeAutoMemories(existing, ['I prefer TypeScript', 'I work in UTC+5'])
    expect(next.map((entry) => entry.text)).toEqual(['I work in UTC+5', 'I prefer TypeScript'])
    expect(next[0].source).toBe('auto')
  })
})

describe('shouldLearnFromMessage', () => {
  it('learns from a durable personal statement', () => {
    expect(shouldLearnFromMessage('I prefer TypeScript and never use class components.')).toBe(true)
  })

  it('skips canned screen and live prompts', () => {
    expect(shouldLearnFromMessage('Answer from screen')).toBe(false)
    expect(shouldLearnFromMessage('Live copilot')).toBe(false)
    expect(shouldLearnFromMessage('Answer from this screenshot. Read the latest interviewer question.')).toBe(false)
  })
})

describe('parseExtractedFacts', () => {
  it('keeps up to three unique fact strings', () => {
    expect(parseExtractedFacts({ facts: ['I use React', 'I use React', 'I work remotely', 'I like terse answers'] })).toEqual([
      'I use React',
      'I work remotely',
      'I like terse answers',
    ])
  })
})
