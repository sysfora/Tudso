const TTL_MS = 6 * 60 * 60 * 1000
const MAX_ENTRIES = 2000

interface Entry {
  prompt: string
  expires: number
}

const cache = new Map<string, Entry>()

function key(userId: string, conversationId: string) {
  return `${userId}:${conversationId}`
}

function prune(now = Date.now()) {
  for (const [id, entry] of cache) {
    if (entry.expires <= now) cache.delete(id)
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (!oldest) break
    cache.delete(oldest)
  }
}

export function rememberSessionPrompt(userId: string, conversationId: string, prompt: string) {
  prune()
  cache.set(key(userId, conversationId), { prompt, expires: Date.now() + TTL_MS })
}

export function getSessionPrompt(userId: string, conversationId: string): string | undefined {
  const id = key(userId, conversationId)
  const entry = cache.get(id)
  if (!entry) return undefined
  if (entry.expires <= Date.now()) {
    cache.delete(id)
    return undefined
  }
  return entry.prompt
}

export function forgetSessionPrompt(userId: string, conversationId: string) {
  cache.delete(key(userId, conversationId))
}

export function clearSessionPrompts() {
  cache.clear()
}

export const SESSION_PROMPT_REQUIRED = 'session_prompt_required'
