async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
  if (init?.body && !isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(path, { credentials: 'include', ...init, headers })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed')
  }
  return data as T
}

export type Entitlement = {
  plan: 'none' | 'free' | 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly' | 'premium'
  status: string
  freeAccess?: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly' | 'premium'
  interviewCredits?: number
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

export type Account = {
  userId: string
  email: string
  name: string
  avatarUrl: string | null
}

export type AuthPlan = Entitlement['plan']

export type BillingInvoice = {
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
}

export type BillingPaymentMethod = {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export type BillingOverview = {
  invoices: BillingInvoice[]
  paymentMethod: BillingPaymentMethod | null
  nextPayment: { amount: number; currency: string; date: string } | null
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
  session: () => request<{ user: Account | null; plan?: AuthPlan }>('/auth/web/session'),
  login: (email: string, password: string) =>
    request<{ userId: string; email: string; plan?: AuthPlan; needsVerification?: boolean }>('/auth/web/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: { email: string; password: string; passwordConfirm: string; name?: string }) =>
    request<{ userId?: string; email: string; plan?: AuthPlan; needsVerification?: boolean }>('/auth/web/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  google: (state?: string) =>
    request<{ url: string }>('/auth/web/oauth', { method: 'POST', body: JSON.stringify(state ? { state } : {}) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  dashboard: () => request<DashboardPayload>('/me/dashboard'),
  account: () => request<Account>('/me/account'),
  updateName: (name: string) => request<Account>('/me/account', { method: 'PATCH', body: JSON.stringify({ name }) }),
  changePassword: (currentPassword: string, password: string, passwordConfirm: string) =>
    request<{ ok: true }>('/me/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, password, passwordConfirm }),
    }),
  uploadAvatar: (file: File) => {
    const body = new FormData()
    body.append('avatar', file)
    return request<Account>('/me/account/avatar', { method: 'POST', body })
  },
  removeAvatar: () => request<Account>('/me/account/avatar', { method: 'DELETE' }),
  plans: () => request<{ plans: Array<{ id: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly'; amount: number | null; currency: string; interval: string }> }>('/billing/plans'),
  billingOverview: () => request<BillingOverview>('/billing/overview'),
  activateFreePlan: () => request<{ plan: 'free'; interviewCredits: number }>('/billing/free', { method: 'POST', body: JSON.stringify({}) }),
  checkout: (plan: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly') => request<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  portal: (action: 'manage' | 'cancel' | 'upgrade' = 'manage', plan?: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly') =>
    request<{ url: string }>('/billing/portal', { method: 'POST', body: JSON.stringify({ action, plan }) }),
  devices: () => request<Device[]>('/me/devices'),
  deleteDevice: (deviceId: string) => request<{ ok: boolean; current?: boolean }>(`/me/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),
  revokeOthers: () => request<{ ok: true; revoked: number }>('/me/sessions/revoke-others', { method: 'POST', body: JSON.stringify({}) }),
  exportData: () => request<unknown>('/me/export'),
  deleteAccount: (confirm: string) => request<{ ok: true }>('/me/account', { method: 'DELETE', body: JSON.stringify({ confirm }) }),
}
