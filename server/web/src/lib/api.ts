async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(path, { credentials: 'include', ...init, headers })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed')
  }
  return data as T
}

export type Entitlement = {
  plan: 'free' | 'weekly' | 'monthly' | 'yearly' | 'pro' | 'premium'
  status: string
  freeAccess?: 'weekly' | 'monthly' | 'yearly' | 'pro' | 'premium'
  expiresAt?: string
}

export type Subscription = {
  status: string
  plan?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  stripeCustomerId?: string
}

export type Usage = {
  date?: string
  requests: number
  tokens: number
  screenAnalyses: number
  realtimeMinutes: number
  audioMinutes: number
  sessions?: number
}

export type Device = {
  id: string
  deviceId: string
  platform: string
  appVersion: string
  lastSeen: string
  current?: boolean
}

export type DashboardPayload = {
  email: string
  entitlement: Entitlement | null
  subscription: Subscription | null
  usage: Usage
  history: Usage[]
  sessionCount: number
  conversationCount?: number
  deviceCount: number
}

export const api = {
  session: () => request<{ user: { userId: string; email: string } | null }>('/auth/web/session'),
  login: (email: string, password: string) =>
    request<{ userId: string; email: string; needsVerification?: boolean }>('/auth/web/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: { email: string; password: string; passwordConfirm: string; name?: string }) =>
    request<{ userId?: string; email: string; needsVerification?: boolean }>('/auth/web/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  google: () => request<{ url: string }>('/auth/web/oauth', { method: 'POST', body: JSON.stringify({}) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  dashboard: () => request<DashboardPayload>('/me/dashboard'),
  plans: () => request<{ plans: Array<{ id: 'weekly' | 'monthly' | 'yearly'; amount: number | null; currency: string; interval: string }> }>('/billing/plans'),
  checkout: (plan: 'weekly' | 'monthly' | 'yearly') => request<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  portal: (action: 'manage' | 'cancel' | 'upgrade' = 'manage', plan?: 'weekly' | 'monthly' | 'yearly') =>
    request<{ url: string }>('/billing/portal', { method: 'POST', body: JSON.stringify({ action, plan }) }),
  devices: () => request<Device[]>('/me/devices'),
  deleteDevice: (deviceId: string) => request<{ ok: boolean; current?: boolean }>(`/me/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),
  revokeOthers: () => request<{ ok: true; revoked: number }>('/me/sessions/revoke-others', { method: 'POST', body: JSON.stringify({}) }),
  exportData: () => request<unknown>('/me/export'),
  deleteAccount: (confirm: string) => request<{ ok: true }>('/me/account', { method: 'DELETE', body: JSON.stringify({ confirm }) }),
}
