import { create } from 'zustand'
import { api, clearToken, setToken } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import type { AuthSession } from '@shared/types'
import type { Entitlement, Plan, UserProfile } from '@/types/api'

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
        await api.entitlements.subscribe(onUpdate, controller.signal)
      } catch {
        if (controller.signal.aborted) return
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }
  void run()
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
  checkout: (plan: Plan) => Promise<string>
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
      await get().loadEntitlement()
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
      await get().loadEntitlement()
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
    set({ session: null, profile: null, entitlement: null, onboardingComplete: false, loginStatus: 'idle', loginError: null })
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
      set({ entitlement })
    } catch {
      // ignore
    }
  },

  checkout: async (plan) => {
    const { url } = await api.billing.checkout(plan)
    await desktop.app.openExternal(url)
    return url
  },
}))
