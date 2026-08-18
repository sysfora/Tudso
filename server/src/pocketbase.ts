import PocketBase from 'pocketbase'
import { config } from './config.js'
import { log, logError } from './log.js'
import { isPlan } from './plans.js'
import { pbQuote } from './pb-filter.js'
import { deleteStoredObject, type StorageBackend } from './storage.js'
import { parseUserContext, serializeUserContext, type MemoryEntry } from './memory.js'
import {
  DEFAULT_PROFILE_PREFERENCES,
  type DesktopSession,
  type DeviceRecord,
  type EntitlementRecord,
  type Plan,
  type ResumeRecord,
  type SubscriptionRecord,
  type UsageRecord,
  type UserProfile,
} from './types.js'

let adminPb: PocketBase | null = null

export async function getAdminPb(): Promise<PocketBase> {
  if (!adminPb) {
    adminPb = new PocketBase(config.pocketbase.url)
    adminPb.autoCancellation(false)
    await adminPb.admins.authWithPassword(config.pocketbase.adminEmail, config.pocketbase.adminPassword)
  }
  return adminPb
}

export function createUserPb(token?: string): PocketBase {
  const pb = new PocketBase(config.pocketbase.url)
  if (token) pb.authStore.save(token, null)
  return pb
}

export async function getUserFromToken(token: string): Promise<{ id: string; email: string } | null> {
  try {
    const pb = createUserPb()
    pb.authStore.save(token, null)
    const result = await pb.collection('users').authRefresh()
    return { id: result.record.id, email: result.record.email }
  } catch {
    return null
  }
}

export async function getUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('users').getFirstListItem(`email="${email}"`)
    return { id: record.id, email: record.email }
  } catch {
    return null
  }
}

export const DEFAULT_USER_BILLING = {
  plan: 'free' as const,
  planStatus: 'unpaid' as const,
  onboardingComplete: false,
}

export interface UserBilling {
  id: string
  plan?: Plan
  planStatus?: EntitlementRecord['status']
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  expiresAt?: string
  created?: string
  updated?: string
}

export async function getUserBilling(userId: string): Promise<UserBilling | null> {
  const pb = await getAdminPb()
  try {
    const user = await pb.collection('users').getOne(userId)
    return {
      id: user.id,
      plan: isPlan(user.plan) ? user.plan : undefined,
      planStatus: typeof user.planStatus === 'string' ? user.planStatus as EntitlementRecord['status'] : undefined,
      stripeCustomerId: typeof user.stripeCustomerId === 'string' ? user.stripeCustomerId : undefined,
      stripeSubscriptionId: typeof user.stripeSubscriptionId === 'string' ? user.stripeSubscriptionId : undefined,
      expiresAt: typeof user.expiresAt === 'string' ? user.expiresAt : undefined,
      created: typeof user.created === 'string' ? user.created : undefined,
      updated: typeof user.updated === 'string' ? user.updated : undefined,
    }
  } catch {
    return null
  }
}

export async function syncUserBilling(
  userId: string,
  data: {
    plan?: Plan
    planStatus?: EntitlementRecord['status']
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    expiresAt?: string
    onboardingComplete?: boolean
  },
): Promise<void> {
  const pb = await getAdminPb()
  const payload: Record<string, unknown> = {}
  if (data.plan !== undefined) payload.plan = data.plan
  if (data.planStatus !== undefined) payload.planStatus = data.planStatus
  if (data.stripeCustomerId !== undefined) payload.stripeCustomerId = data.stripeCustomerId
  if (data.stripeSubscriptionId !== undefined) payload.stripeSubscriptionId = data.stripeSubscriptionId
  if (data.expiresAt !== undefined) payload.expiresAt = data.expiresAt
  if (data.onboardingComplete !== undefined) payload.onboardingComplete = data.onboardingComplete
  if (!Object.keys(payload).length) return
  try {
    await pb.collection('users').update(userId, payload)
    emitEntitlement(userId)
  } catch (error) {
    log.warn('Could not sync billing fields on users', { err: pocketbaseDetails(error) })
  }
}

export async function ensureUserBilling(userId: string): Promise<void> {
  const pb = await getAdminPb()
  try {
    const user = await pb.collection('users').getOne(userId)
    if (user.plan) return
    await syncUserBilling(userId, DEFAULT_USER_BILLING)
  } catch (error) {
    log.warn('Could not ensure user billing fields', { err: pocketbaseDetails(error) })
  }
}

