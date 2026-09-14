import type { LocalProfile, SessionPromptResume } from '@shared/types'

export type Plan = 'free' | 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly' | 'premium'

export interface UserProfile {
  id: string
  user: string
  preferredName?: string
  profession?: string
  role?: string
  industry?: string
  education?: string
  preferredLanguage?: string
  skills: string[]
  goals: string[]
  communicationStyle?: 'concise' | 'balanced' | 'detailed'
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced'
  formal?: boolean
  stepByStep?: boolean
  examples?: boolean
  explainTerms?: boolean
  customContext?: string
}

export const DEFAULT_PROFILE_PREFERENCES = {
  communicationStyle: 'balanced',
  technicalLevel: 'intermediate',
  formal: false,
  stepByStep: true,
  examples: true,
  explainTerms: true,
} as const

export function toUserProfile(userId: string, profile: {
  preferredName?: string
  profession?: string
  role?: string
  industry?: string
  education?: string
  preferredLanguage?: string
  skills?: string[]
  goals?: string[]
  communicationStyle?: UserProfile['communicationStyle']
  technicalLevel?: UserProfile['technicalLevel']
  formal?: boolean
  stepByStep?: boolean
  examples?: boolean
  explainTerms?: boolean
  customContext?: string
}): UserProfile {
  return {
    id: userId,
    user: userId,
    preferredName: profile.preferredName,
    profession: profile.profession,
    role: profile.role,
    industry: profile.industry,
    education: profile.education,
    preferredLanguage: profile.preferredLanguage,
    skills: profile.skills ?? [],
    goals: profile.goals ?? [],
    communicationStyle: profile.communicationStyle,
    technicalLevel: profile.technicalLevel,
    formal: profile.formal,
    stepByStep: profile.stepByStep,
    examples: profile.examples,
    explainTerms: profile.explainTerms,
    customContext: profile.customContext,
  }
}

type PromptProfileSource = Pick<
  UserProfile,
  | 'preferredName'
  | 'profession'
  | 'role'
  | 'industry'
  | 'education'
  | 'preferredLanguage'
  | 'skills'
  | 'goals'
  | 'communicationStyle'
  | 'technicalLevel'
  | 'formal'
  | 'stepByStep'
  | 'examples'
  | 'explainTerms'
  | 'customContext'
>

export function snapshotLocalProfile(profile?: PromptProfileSource | null): LocalProfile {
  return {
    preferredName: profile?.preferredName,
    profession: profile?.profession,
    role: profile?.role,
    industry: profile?.industry,
    education: profile?.education,
    preferredLanguage: profile?.preferredLanguage,
    skills: [...(profile?.skills ?? [])],
    goals: [...(profile?.goals ?? [])],
    communicationStyle: profile?.communicationStyle ?? DEFAULT_PROFILE_PREFERENCES.communicationStyle,
    technicalLevel: profile?.technicalLevel ?? DEFAULT_PROFILE_PREFERENCES.technicalLevel,
    formal: profile?.formal ?? DEFAULT_PROFILE_PREFERENCES.formal,
    stepByStep: profile?.stepByStep ?? DEFAULT_PROFILE_PREFERENCES.stepByStep,
    examples: profile?.examples ?? DEFAULT_PROFILE_PREFERENCES.examples,
    explainTerms: profile?.explainTerms ?? DEFAULT_PROFILE_PREFERENCES.explainTerms,
    customContext: profile?.customContext,
  }
}

export function toPromptProfile(profile?: PromptProfileSource | null) {
  if (!profile) return undefined
  const snapshot = snapshotLocalProfile(profile)
  return {
    preferredName: snapshot.preferredName,
    profession: snapshot.profession,
    role: snapshot.role,
    industry: snapshot.industry,
    education: snapshot.education,
    preferredLanguage: snapshot.preferredLanguage,
    skills: snapshot.skills,
    goals: snapshot.goals,
    communicationStyle: snapshot.communicationStyle,
    technicalLevel: snapshot.technicalLevel,
    formal: snapshot.formal,
    stepByStep: snapshot.stepByStep,
    examples: snapshot.examples,
    explainTerms: snapshot.explainTerms,
    customContext: snapshot.customContext,
  }
}

export function toPromptResume(resume?: SessionPromptResume | null) {
  if (!resume) return undefined
  const parsed = resume.parsed
  const text = resume.text?.trim()
  const hasParsed =
    Boolean(parsed.name || parsed.headline || parsed.summary) ||
    parsed.skills.length > 0 ||
    parsed.languages.length > 0 ||
    parsed.experience.length > 0 ||
    parsed.education.length > 0 ||
    parsed.projects.length > 0 ||
    parsed.certifications.length > 0 ||
    parsed.achievements.length > 0
  if (!hasParsed && !text) return undefined
  return {
    name: parsed.name,
    headline: parsed.headline,
    summary: parsed.summary,
    skills: parsed.skills,
    languages: parsed.languages,
    experience: parsed.experience,
    education: parsed.education,
    projects: parsed.projects,
    certifications: parsed.certifications,
    achievements: parsed.achievements,
    rawText: text,
  }
}

export function resolveProfilePreferences(profile?: UserProfile | null) {
  const unset =
    !profile ||
    (profile.formal !== true &&
      profile.stepByStep !== true &&
      profile.examples !== true &&
      profile.explainTerms !== true)
  return {
    communicationStyle: profile?.communicationStyle ?? DEFAULT_PROFILE_PREFERENCES.communicationStyle,
    technicalLevel: profile?.technicalLevel ?? DEFAULT_PROFILE_PREFERENCES.technicalLevel,
    formal: unset ? DEFAULT_PROFILE_PREFERENCES.formal : Boolean(profile.formal),
    stepByStep: unset ? DEFAULT_PROFILE_PREFERENCES.stepByStep : Boolean(profile.stepByStep),
    examples: unset ? DEFAULT_PROFILE_PREFERENCES.examples : Boolean(profile.examples),
    explainTerms: unset ? DEFAULT_PROFILE_PREFERENCES.explainTerms : Boolean(profile.explainTerms),
  }
}

export interface Entitlement {
  id: string
  user: string
  plan: Plan
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  freeAccess?: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly' | 'premium'
  interviewCredits?: number
  expiresAt: string
}

export interface Subscription {
  id: string
  user: string
  status: string
  plan?: Plan
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

export interface BillingPlanPrice {
  id: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly'
  priceId: string
  amount: number | null
  currency: string
  interval: string
}

export type { MemoryEntry, MemorySource } from '@shared/types'
export { MAX_MEMORIES, MAX_MEMORY_CHARS } from '@shared/memory'
