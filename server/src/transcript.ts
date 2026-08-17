const HALLUCINATION_PATTERNS = [
  /^thanks for watching[.!?]*$/i,
  /^thank you for watching[.!?]*$/i,
  /^thanks for listening[.!?]*$/i,
  /^thank you for listening[.!?]*$/i,
  /^thanks for watching this video[.!?]*$/i,
  /^please subscribe[.!?]*$/i,
  /^like and subscribe[.!?]*$/i,
  /^don't forget to subscribe[.!?]*$/i,
  /^subscribe[.!?]*$/i,
  /^thanks[.!?]*$/i,
  /^thank you[.!?]*$/i,
  /^bye[.!?]*$/i,
  /^goodbye[.!?]*$/i,
  /^see you next time[.!?]*$/i,
  /^you[.!?]*$/i,
  /^the[.!?]*$/i,
  /^music[.!?]*$/i,
  /^applause[.!?]*$/i,
  /^\[.*\]$/,
  /^subtitle(s)? by .+$/i,
  /^transcribed by .+$/i,
  /^\.+$/,
  /^uh+[.\s]*$/i,
  /^um+[.\s]*$/i,
  /^hmm+[.\s]*$/i,
  /^ah+[.\s]*$/i,
  /^oh+[.\s]*$/i,
]

const SILENCE_HALLUCINATIONS = new Set([
  'hello',
  'hello hello',
  'hello there',
  'hi',
  'hi hi',
  'hey',
  'hey hey',
  'hey there',
  'waterfall',
  'water fall',
  'waterfalls',
  'thank you',
  'thanks',
  'thanks for watching',
  'thank you for watching',
  'bye',
  'goodbye',
  'you',
  'the',
  'music',
  'applause',
  'silence',
  'blank',
  'subtitle',
  'subtitles',
  'context',
])

function isPromptLeak(text: string): boolean {
  const compact = text.toLowerCase()
  return (
    compact.includes('this is a live spoken conversation') ||
    compact.includes('transcribe the speech accurately') ||
    compact.includes('do not add commentary or labels') ||
    compact.includes('live interview copilot') ||
    /^context:?$/i.test(text.trim())
  )
}

const NOISE_PATTERNS = [
  /^the audio is noisy[.!?]*$/i,
  /^audio is noisy[.!?]*$/i,
  /^noisy audio[.!?]*$/i,
  /^background noise[.!?]*$/i,
  /^inaudible[.!?]*$/i,
  /^no speech[.!?]*$/i,
  /^no audio[.!?]*$/i,
  /^empty string[.!?]*$/i,
  /^silence[.!?]*$/i,
  /^\[noise\]$/i,
  /^\[silence\]$/i,
  /^only noise[.!?]*$/i,
  /^too noisy[.!?]*$/i,
]

function normalize(text: string): string {
  return text.replace(/["'`]/g, '').replace(/\s+/g, ' ').trim()
}

function utteranceKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}

export function isHallucinatedTranscript(text: string): boolean {
  const value = normalize(text)
  if (value.length < 3) return true
  if (isPromptLeak(value)) return true
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(value))) return true
  const key = utteranceKey(value)
  if (SILENCE_HALLUCINATIONS.has(key)) return true
  const words = key.split(' ').filter(Boolean)
  if (words.length > 1 && words.length <= 4 && words.every((word) => word === words[0]) && SILENCE_HALLUCINATIONS.has(words[0])) {
    return true
  }
  const compact = value.toLowerCase()
  return (
    compact.includes('thanks for watching') ||
    compact.includes('thank you for watching') ||
    compact.includes('like and subscribe') ||
    compact.includes('please subscribe')
  )
}

export function isNoiseTranscript(text: string): boolean {
  const value = normalize(text)
  if (!value) return true
  return NOISE_PATTERNS.some((pattern) => pattern.test(value))
}

export function cleanTranscript(text: string): string {
  const trimmed = normalize(text)
  if (!trimmed || isHallucinatedTranscript(trimmed) || isNoiseTranscript(trimmed)) return ''
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .filter((part) => !isHallucinatedTranscript(part) && !isNoiseTranscript(part))
  return sentences.join(' ').trim()
}

export function isActionableTranscript(text: string): boolean {
  const cleaned = cleanTranscript(text)
  if (!cleaned || isNoiseTranscript(cleaned)) return false
  const words = cleaned.split(/\s+/).filter((word) => /[\p{L}]{2,}/u.test(word))
  return words.length >= 2 && cleaned.length >= 8
}
