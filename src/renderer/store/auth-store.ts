import { create } from 'zustand'
import { api, clearToken, setToken } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import type { AuthSession, LocalProfile } from '@shared/types'
import type { Entitlement, MemoryEntry, UserProfile } from '@/types/api'
import { toUserProfile } from '@/types/api'
import { MAX_MEMORIES, normalizeMemoryEntries } from '@shared/memory'
import { canHideFromCapture, type PaidPlan } from '@shared/plans'

let entitlementStream: AbortController | null = null

function stopEntitlementStream() {
  entitlementStream?.abort()
  entitlementStream = null
}

function profileLooksEmpty(profile: {
  preferredName?: string
  profession?: string
  role?: string
  industry?: string
  education?: string
  skills?: string[]
  goals?: string[]
  customContext?: string
} | null | undefined) {
  if (!profile) return true
  return (
    !profile.preferredName &&
    !profile.profession &&
    !profile.role &&
    !profile.industry &&
    !profile.education &&
    !profile.customContext &&
    !(profile.skills?.length) &&
    !(profile.goals?.length)
  )
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
  hydrateSignedIn: (session: AuthSession) => Promise<void>
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>
  setOnboardingStep: (step: number) => void
  completeOnboarding: () => Promise<void>
  loadEntitlement: () => Promise<void>
  loadMemories: () => Promise<void>
  saveMemories: (entries: MemoryEntry[]) => Promise<MemoryEntry[]>
  setMemoryEnabled: (enabled: boolean) => Promise<void>
  clearMemories: () => Promise<void>
  checkout: (plan: PaidPlan) => Promise<string>
  openBilling: (action: 'manage' | 'cancel' | 'upgrade', plan?: PaidPlan) => Promise<string>
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
    desktop.auth.onAuthCallback((session) => {
      set({ loginStatus: 'completing', loginError: null })
      void get().completeLogin(session)
    })
    const session = await desktop.auth.getSession()
    if (session?.token) {
      try {
        await get().hydrateSignedIn(session)
      } catch {
        set({ loading: false, session: null, onboardingComplete: false })
      }
    } else {
      set({ loading: false, onboardingComplete: false })
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
      await get().hydrateSignedIn(session)
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
    const userId = get().session?.userId
    if (!userId) return
    try {
      const local = await desktop.profile.get(userId)
      set({ profile: toUserProfile(userId, local.profile), onboardingComplete: local.complete === true })
    } catch {
      // ignore
    }
  },

  hydrateSignedIn: async (session: AuthSession) => {
    setToken(session.token)
    const me = await api.me.get()
    let local = await desktop.profile.get(session.userId)
    if (!local.complete && me.onboardingComplete) {
      local = await desktop.profile.complete(session.userId)
    }
    if (profileLooksEmpty(local.profile)) {
      try {
        const remote = await api.me.getProfile()
        if (!profileLooksEmpty(remote)) {
          local = await desktop.profile.set(session.userId, {
            preferredName: remote.preferredName,
            profession: remote.profession,
            role: remote.role,
            industry: remote.industry,
            education: remote.education,
            skills: remote.skills,
            goals: remote.goals,
            communicationStyle: remote.communicationStyle,
            technicalLevel: remote.technicalLevel,
            formal: remote.formal,
            stepByStep: remote.stepByStep,
            examples: remote.examples,
            explainTerms: remote.explainTerms,
            customContext: remote.customContext,
          })
        }
      } catch {
        // Profile now lives on this device. Ignore old-server misses.
      }
    }
    if (!local.memories?.length) {
      try {
        const remote = await api.context.get()
        if (remote.entries?.length || remote.enabled === false) {
          local = await desktop.profile.setMemory(session.userId, {
            entries: normalizeMemoryEntries(remote.entries),
            enabled: remote.enabled !== false,
          })
        }
      } catch {
        // Memories now live on this device.
      }
    }
    await get().loadEntitlement()
    startEntitlementStream((entitlement) => set({ entitlement }))
    set({
      session,
      profile: toUserProfile(session.userId, local.profile),
      onboardingComplete: local.complete === true,
      memories: normalizeMemoryEntries(local.memories),
      memoryEnabled: local.memoryEnabled !== false,
      memoriesLoaded: true,
      loading: false,
      loginStatus: 'idle',
      loginError: null,
    })
  },

  updateProfile: async (partial) => {
    const userId = get().session?.userId
    if (!userId) throw new Error('Not signed in')
    const local = await desktop.profile.set(userId, partial as Partial<LocalProfile>)
    const profile = toUserProfile(userId, local.profile)
    set({ profile })
  },

  setOnboardingStep: (step) => set({ onboardingStep: step }),

  completeOnboarding: async () => {
    const userId = get().session?.userId
    if (!userId) throw new Error('Not signed in')
    const local = await desktop.profile.complete(userId)
    set({
      profile: toUserProfile(userId, local.profile),
      onboardingComplete: true,
      onboardingStep: 0,
    })
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
    const userId = get().session?.userId
    if (!userId) {
      set({ memories: [], memoryEnabled: true, memoriesLoaded: true })
      return
    }
    try {
      const local = await desktop.profile.get(userId)
      set({
        memories: normalizeMemoryEntries(local.memories),
        memoryEnabled: local.memoryEnabled !== false,
        memoriesLoaded: true,
      })
    } catch {
      set({ memories: [], memoryEnabled: true, memoriesLoaded: true })
    }
  },

  saveMemories: async (entries) => {
    const userId = get().session?.userId
    if (!userId) throw new Error('Not signed in')
    const local = await desktop.profile.setMemory(userId, { entries: normalizeMemoryEntries(entries).slice(0, MAX_MEMORIES) })
    const next = normalizeMemoryEntries(local.memories)
    set({ memories: next, memoryEnabled: local.memoryEnabled !== false, memoriesLoaded: true })
    return next
  },

  setMemoryEnabled: async (enabled) => {
    const userId = get().session?.userId
    if (!userId) throw new Error('Not signed in')
    const local = await desktop.profile.setMemory(userId, { enabled })
    set({
      memories: normalizeMemoryEntries(local.memories),
      memoryEnabled: local.memoryEnabled !== false,
      memoriesLoaded: true,
    })
  },

  clearMemories: async () => {
    const userId = get().session?.userId
    if (!userId) throw new Error('Not signed in')
    const local = await desktop.profile.setMemory(userId, { entries: [] })
    set({ memories: [], memoryEnabled: local.memoryEnabled !== false, memoriesLoaded: true })
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
