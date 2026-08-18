import { create } from 'zustand'
import { api, clearToken, setToken } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import type { AuthSession } from '@shared/types'
import type { Entitlement, MemoryEntry, Plan, UserProfile } from '@/types/api'
import { canHideFromCapture } from '@shared/plans'

let entitlementStream: AbortController | null = null

function stopEntitlementStream() {
  entitlementStream?.abort()
  entitlementStream = null
}

function startEntitlementStream(onUpdate: (entitlement: Entitlement | null) => void) {
  stopEntitlementStream()
  const controller = new AbortController()
  entitlementStream = controller
  const run = async () => {
    while (!controller.signal.aborted) {
      try {
        await api.entitlements.subscribe((entitlement) => {
          syncHideFromCapture(entitlement)
          onUpdate(entitlement)
        }, controller.signal)
      } catch {
        if (controller.signal.aborted) return
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }
  void run()
}

function syncHideFromCapture(entitlement: Entitlement | null) {
  void desktop.window.setHideFromCaptureAllowed(canHideFromCapture(entitlement?.plan, entitlement?.status))
}

interface AuthState {
  session: AuthSession | null
  profile: UserProfile | null
  entitlement: Entitlement | null
  loading: boolean
  loginStatus: 'idle' | 'waiting' | 'completing'
  loginError: string | null
  onboardingStep: number
  onboardingComplete: boolean
  memories: MemoryEntry[]
  memoriesLoaded: boolean
  memoryEnabled: boolean
}

interface AuthActions {
  init: () => Promise<void>
  startLogin: (mode?: 'login' | 'register') => Promise<void>
  cancelLogin: () => void
  completeLogin: (session: AuthSession) => Promise<void>
  logout: () => Promise<void>
  loadProfile: () => Promise<void>
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>
  setOnboardingStep: (step: number) => void
  completeOnboarding: () => Promise<void>
  loadEntitlement: () => Promise<void>
  loadMemories: () => Promise<void>
  saveMemories: (entries: MemoryEntry[]) => Promise<MemoryEntry[]>
  setMemoryEnabled: (enabled: boolean) => Promise<void>
  clearMemories: () => Promise<void>
  checkout: (plan: Plan) => Promise<string>
  openBilling: (action: 'manage' | 'cancel' | 'upgrade', plan?: Plan) => Promise<string>
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  session: null,
  profile: null,
  entitlement: null,
  loading: true,
  loginStatus: 'idle',
  loginError: null,
  onboardingStep: 0,
  onboardingComplete: false,
  memories: [],
  memoriesLoaded: false,
  memoryEnabled: true,

  init: async () => {
    const complete = localStorage.getItem('tudso.onboardingComplete') === 'true'
    desktop.auth.onAuthCallback((session) => {
      set({ loginStatus: 'completing', loginError: null })
      void get().completeLogin(session)
    })
    const session = await desktop.auth.getSession()
    if (session?.token) {
      setToken(session.token)
      set({ session, onboardingComplete: complete, loading: false, loginStatus: 'idle' })
      await get().loadProfile()
      await Promise.all([get().loadEntitlement(), get().loadMemories()])
      startEntitlementStream((entitlement) => set({ entitlement }))
    } else {
      set({ loading: false, onboardingComplete: complete })
    }
  },

  startLogin: async (mode = 'login') => {
    set({ loginStatus: 'waiting', loginError: null })
    try {
      const { url } = await desktop.auth.startLogin()
      const next = new URL(url)
      if (mode === 'register') next.searchParams.set('mode', 'register')
      await desktop.auth.openLogin(next.toString())
    } catch (error) {
      set({
        loginStatus: 'idle',
        loginError: (error as Error).message || 'Could not open the sign-in page.',
      })
    }
  },

  cancelLogin: () => set({ loginStatus: 'idle', loginError: null }),

  completeLogin: async (session) => {
    if (!session?.token) {
      set({ loginStatus: 'idle', loginError: 'Sign-in did not finish. Please try again.' })
      return
    }
    set({ loginStatus: 'completing', loginError: null })
    try {
      await desktop.auth.setSession(session)
      setToken(session.token)
      await get().loadProfile()
      await Promise.all([get().loadEntitlement(), get().loadMemories()])
      startEntitlementStream((entitlement) => set({ entitlement }))
      set({ session, loading: false, loginStatus: 'idle' })
    } catch (error) {
      set({
        loginStatus: 'idle',
        loginError: (error as Error).message || 'Could not finish signing in.',
      })
    }
  },

  logout: async () => {
    stopEntitlementStream()
    await api.auth.logout().catch(() => undefined)
    await desktop.auth.clearSession()
    clearToken()
    void desktop.window.setHideFromCaptureAllowed(false)
    set({ session: null, profile: null, entitlement: null, memories: [], memoriesLoaded: false, memoryEnabled: true, onboardingComplete: false, loginStatus: 'idle', loginError: null })
  },

  loadProfile: async () => {
    try {
      const profile = await api.me.getProfile()
      set({ profile })
    } catch {
      // ignore
    }
  },

  updateProfile: async (partial) => {
    const profile = await api.me.updateProfile(partial)
    set({ profile })
  },

  setOnboardingStep: (step) => set({ onboardingStep: step }),

  completeOnboarding: async () => {
    localStorage.setItem('tudso.onboardingComplete', 'true')
    set({ onboardingComplete: true, onboardingStep: 0 })
  },

  loadEntitlement: async () => {
    try {
      const entitlement = await api.entitlements.get()
      syncHideFromCapture(entitlement)
      set({ entitlement })
    } catch {
      syncHideFromCapture(null)
    }
  },

  loadMemories: async () => {
    try {
      const context = await api.context.get()
      set({
        memories: context.entries ?? [],
        memoryEnabled: context.enabled !== false,
        memoriesLoaded: true,
      })
    } catch {
      set({ memories: [], memoryEnabled: true, memoriesLoaded: true })
    }
  },

  saveMemories: async (entries) => {
    const context = await api.context.update({ entries })
    const next = context.entries ?? []
    set({ memories: next, memoryEnabled: context.enabled !== false, memoriesLoaded: true })
    return next
  },

  setMemoryEnabled: async (enabled) => {
    const context = await api.context.update({ enabled })
    set({
      memories: context.entries ?? get().memories,
      memoryEnabled: context.enabled !== false,
      memoriesLoaded: true,
    })
  },

  clearMemories: async () => {
    const context = await api.context.delete()
    set({ memories: [], memoryEnabled: context.enabled !== false, memoriesLoaded: true })
  },

  checkout: async (plan) => {
    const { url } = await api.billing.checkout(plan)
    await desktop.app.openExternal(url)
    return url
  },

  openBilling: async (action, plan) => {
    const { url } = await api.billing.portal({ action, plan })
    await desktop.app.openExternal(url)
    return url
  },
}))
