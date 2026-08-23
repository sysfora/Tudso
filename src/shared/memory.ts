import type { MemoryEntry } from './types'

export const MAX_MEMORIES = 120
export const MAX_MEMORY_CHARS = 400

const CANNED_USER_TEXT = /^(Live copilot|Answer from screen)$/i
const SCREEN_OR_LIVE_PROMPT =
  /^(Answer from this screenshot|Answer whatever needs a response on this screenshot|Answer from this live transcript|Answer from this screenshot and live transcript)/i

export function normalizeMemoryEntries(raw: unknown): MemoryEntry[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []

  const out: MemoryEntry[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const text = typeof record.text === 'string' ? record.text.replace(/\s+/g, ' ').trim() : ''
    if (!text) continue
    const clipped = text.slice(0, MAX_MEMORY_CHARS)
    const key = clipped.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : crypto.randomUUID(),
      text: clipped,
      created: typeof record.created === 'string' && record.created ? record.created : new Date().toISOString(),
      source: record.source === 'auto' ? 'auto' : 'manual',
    })
    if (out.length >= MAX_MEMORIES) break
  }
  return out
}

export function mergeAutoMemories(existing: MemoryEntry[], facts: string[]): MemoryEntry[] {
  const next = normalizeMemoryEntries(existing)
  const seen = new Set(next.map((entry) => entry.text.toLowerCase()))
  const created = new Date().toISOString()
  for (const fact of facts) {
    const text = fact.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_CHARS)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    if ([...seen].some((saved) => saved.includes(key) || key.includes(saved))) continue
    seen.add(key)
    next.unshift({
      id: crypto.randomUUID(),
      text,
      created,
      source: 'auto',
    })
  }
  while (next.length > MAX_MEMORIES) {
    let dropAt = -1
    for (let i = next.length - 1; i >= 0; i -= 1) {
      if (next[i].source === 'auto') {
        dropAt = i
        break
      }
    }
    if (dropAt === -1) next.pop()
    else next.splice(dropAt, 1)
  }
  return next
}

export function shouldLearnFromMessage(userText: string): boolean {
  const text = userText.replace(/\s+/g, ' ').trim()
  if (text.length < 24) return false
  if (CANNED_USER_TEXT.test(text)) return false
  if (SCREEN_OR_LIVE_PROMPT.test(text)) return false
  return true
}

export function storedUserContent(message: string): string {
  const transcript = message.match(/Transcript:\s*([\s\S]+)$/i)?.[1]?.trim()
  if (transcript && transcript !== '(no speech in this moment)') return transcript
  if (/live interview copilot|Audio source:/i.test(message)) return 'Live copilot'
  if (/Answer from this screenshot|Answer whatever needs a response on this screenshot/i.test(message)) {
    return 'Answer from screen'
  }
  return message
}