export async function getOrCreateProfile(userId: string): Promise<UserProfile> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('profiles').getFirstListItem(`user="${userId}"`)
    return await applyProfileDefaults(record as unknown as UserProfile)
  } catch {
    const record = await pb.collection('profiles').create({
      user: userId,
      skills: [],
      goals: [],
      ...DEFAULT_PROFILE_PREFERENCES,
    })
    return record as unknown as UserProfile
  }
}

function answerPrefsLookUnset(profile: UserProfile) {
  return profile.formal !== true && profile.stepByStep !== true && profile.examples !== true && profile.explainTerms !== true
}

async function applyProfileDefaults(profile: UserProfile): Promise<UserProfile> {
  const patch: Partial<UserProfile> = {}
  if (!profile.communicationStyle) patch.communicationStyle = DEFAULT_PROFILE_PREFERENCES.communicationStyle
  if (!profile.technicalLevel) patch.technicalLevel = DEFAULT_PROFILE_PREFERENCES.technicalLevel
  if (answerPrefsLookUnset(profile)) {
    patch.stepByStep = DEFAULT_PROFILE_PREFERENCES.stepByStep
    patch.examples = DEFAULT_PROFILE_PREFERENCES.examples
    patch.explainTerms = DEFAULT_PROFILE_PREFERENCES.explainTerms
    patch.formal = DEFAULT_PROFILE_PREFERENCES.formal
  }
  if (!Object.keys(patch).length) return profile
  const pb = await getAdminPb()
  const record = await pb.collection('profiles').update(profile.id, patch)
  return record as unknown as UserProfile
}

export async function updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
  const pb = await getAdminPb()
  const profile = await getOrCreateProfile(userId)
  const record = await pb.collection('profiles').update(profile.id, data)
  return record as unknown as UserProfile
}

export async function getResume(userId: string): Promise<ResumeRecord | null> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('resumes').getFirstListItem(`user="${userId}"`)
    return record as unknown as ResumeRecord
  } catch {
    return null
  }
}

export function resumeStorageRef(record: ResumeRecord | null | undefined): { backend?: StorageBackend; key?: string } {
  if (!record) return {}
  return {
    backend: record.storage ?? record.parsedData?.storage,
    key: record.filePath ?? record.parsedData?.filePath,
  }
}

export async function upsertResume(
  userId: string,
  input: {
    extractedText: string
    parsedData: ResumeRecord['parsedData']
    filePath: string
    storage: StorageBackend
    fileName: string
    mimeType: string
  },
): Promise<ResumeRecord> {
  const pb = await getAdminPb()
  const extractedText = sanitizeResumeText(input.extractedText)
  const parsedData = {
    ...input.parsedData,
    rawText: extractedText,
    filePath: input.filePath,
    storage: input.storage,
    fileName: input.fileName,
    mimeType: input.mimeType,
  }
  const payload: Record<string, unknown> = {
    user: userId,
    extractedText: extractedText.slice(0, 4000),
    parsedData,
    filePath: input.filePath,
    storage: input.storage,
  }

  try {
    return await saveResumeRecord(pb, userId, payload)
  } catch (error) {
    const details = pocketbaseDetails(error)
    if (details.includes('extractedText')) {
      payload.extractedText = ''
    }
    if (details.includes('filePath') || details.includes('storage')) {
      delete payload.filePath
      delete payload.storage
    }
    if (details.includes('extractedText') || details.includes('filePath') || details.includes('storage')) {
      return saveResumeRecord(pb, userId, payload)
    }
    throw new Error(details)
  }
}

async function saveResumeRecord(
  pb: PocketBase,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ResumeRecord> {
  const existing = await getResume(userId)
  if (existing) {
    const record = await pb.collection('resumes').update(existing.id, payload)
    return record as unknown as ResumeRecord
  }
  const record = await pb.collection('resumes').create(payload)
  return record as unknown as ResumeRecord
}

function sanitizeResumeText(text: string): string {
  return text
    .replaceAll('\0', '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[^\S\n\t]+/g, ' ')
    .trim()
    .slice(0, 200_000)
}

function pocketbaseDetails(error: unknown): string {
  const err = error as { response?: { data?: Record<string, { message?: string }>; message?: string }; message?: string }
  const fields = err.response?.data
  if (fields && typeof fields === 'object') {
    const parts = Object.entries(fields).map(([key, value]) => {
      if (value && typeof value === 'object' && 'message' in value) return `${key}: ${value.message}`
      return `${key}: ${JSON.stringify(value)}`
    })
    if (parts.length) return parts.join('; ')
  }
  return err.response?.message ?? err.message ?? 'PocketBase request failed'
}

export async function deleteResume(userId: string): Promise<void> {
  const pb = await getAdminPb()
  const existing = await getResume(userId)
  if (!existing) return
  await deleteStoredObject(resumeStorageRef(existing)).catch((error) => {
    logError('Failed to delete stored resume file', error)
  })
  await pb.collection('resumes').delete(existing.id)
}

export async function getSubscription(userId: string): Promise<SubscriptionRecord | null> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('subscriptions').getFirstListItem(`user="${userId}"`)
    return record as unknown as SubscriptionRecord
  } catch {
    return null
  }
}

