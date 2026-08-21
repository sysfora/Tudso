const PLACEHOLDER_SESSION_TITLE = /^(new session|answer from screen|live copilot)$/i
const AUTO_TITLE_LENGTH = 42
export const MAX_SESSION_TITLE = 80

export function createId() {
  return crypto.randomUUID()
}

export function isPlaceholderSessionTitle(title: string) {
  const clean = title.replace(/\s+/g, ' ').trim()
  return !clean || PLACEHOLDER_SESSION_TITLE.test(clean)
}

export function sessionTitleFromChat(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean || PLACEHOLDER_SESSION_TITLE.test(clean)) return null
  return clean.length > AUTO_TITLE_LENGTH ? `${clean.slice(0, AUTO_TITLE_LENGTH)}…` : clean
}

export function makeTitle(text: string) {
  return sessionTitleFromChat(text) ?? 'New session'
}

export function conversationGroup(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  if (date.getTime() >= startOfToday) return 'Today'
  if (date.getTime() >= startOfYesterday) return 'Yesterday'
  return 'Older'
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatSessionTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return new Intl.DateTimeFormat(undefined, {
    month: sameDay ? undefined : 'short',
    day: sameDay ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatMemoryDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(date)
}

export function formatPlanPrice(amount: number | null | undefined, currency?: string, interval?: string) {
  if (amount == null || !currency) return null
  const value = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100)
  return interval ? `${value} / ${interval}` : value
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
