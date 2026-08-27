export type Plan = 'free' | 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly' | 'premium'

export interface UserProfile {
  id: string
  user: string
  preferredName?: string
  profession?: string
  role?: string
  industry?: string
  education?: string
  skills: string[]
  goals: string[]
  communicationStyle?: 'concise' | 'balanced' | 'detailed'
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced'
  formal?: boolean
  stepByStep?: boolean
  examples?: boolean
  explainTerms?: boolean
  customContext?: string
  created: string
  updated: string
}

export const DEFAULT_PROFILE_PREFERENCES = {
  communicationStyle: 'balanced' as const,
  technicalLevel: 'intermediate' as const,
  formal: false,
  stepByStep: true,
  examples: true,
  explainTerms: true,
}

export interface ResumeRecord {
  id: string
  user: string
  file?: string
  filePath?: string
  storage?: 'r2' | 'local'
  extractedText: string
  parsedData: {
    name?: string
    headline?: string
    summary?: string
    rawText?: string
    filePath?: string
    storage?: 'r2' | 'local'
    fileName?: string
    mimeType?: string
    skills: string[]
    experience: Array<{ company?: string; role?: string; duration?: string; description?: string }>
    education: Array<{ institution?: string; degree?: string; year?: string }>
    projects: Array<{ name?: string; description?: string; technologies?: string[] }>
    certifications: string[]
    languages: string[]
    achievements: string[]
  }
  created: string
  updated: string
}

export interface SubscriptionRecord {
  id: string
  user: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  priceId: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  created: string
  updated: string
}

export interface EntitlementRecord {
  id: string
  user: string
  plan: Plan
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  freeAccess?: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly' | 'premium'
  interviewCredits?: number
  expiresAt: string
  created: string
  updated: string
}

export interface UsageRecord {
  id: string
  user: string
  date: string
  requests: number
  tokens: number
  screenAnalyses: number
  realtimeMinutes: number
  audioMinutes: number
  sessions: number
  created: string
  updated: string
}

export interface DeviceRecord {
  id: string
  user: string
  deviceId: string
  platform: string
  appVersion: string
  lastSeen: string
  created: string
  updated: string
}

export interface DesktopSession {
  userId: string
  token: string
  expiresAt: number
  deviceId?: string
}

export interface AuthState {
  state: string
  codeVerifier: string
  createdAt: number
  kind: 'desktop' | 'web'
  oauthKind?: 'desktop' | 'web'
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIRequest {
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  model?: string
}

export interface AIResponse {
  content: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export interface AIStreamHandler {
  onDelta: (delta: string) => void
  onDone: (fullResponse: string) => void
  onError: (error: Error) => void
}

export interface ParsedResume {
  name?: string
  headline?: string
  summary?: string
  rawText?: string
  filePath?: string
  storage?: 'r2' | 'local'
  fileName?: string
  mimeType?: string
  skills: string[]
  experience: Array<{ company?: string; role?: string; duration?: string; description?: string }>
  education: Array<{ institution?: string; degree?: string; year?: string }>
  projects: Array<{ name?: string; description?: string; technologies?: string[] }>
  certifications: string[]
  languages: string[]
  achievements: string[]
  goals?: string[]
  industry?: string
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced'
}