export async function upsertSubscription(userId: string, data: Partial<SubscriptionRecord>): Promise<SubscriptionRecord> {
  const pb = await getAdminPb()
  const existing = await getSubscription(userId)
  const record = existing
    ? await pb.collection('subscriptions').update(existing.id, data)
    : await pb.collection('subscriptions').create({ user: userId, ...data })
  await syncUserBilling(userId, {
    stripeCustomerId: data.stripeCustomerId ?? (record as unknown as SubscriptionRecord).stripeCustomerId,
    stripeSubscriptionId: data.stripeSubscriptionId ?? (record as unknown as SubscriptionRecord).stripeSubscriptionId,
  })
  return record as unknown as SubscriptionRecord
}

export async function getEntitlement(userId: string): Promise<EntitlementRecord | null> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('entitlements').getFirstListItem(`user="${userId}"`)
    return record as unknown as EntitlementRecord
  } catch {
    return null
  }
}

export function unpaidEntitlement(userId: string, extra?: Partial<EntitlementRecord>): EntitlementRecord {
  return {
    id: extra?.id ?? userId,
    user: userId,
    plan: extra?.plan && isPlan(extra.plan) ? extra.plan : 'free',
    status: extra?.status ?? 'unpaid',
    expiresAt: extra?.expiresAt ?? '',
    created: extra?.created ?? '',
    updated: extra?.updated ?? '',
  }
}

export function entitlementFromBilling(billing: UserBilling | null, fallbackUserId: string): EntitlementRecord {
  if (!billing?.plan || !isPlan(billing.plan)) {
    return unpaidEntitlement(fallbackUserId, {
      id: billing?.id,
      expiresAt: billing?.expiresAt,
      created: billing?.created,
      updated: billing?.updated,
    })
  }
  return {
    id: billing.id || fallbackUserId,
    user: fallbackUserId,
    plan: billing.plan,
    status: billing.planStatus ?? 'unpaid',
    expiresAt: billing.expiresAt ?? '',
    created: billing.created ?? '',
    updated: billing.updated ?? '',
  }
}

export async function getEntitlementForUser(userId: string): Promise<EntitlementRecord> {
  const { resolveLiveEntitlement } = await import('./stripe.js')
  return resolveLiveEntitlement(userId)
}

export async function persistLiveBilling(
  userId: string,
  data: {
    plan: Plan
    planStatus: EntitlementRecord['status']
    stripeCustomerId: string
    stripeSubscriptionId: string
    priceId: string
    status: SubscriptionRecord['status']
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
  },
): Promise<void> {
  const [subscription, billing] = await Promise.all([getSubscription(userId), getUserBilling(userId)])
  const sameSubscription = Boolean(
    subscription
    && subscription.stripeCustomerId === data.stripeCustomerId
    && subscription.stripeSubscriptionId === data.stripeSubscriptionId
    && subscription.priceId === data.priceId
    && subscription.status === data.status
    && subscription.cancelAtPeriodEnd === data.cancelAtPeriodEnd,
  )
  const sameUser = Boolean(
    billing?.plan === data.plan
    && billing?.planStatus === data.planStatus
    && (billing.stripeCustomerId || '') === data.stripeCustomerId
    && (billing.stripeSubscriptionId || '') === data.stripeSubscriptionId,
  )
  if (sameSubscription && sameUser) return
  if (!sameSubscription) {
    await upsertSubscription(userId, {
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      priceId: data.priceId,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    })
  }
  await upsertEntitlement(userId, {
    plan: data.plan,
    status: data.planStatus,
    expiresAt: data.currentPeriodEnd,
  })
}

const entitlementWatchers = new Map<string, Set<(value: EntitlementRecord | null) => void>>()
let entitlementRealtimeReady: Promise<void> | null = null

