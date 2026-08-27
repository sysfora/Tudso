import { config } from '@/config'
import type { BillingPlanPrice, Entitlement, Subscription } from '@/types/api'
import { toPromptProfile, toPromptResume } from '@/types/api'
import type { PaidPlan } from '@shared/plans'

const API_BASE = config.serverUrl

export function getToken(): string | null {
  return localStorage.getItem('tudso.token')
}

function headers(body?: BodyInit | null): Record<string, string> {
  const token = getToken()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(options?.body), ...(options?.headers ?? {}) },
  })
  if (!response.ok) {
    const text = await response.text()
    let message = text || response.statusText
    try {
      const json = JSON.parse(text) as { error?: string; message?: string }
      message = json.error || json.message || message
    } catch {
      // keep the raw body when it is not JSON
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function fetchAccountAvatar(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl) return null
  const token = getToken()
  const response = await fetch(`${API_BASE}${avatarUrl}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) return null
  return URL.createObjectURL(await response.blob())
}

async function subscribeSse<T>(path: string, onUpdate: (value: T) => void, signal: AbortSignal): Promise<void> {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(response.statusText || 'Could not subscribe')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((entry) => entry.startsWith('data: '))
      if (!line) continue
      onUpdate(JSON.parse(line.slice(6)) as T)
    }
  }
}

const boundSessionPrompts = new Set<string>()

export type AiTurnRequest = {
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  signal?: AbortSignal
  model?: string
  conversationId?: string
  profile?: ReturnType<typeof toPromptProfile>
  memories?: string[]
  resume?: ReturnType<typeof toPromptResume>
}

async function postAiStream(path: '/ai/chat' | '/ai/vision', body: AiTurnRequest & { image?: string }) {
  const { signal, conversationId, image, ...rest } = body
  const send = (includeSessionPrompt: boolean) =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { ...headers(), Accept: 'text/plain', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        message: rest.message,
        history: rest.history,
        stream: true,
        model: rest.model,
        conversationId,
        ...(image ? { image } : {}),
        ...(includeSessionPrompt ? { profile: rest.profile, memories: rest.memories, resume: rest.resume } : {}),
      }),
      signal,
      cache: 'no-store',
    })

  const alreadyBound = Boolean(conversationId && boundSessionPrompts.has(conversationId))
  let response = await send(!alreadyBound)
  if (response.status === 409 && conversationId && alreadyBound) {
    boundSessionPrompts.delete(conversationId)
    response = await send(true)
  }
  if (!response.ok) throw new Error(await response.text())
  if (conversationId) boundSessionPrompts.add(conversationId)
  return response.body as ReadableStream<Uint8Array> | null
}

export const api = {
  auth: {
    start: (deviceId: string, platform: string, appVersion: string) =>
      fetchJson<{ url: string; state: string }>('/auth/desktop/start', {
        method: 'POST',
        body: JSON.stringify({ deviceId, platform, appVersion }),
      }),
    callback: (code: string, state: string, pocketbaseToken: string, deviceId: string, platform: string, appVersion: string) =>
      fetchJson<{ desktopToken: string; userId: string; email: string }>('/auth/desktop/callback', {
        method: 'POST',
        body: JSON.stringify({ code, state, pocketbaseToken, deviceId, platform, appVersion }),
      }),
    logout: () => fetchJson<void>('/auth/logout', { method: 'POST' }),
  },
  me: {
    get: () => fetchJson<{ userId: string; email: string; name?: string; avatarUrl?: string | null; onboardingComplete?: boolean }>('/me'),
    getAccount: () => fetchJson<{ userId: string; email: string; name: string; avatarUrl: string | null }>('/me/account'),
    updateName: (name: string) =>
      fetchJson<{ userId: string; email: string; name: string; avatarUrl: string | null }>('/me/account', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    changePassword: (currentPassword: string, password: string, passwordConfirm: string) =>
      fetchJson<{ ok: true }>('/me/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, password, passwordConfirm }),
      }),
    uploadAvatar: (file: File) => {
      const body = new FormData()
      body.append('avatar', file)
      return fetchJson<{ userId: string; email: string; name: string; avatarUrl: string | null }>('/me/account/avatar', {
        method: 'POST',
        body,
      })
    },
    removeAvatar: () =>
      fetchJson<{ userId: string; email: string; name: string; avatarUrl: string | null }>('/me/account/avatar', {
        method: 'DELETE',
      }),
    deleteAccount: (confirm: string) => fetchJson<void>('/me/account', { method: 'DELETE', body: JSON.stringify({ confirm }) }),
    export: () => fetchJson<unknown>('/me/export'),
  },
  devices: {
    list: () => fetchJson<Array<{ id: string; deviceId: string; platform: string; appVersion: string; lastSeen: string; current?: boolean }>>('/me/devices'),
    delete: (deviceId: string) => fetchJson<{ ok: true; current?: boolean }>(`/me/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),
    revokeOthers: () => fetchJson<{ ok: true; revoked: number }>('/me/sessions/revoke-others', { method: 'POST' }),
  },
  ai: {
    chat: (request: AiTurnRequest) => postAiStream('/ai/chat', request),
    vision: (image: string, request: AiTurnRequest) => postAiStream('/ai/vision', { ...request, image }),
    transcribe: async (audio: Blob) => {
      const form = new FormData()
      const extension = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm'
      form.append('audio', audio, `dictation.${extension}`)
      const result = await fetchJson<{ text: string }>('/ai/transcribe', { method: 'POST', body: form })
      return result.text
    },
    extractMemory: (userMessage: string, assistantContent: string, existing: string[]) =>
      fetchJson<{ facts: string[] }>('/ai/memory-extract', {
        method: 'POST',
        body: JSON.stringify({ userMessage, assistantContent, existing }),
      }),
    parseResume: (text: string) =>
      fetchJson<{ parsed: import('@shared/types').ParsedResume; memories: string[] }>('/ai/parse-resume', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
  },
  entitlements: {
    get: () => fetchJson<Entitlement | null>('/entitlements'),
    subscribe: (onUpdate: (entitlement: Entitlement | null) => void, signal: AbortSignal) =>
      subscribeSse<Entitlement | null>('/entitlements/stream', onUpdate, signal),
  },
  usage: {
    get: () => fetchJson<{ usage: unknown }>('/usage'),
    trackSession: () => fetchJson<{ ok: true; interviewCredits?: number }>('/usage/session', { method: 'POST' }),
  },
  billing: {
    checkout: (plan: PaidPlan) => fetchJson<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
    portal: (payload?: { action?: 'manage' | 'cancel' | 'upgrade'; plan?: PaidPlan }) =>
      fetchJson<{ url: string }>('/billing/portal', { method: 'POST', body: JSON.stringify(payload ?? { action: 'manage' }) }),
    subscription: () => fetchJson<Subscription | null>('/billing/subscription'),
    plans: () => fetchJson<{ plans: BillingPlanPrice[] }>('/billing/plans'),
    overview: () => fetchJson<{
      invoices: Array<{
        id: string
        number: string | null
        created: string
        amount: number
        currency: string
        status: string
        hostedUrl: string | null
        pdfUrl: string | null
        periodStart: string
        periodEnd: string
      }>
      paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null
      nextPayment: { amount: number; currency: string; date: string } | null
    }>('/billing/overview'),
  },
  updates: {
    latest: (currentVersion: string, channel: string) =>
      fetchJson<{ channel: string; currentVersion: string; latestVersion: string; updateAvailable: boolean; downloadUrl: string; releaseNotesUrl: string }>(
        `/updates/latest?currentVersion=${encodeURIComponent(currentVersion)}&channel=${encodeURIComponent(channel)}`,
      ),
  },
}

export function setToken(token: string): void {
  localStorage.setItem('tudso.token', token)
}

export function clearToken(): void {
  localStorage.removeItem('tudso.token')
}

export function isAuthenticated(): boolean {
  return Boolean(getToken())
}
