import { config } from '@/config'
import type { BillingPlanPrice, Entitlement, MemoryEntry, Plan, Subscription, UserProfile } from '@/types/api'

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
    get: () => fetchJson<{ userId: string; email: string; profile: UserProfile; onboardingComplete: boolean }>('/me'),
    getProfile: () => fetchJson<UserProfile>('/me/profile'),
    completeOnboarding: () =>
      fetchJson<{ onboardingComplete: boolean }>('/me/onboarding/complete', { method: 'POST' }),
    updateProfile: (profile: Partial<UserProfile>) =>
      fetchJson<UserProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(profile) }),
    deleteAccount: (confirm: string) => fetchJson<void>('/me/account', { method: 'DELETE', body: JSON.stringify({ confirm }) }),
    export: () => fetchJson<unknown>('/me/export'),
  },
  devices: {
    list: () => fetchJson<Array<{ id: string; deviceId: string; platform: string; appVersion: string; lastSeen: string; current?: boolean }>>('/me/devices'),
    delete: (deviceId: string) => fetchJson<{ ok: true; current?: boolean }>(`/me/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),
    revokeOthers: () => fetchJson<{ ok: true; revoked: number }>('/me/sessions/revoke-others', { method: 'POST' }),
  },
  resume: {
    upload: (file: File) => {
      const form = new FormData()
      form.append('resume', file)
      return fetchJson<{ id: string; parsed: unknown; skills: string[]; filePath: string; storage: 'r2' | 'local'; fileName: string }>('/me/resume', {
        method: 'POST',
        body: form,
      })
    },
    get: () => fetchJson<{ id: string; filePath: string; storage: string; fileName: string; parsedData: unknown; extractedText: string }>('/me/resume'),
    delete: () => fetchJson<void>('/me/resume', { method: 'DELETE' }),
  },
  context: {
    get: () => fetchJson<{ id: string; user: string; entries: MemoryEntry[]; enabled: boolean }>('/me/context'),
    update: (patch: { entries?: MemoryEntry[]; enabled?: boolean }) =>
      fetchJson<{ id: string; user: string; entries: MemoryEntry[]; enabled: boolean }>('/me/context', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    delete: () => fetchJson<{ ok: true; entries: MemoryEntry[]; enabled: boolean }>('/me/context', { method: 'DELETE' }),
  },
  conversations: {
    list: () => fetchJson<Array<{ id: string; title: string; created: string; updated: string }>>('/conversations'),
    create: (title: string) => fetchJson<{ id: string; title: string; created: string; updated: string }>('/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
    getMessages: (id: string) => fetchJson<Array<{ id: string; role: string; content: string; created: string }>>(`/conversations/${id}`),
    delete: (id: string) => fetchJson<void>(`/conversations/${id}`, { method: 'DELETE' }),
  },
  ai: {
    chat: async (message: string, conversationId?: string, signal?: AbortSignal, model?: string) => {
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { ...headers(), Accept: 'text/plain', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ message, conversationId, stream: true, model }),
        signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await response.text())
      return response.body as ReadableStream<Uint8Array> | null
    },
    vision: async (image: string, message: string, conversationId?: string, signal?: AbortSignal, model?: string) => {
      const response = await fetch(`${API_BASE}/ai/vision`, {
        method: 'POST',
        headers: { ...headers(), Accept: 'text/plain', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ image, message, conversationId, model }),
        signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await response.text())
      return response.body as ReadableStream<Uint8Array> | null
    },
    transcribe: async (audio: Blob) => {
      const form = new FormData()
      const extension = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm'
      form.append('audio', audio, `dictation.${extension}`)
      const result = await fetchJson<{ text: string }>('/ai/transcribe', { method: 'POST', body: form })
      return result.text
    },
  },
  entitlements: {
    get: () => fetchJson<Entitlement | null>('/entitlements'),
    subscribe: (onUpdate: (entitlement: Entitlement | null) => void, signal: AbortSignal) =>
      subscribeSse<Entitlement | null>('/entitlements/stream', onUpdate, signal),
  },
  usage: {
    get: () => fetchJson<{ usage: unknown }>('/usage'),
  },
  billing: {
    checkout: (plan: Plan) => fetchJson<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
    portal: (payload?: { action?: 'manage' | 'cancel' | 'upgrade'; plan?: Plan }) =>
      fetchJson<{ url: string }>('/billing/portal', { method: 'POST', body: JSON.stringify(payload ?? { action: 'manage' }) }),
    subscription: () => fetchJson<Subscription | null>('/billing/subscription'),
    plans: () => fetchJson<{ plans: BillingPlanPrice[] }>('/billing/plans'),
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