function emitEntitlement(userId: string): void {
  if (!entitlementWatchers.has(userId)) return
  void getEntitlementForUser(userId).then((value) => {
    for (const listener of entitlementWatchers.get(userId) ?? []) listener(value)
  })
}

async function ensureEntitlementRealtime(): Promise<void> {
  if (entitlementRealtimeReady) return entitlementRealtimeReady
  entitlementRealtimeReady = (async () => {
    const pb = await getAdminPb()
    await pb.collection('users').subscribe('*', (event) => {
      const userId = event.record?.id
      if (typeof userId === 'string') emitEntitlement(userId)
    })
    await pb.collection('entitlements').subscribe('*', (event) => {
      const related = event.record?.user
      const userId = typeof related === 'string' ? related : related && typeof related === 'object' && 'id' in related ? String((related as { id: string }).id) : undefined
      if (typeof userId === 'string') emitEntitlement(userId)
    })
  })().catch((error) => {
    entitlementRealtimeReady = null
    throw error
  })
  return entitlementRealtimeReady
}

export async function watchEntitlement(
  userId: string,
  listener: (value: EntitlementRecord | null) => void,
): Promise<() => void> {
  await ensureEntitlementRealtime().catch((error) => {
    log.warn('PocketBase realtime for entitlements is unavailable', { err: String(error) })
  })
  let listeners = entitlementWatchers.get(userId)
  if (!listeners) {
    listeners = new Set()
    entitlementWatchers.set(userId, listeners)
  }
  listeners.add(listener)
  void getEntitlementForUser(userId).then(listener)
  return () => {
    listeners?.delete(listener)
    if (listeners && listeners.size === 0) entitlementWatchers.delete(userId)
  }
}

export async function upsertEntitlement(userId: string, data: Partial<EntitlementRecord>): Promise<EntitlementRecord> {
  const pb = await getAdminPb()
  const existing = await getEntitlement(userId)
  const payload: Record<string, unknown> = {}
  if (data.plan !== undefined) payload.plan = data.plan
  if (data.status !== undefined) payload.status = data.status
  if (data.expiresAt !== undefined) payload.expiresAt = data.expiresAt
  const record = existing
    ? await pb.collection('entitlements').update(existing.id, payload)
    : await pb.collection('entitlements').create({ user: userId, ...payload })
  await syncUserBilling(userId, {
    plan: data.plan ?? (record as unknown as EntitlementRecord).plan,
    planStatus: data.status ?? (record as unknown as EntitlementRecord).status,
    expiresAt: data.expiresAt ?? (record as unknown as EntitlementRecord).expiresAt,
  })
  return record as unknown as EntitlementRecord
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function usageDayFilter(userId: string, day: string): string {
  return `user="${userId}" && date >= "${day} 00:00:00.000Z" && date <= "${day} 23:59:59.999Z"`
}

export async function getUsageToday(userId: string): Promise<UsageRecord> {
  const pb = await getAdminPb()
  const day = utcDay()
  try {
    const record = await pb.collection('usage').getFirstListItem(usageDayFilter(userId, day))
    return record as unknown as UsageRecord
  } catch {
    try {
      const record = await pb.collection('usage').create({
        user: userId,
        date: `${day} 00:00:00.000Z`,
        requests: 0,
        tokens: 0,
        screenAnalyses: 0,
        realtimeMinutes: 0,
        audioMinutes: 0,
      })
      return record as unknown as UsageRecord
    } catch {
      const record = await pb.collection('usage').getFirstListItem(usageDayFilter(userId, day))
      return record as unknown as UsageRecord
    }
  }
}

export async function incrementUsage(userId: string, increments: Partial<Omit<UsageRecord, 'id' | 'user' | 'date' | 'created' | 'updated'>>): Promise<UsageRecord> {
  const pb = await getAdminPb()
  const usage = await getUsageToday(userId)
  const record = await pb.collection('usage').update(usage.id, {
    requests: (usage.requests ?? 0) + (increments.requests ?? 0),
    tokens: (usage.tokens ?? 0) + (increments.tokens ?? 0),
    screenAnalyses: (usage.screenAnalyses ?? 0) + (increments.screenAnalyses ?? 0),
    realtimeMinutes: (usage.realtimeMinutes ?? 0) + (increments.realtimeMinutes ?? 0),
    audioMinutes: (usage.audioMinutes ?? 0) + (increments.audioMinutes ?? 0),
  })
  return record as unknown as UsageRecord
}

export async function upsertDevice(userId: string, device: Omit<DeviceRecord, 'id' | 'user' | 'created' | 'updated'>): Promise<DeviceRecord> {
  const pb = await getAdminPb()
  try {
    const existing = await pb.collection('devices').getFirstListItem(`user=${pbQuote(userId)} && deviceId=${pbQuote(device.deviceId)}`)
    const record = await pb.collection('devices').update(existing.id, { ...device, lastSeen: new Date().toISOString() })
    return record as unknown as DeviceRecord
  } catch {
    const record = await pb.collection('devices').create({
      user: userId,
      ...device,
      lastSeen: new Date().toISOString(),
    })
    return record as unknown as DeviceRecord
  }
}

export async function getDevices(userId: string): Promise<DeviceRecord[]> {
  const pb = await getAdminPb()
  const records = await pb.collection('devices').getFullList({ filter: `user=${pbQuote(userId)}`, sort: '-lastSeen' })
  return records as unknown as DeviceRecord[]
}

export async function deleteDevice(userId: string, deviceId: string): Promise<void> {
  const pb = await getAdminPb()
  try {
    const existing = await pb.collection('devices').getFirstListItem(`user=${pbQuote(userId)} && deviceId=${pbQuote(deviceId)}`)
    await pb.collection('devices').delete(existing.id)
  } catch {
    // ignore
  }
  await deleteDesktopSessionsForDevice(userId, deviceId)
}

export async function createConversation(userId: string, title: string): Promise<{ id: string; title: string; created: string; updated: string }> {
  const pb = await getAdminPb()
  const record = await pb.collection('conversations').create({
    user: userId,
    title,
  })
  return record as unknown as { id: string; title: string; created: string; updated: string }
}

export async function getContext(userId: string): Promise<{ id: string; user: string; entries: MemoryEntry[]; enabled: boolean } | null> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('user_context').getFirstListItem(`user="${userId}"`)
    const parsed = parseUserContext(record.entries)
    return {
      id: record.id,
      user: String(record.user),
      entries: parsed.entries,
      enabled: parsed.enabled,
    }
  } catch {
    return null
  }
}

