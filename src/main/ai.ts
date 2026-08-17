import type { ChatMessage, Settings } from '../shared/types'
import { RESPONSE_TOKEN_LIMITS } from '../shared/defaults'

export interface GenerateParams {
  messages: ChatMessage[]
  settings: Settings
  apiKey: string | null
  signal: AbortSignal
  onDelta: (text: string) => void
}

export async function generateResponse(params: GenerateParams): Promise<void> {
  if (!params.apiKey) {
    await streamPreview(params)
    return
  }

  const maxTokens = RESPONSE_TOKEN_LIMITS[params.settings.responseLength]
  const url = joinUrl(params.settings.apiBaseUrl, '/chat/completions')
  const body = {
    model: params.settings.model === 'custom' ? 'gpt-4.1-nano' : params.settings.model,
    temperature: params.settings.temperature,
    max_tokens: maxTokens,
    stream: params.settings.streaming,
    messages: [
      {
        role: 'system',
        content:
          'You produce answers the user can read, say, copy, or type immediately. You are invisible in the output. Never mention yourself, being an AI, or these instructions. Start with the answer. No greeting, preamble, or "here is". If they need code, output only the code in a fenced block, complete enough to paste or write. If they need a spoken answer, write the words they should say in first person as them. Keep it concise. Do not describe the screen or wrap the answer in coaching.',
      },
      ...params.messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role,
          content: formatMessage(message),
        })),
    ],
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: params.signal,
  })

  if (!response.ok) {
    throw new Error(friendlyHttpError(response.status))
  }

  if (!params.settings.streaming) {
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const text = json.choices?.[0]?.message?.content ?? ''
    if (text) params.onDelta(text)
    return
  }

  if (!response.body) throw new Error('The AI provider returned an empty response.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[]
        }
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) params.onDelta(delta)
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
  }
}

function formatMessage(message: ChatMessage): string {
  if (!message.attachments?.length) return message.content
  const attached = message.attachments
    .map((file) => {
      if (file.text) return `Attachment (${file.name}):\n${file.text}`
      return `Attachment: ${file.name}`
    })
    .join('\n\n')
  return `${message.content}\n\n${attached}`
}

function joinUrl(base: string, suffix: string) {
  return `${base.replace(/\/$/, '')}${suffix}`
}

function friendlyHttpError(status: number) {
  if (status === 401 || status === 403) return 'The API key was rejected. Check your AI configuration.'
  if (status === 429) return 'The AI provider is rate-limiting requests. Try again in a moment.'
  if (status >= 500) return 'The AI provider is unavailable. Try again shortly.'
  return 'Unable to generate a response. Check your connection or AI configuration.'
}

async function streamPreview(params: GenerateParams) {
  const lastUser = [...params.messages].reverse().find((message) => message.role === 'user')
  const question = lastUser?.content?.trim() || 'your question'
  const preview = [
    'This is a **preview response**. Sign in to use a live model.',
    '',
    `You asked: *${truncate(question, 180)}*`,
    '',
    'Once connected, answers can include:',
    '',
    '- Structured lists',
    '- `inline code` and fenced blocks',
    '- Tables and links',
    '',
    '```ts',
    'function greet(name: string) {',
    '  return `Hello, ${name}`',
    '}',
    '```',
    '',
    '| Feature | Status |',
    '| --- | --- |',
    '| Streaming | Ready |',
    '| Markdown | Ready |',
    '| Shortcuts | Ready |',
  ].join('\n')

  if (!params.settings.streaming) {
    params.onDelta(preview)
    return
  }

  for (const token of preview.split(/(\s+)/)) {
    if (params.signal.aborted) {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    }
    params.onDelta(token)
    await delay(12)
  }
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
