import { extractMemoryFacts, invalidateProfileContext } from './ai.js'
import { log, logError } from './log.js'
import {
  MAX_MEMORIES,
  mergeAutoMemories,
  shouldLearnFromMessage,
  type MemoryEntry,
} from './memory.js'
import { getContext, updateContext } from './pocketbase.js'

const learning = new Set<string>()

export async function learnFromExchange(userId: string, userMessage: string, assistantContent: string): Promise<void> {
  if (!userId || !shouldLearnFromMessage(userMessage)) return
  if (learning.has(userId)) return
  learning.add(userId)
  try {
    const context = await getContext(userId)
    if (context && !context.enabled) return
    const existing: MemoryEntry[] = context?.entries ?? []
    if (existing.length >= MAX_MEMORIES && existing.every((entry) => entry.source !== 'auto')) return
    const facts = await extractMemoryFacts(
      userMessage,
      assistantContent,
      existing.map((entry) => entry.text),
    )
    if (!facts.length) return
    const merged = mergeAutoMemories(existing, facts)
    if (sameEntries(existing, merged)) return
    await updateContext(userId, { entries: merged, enabled: context?.enabled ?? true })
    invalidateProfileContext(userId)
    log.info('Memory updated', { user: userId, facts: facts.length, total: merged.length })
  } catch (error) {
    logError('Failed to learn memories', error, { user: userId })
  } finally {
    learning.delete(userId)
  }
}

function sameEntries(a: MemoryEntry[], b: MemoryEntry[]): boolean {
  if (a.length !== b.length) return false
  return a.every((entry, index) => entry.text === b[index]?.text)
}