export async function updateContext(
  userId: string,
  patch: { entries?: MemoryEntry[]; enabled?: boolean },
): Promise<{ id: string; user: string; entries: MemoryEntry[]; enabled: boolean }> {
  const pb = await getAdminPb()
  const existing = await getContext(userId)
  const entries = patch.entries ?? existing?.entries ?? []
  const enabled = patch.enabled ?? existing?.enabled ?? true
  const payload = serializeUserContext(entries, enabled)
  if (existing) {
    const record = await pb.collection('user_context').update(existing.id, { entries: payload })
    const parsed = parseUserContext(record.entries)
    return {
      id: record.id,
      user: String(record.user),
      entries: parsed.entries,
      enabled: parsed.enabled,
    }
  }
  const record = await pb.collection('user_context').create({ user: userId, entries: payload })
  const parsed = parseUserContext(record.entries)
  return {
    id: record.id,
    user: String(record.user),
    entries: parsed.entries,
    enabled: parsed.enabled,
  }
}

export async function deleteContext(userId: string): Promise<void> {
  const pb = await getAdminPb()
  const existing = await getContext(userId)
  if (existing) {
    await pb.collection('user_context').delete(existing.id)
  }
}

export async function getConversations(userId: string): Promise<Array<{ id: string; title: string; created: string; updated: string }>> {
  const pb = await getAdminPb()
  const records = await pb.collection('conversations').getFullList({ filter: `user="${userId}"`, sort: '-updated' })
  return records as unknown as Array<{ id: string; title: string; created: string; updated: string }>
}

export async function getMessages(userId: string, conversationId: string): Promise<Array<{ id: string; role: string; content: string; created: string; metadata?: unknown }>> {
  const pb = await getAdminPb()
  const records = await pb.collection('messages').getFullList({ filter: `conversation="${conversationId}" && user="${userId}"`, sort: 'created' })
  return records as unknown as Array<{ id: string; role: string; content: string; created: string; metadata?: unknown }>
}

const MESSAGE_CONTENT_LIMITS = [100_000, 5_000, 255]

function sanitizeMessageContent(content: string, max: number): string {
  const text = String(content ?? '').replace(/\u0000/g, '').trim() || '(empty)'
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1))}…`
}

function pocketbaseFieldError(error: unknown, field: string): { code?: string; message?: string } | undefined {
  const err = error as { data?: { data?: Record<string, { code?: string; message?: string }> } & Record<string, { code?: string; message?: string }>; response?: { data?: Record<string, { code?: string; message?: string }> } }
  const fields = err.data?.data ?? err.response?.data ?? err.data
  return fields?.[field]
}

export async function createMessage(userId: string, conversationId: string, role: string, content: string, metadata?: unknown): Promise<{ id: string; role: string; content: string; created: string }> {
  const pb = await getAdminPb()
  let lastError: unknown
  for (const max of MESSAGE_CONTENT_LIMITS) {
    try {
      const record = await pb.collection('messages').create({
        user: userId,
        conversation: conversationId,
        role,
        content: sanitizeMessageContent(content, max),
        metadata: metadata ?? {},
      })
      await pb.collection('conversations').update(conversationId, { updated: new Date().toISOString() }).catch(() => undefined)
      return record as unknown as { id: string; role: string; content: string; created: string }
    } catch (error) {
      lastError = error
      const field = pocketbaseFieldError(error, 'content')
      const tooLong = field?.code === 'validation_max_text_length'
        || field?.code === 'validation_length_too_long'
        || /too (long|large)|maximum|max/i.test(`${field?.code ?? ''} ${field?.message ?? ''}`)
      if (!tooLong) break
    }
  }
  throw lastError
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const pb = await getAdminPb()
  await pb.collection('conversations').delete(conversationId)
  const messages = await pb.collection('messages').getFullList({ filter: `conversation="${conversationId}" && user="${userId}"` })
  await Promise.all(messages.map((m) => pb.collection('messages').delete(m.id)))
}

export async function storeDesktopSession(session: DesktopSession): Promise<void> {
  const pb = await getAdminPb()
  const payload = {
    user: session.userId,
    token: session.token,
    expiresAt: new Date(session.expiresAt).toISOString(),
  }
  try {
    await pb.collection('desktop_sessions').create({
      ...payload,
      ...(session.deviceId ? { deviceId: session.deviceId } : {}),
    })
  } catch {
    await pb.collection('desktop_sessions').create(payload)
  }
}

export async function getDesktopSession(token: string): Promise<{ userId: string; expiresAt: string; deviceId?: string } | null> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('desktop_sessions').getFirstListItem(`token=${pbQuote(token)}`)
    if (new Date(record.expiresAt as string) < new Date()) return null
    return {
      userId: record.user as string,
      expiresAt: record.expiresAt as string,
      deviceId: typeof record.deviceId === 'string' && record.deviceId ? record.deviceId : undefined,
    }
  } catch {
    return null
  }
}

export async function deleteDesktopSession(token: string): Promise<void> {
  const pb = await getAdminPb()
  try {
    const record = await pb.collection('desktop_sessions').getFirstListItem(`token=${pbQuote(token)}`)
    await pb.collection('desktop_sessions').delete(record.id)
  } catch {
    // ignore
  }
}

export async function deleteDesktopSessionsForDevice(userId: string, deviceId: string): Promise<void> {
  const pb = await getAdminPb()
  try {
    const records = await pb.collection('desktop_sessions').getFullList({
      filter: `user=${pbQuote(userId)} && deviceId=${pbQuote(deviceId)}`,
      batch: 200,
    })
    await Promise.all(records.map((record) => pb.collection('desktop_sessions').delete(record.id)))
  } catch {
    // field may not exist until the collection is updated
  }
}

export async function deleteOtherDesktopSessions(userId: string, keepToken: string): Promise<number> {
  const pb = await getAdminPb()
  const records = await pb.collection('desktop_sessions').getFullList({
    filter: `user=${pbQuote(userId)}`,
    batch: 200,
  })
  const others = records.filter((record) => record.token !== keepToken)
  await Promise.all(others.map((record) => pb.collection('desktop_sessions').delete(record.id)))
  return others.length
}

export async function deleteUserData(userId: string): Promise<void> {
  const pb = await getAdminPb()
  await deleteResume(userId).catch(() => undefined)
  const collections = ['profiles', 'conversations', 'messages', 'subscriptions', 'entitlements', 'usage', 'devices', 'desktop_sessions', 'preferences', 'shortcut_preferences', 'privacy_preferences', 'user_context', 'onboarding']
  for (const collection of collections) {
    try {
      const records = await pb.collection(collection).getFullList({ filter: `user="${userId}"`, batch: 500 })
      await Promise.all(records.map((r) => pb.collection(collection).delete(r.id)))
    } catch {
      // collection may not exist or other error
    }
  }
  try {
    await pb.collection('users').delete(userId)
  } catch {
    // ignore
  }
}
