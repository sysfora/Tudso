import PocketBase from 'pocketbase'
import { config } from './config.js'
import { log } from './log.js'
import { isFreeAccessPlan, isPlan, isUnlimitedPlan, isPaidStatus, sessionLimitForPlan } from './plans.js'
import { pbQuote } from './pb-filter.js'
import {
  type DesktopSession,
  type DeviceRecord,
  type EntitlementRecord,
  type Plan,
  type SubscriptionRecord,
  type UsageRecord,
} from './types.js'

let adminPb: PocketBase | null = null
const creditLocks = new Map<string, Promise<void>>()

export async function getAdminPb(): Promise<PocketBase> {
  if (!adminPb) {
    adminPb = new PocketBase(config.pocketbase.url)
    adminPb.autoCancellation(false)
    // B-3: Use _superusers collection (admins.authWithPassword is deprecated in PocketBase v0.23+)
    await adminPb.collection('_superusers').authWithPassword(config.pocketbase.adminEmail, config.pocketbase.adminPassword)
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
  plan: 'none' as const,
  planStatus: 'unpaid' as const,
  interviewCredits: 0,
}

export interface UserBilling {
  id: string
  plan?: Plan
  planStatus?: EntitlementRecord['status']
  freeAccess?: 'basic' | 'plus' | 'pro' | 'weekly' | 'monthly' | 'yearly' | 'premium'
  interviewCredits?: number
  onboardingComplete?: boolean
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
      freeAccess: isFreeAccessPlan(user.freeAccess) ? user.freeAccess : undefined,
      interviewCredits: typeof user.interviewCredits === 'number' ? user.interviewCredits : undefined,
      onboardingComplete: user.onboardingComplete === true,
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
    interviewCredits?: number
  },
): Promise<void> {
  const pb = await getAdminPb()
  const payload: Record<string, unknown> = {}
  if (data.plan !== undefined) payload.plan = data.plan
  if (data.planStatus !== undefined) payload.planStatus = data.planStatus
  if (data.stripeCustomerId !== undefined) payload.stripeCustomerId = data.stripeCustomerId
  if (data.stripeSubscriptionId !== undefined) payload.stripeSubscriptionId = data.stripeSubscriptionId
  if (data.expiresAt !== undefined) payload.expiresAt = data.expiresAt
  if (data.interviewCredits !== undefined) payload.interviewCredits = data.interviewCredits
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
    if (!user.plan) {
      await syncUserBilling(userId, DEFAULT_USER_BILLING)
      return
    }
    if (typeof user.interviewCredits !== 'number') {
      // B-2: Use sessionLimitForPlan so one-time plans (basic=3, plus=8, pro=15) get correct defaults
      await syncUserBilling(userId, { interviewCredits: sessionLimitForPlan(user.plan) ?? 0 })
    }
  } catch (error) {
    log.warn('Could not ensure user billing fields', { err: pocketbaseDetails(error) })
  }
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

export function unpaidEntitlement(userId: string, extra?: Partial<EntitlementRecord>): EntitlementRecord {
  return {
    id: extra?.id ?? userId,
    user: userId,
    plan: extra?.plan && isPlan(extra.plan) ? extra.plan : 'none',
    status: extra?.status ?? 'unpaid',
    interviewCredits: extra?.interviewCredits ?? 0,
    expiresAt: extra?.expiresAt ?? '',
    created: extra?.created ?? '',
    updated: extra?.updated ?? '',
  }
}

export function entitlementFromBilling(billing: UserBilling | null, fallbackUserId: string): EntitlementRecord {
  if (!billing?.plan || !isPlan(billing.plan)) {
    return unpaidEntitlement(fallbackUserId, {
      id: billing?.id,
      interviewCredits: billing?.interviewCredits,
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
    interviewCredits: billing.interviewCredits,
    expiresAt: billing.expiresAt ?? '',
    created: billing.created ?? '',
    updated: billing.updated ?? '',
  }
}

export function entitlementFromFreeAccess(userId: string, billing: UserBilling): EntitlementRecord {
  const plan = isFreeAccessPlan(billing.freeAccess) ? billing.freeAccess : 'monthly'
  return {
    id: billing.id || userId,
    user: userId,
    plan,
    status: 'active',
    freeAccess: plan,
    interviewCredits: billing.interviewCredits,
    expiresAt: '',
    created: billing.created ?? '',
    updated: billing.updated ?? '',
  }
}

export async function getEntitlementForUser(userId: string): Promise<EntitlementRecord> {
  const billing = await getUserBilling(userId)
  if (billing?.freeAccess) return entitlementFromFreeAccess(userId, billing)
  const { resolveLiveEntitlement } = await import('./stripe.js')
  return resolveLiveEntitlement(userId, billing)
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
  if (billing?.freeAccess) {
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
    return
  }
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
  await syncUserBilling(userId, {
    plan: data.plan,
    planStatus: data.planStatus,
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
      try {
        const record = await pb.collection('usage').create({
          user: userId,
          date: `${day} 00:00:00.000Z`,
          requests: 0,
          tokens: 0,
          screenAnalyses: 0,
          realtimeMinutes: 0,
          audioMinutes: 0,
          sessions: 0,
        })
        return record as unknown as UsageRecord
      } catch {
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
      }
    } catch {
      const record = await pb.collection('usage').getFirstListItem(usageDayFilter(userId, day))
      return record as unknown as UsageRecord
    }
  }
}

export async function incrementUsage(userId: string, increments: Partial<Omit<UsageRecord, 'id' | 'user' | 'date' | 'created' | 'updated'>>): Promise<UsageRecord> {
  const pb = await getAdminPb()
  const usage = await getUsageToday(userId)
  const payload = {
    requests: (usage.requests ?? 0) + (increments.requests ?? 0),
    tokens: (usage.tokens ?? 0) + (increments.tokens ?? 0),
    screenAnalyses: (usage.screenAnalyses ?? 0) + (increments.screenAnalyses ?? 0),
    realtimeMinutes: (usage.realtimeMinutes ?? 0) + (increments.realtimeMinutes ?? 0),
    audioMinutes: (usage.audioMinutes ?? 0) + (increments.audioMinutes ?? 0),
    sessions: (usage.sessions ?? 0) + (increments.sessions ?? 0),
  }
  try {
    const record = await pb.collection('usage').update(usage.id, payload)
    return record as unknown as UsageRecord
  } catch {
    const { sessions: _sessions, ...withoutSessions } = payload
    const record = await pb.collection('usage').update(usage.id, withoutSessions)
    return record as unknown as UsageRecord
  }
}

export async function consumeInterviewCredit(userId: string): Promise<{ ok: true; interviewCredits?: number } | { ok: false; error: string }> {
  const previous = creditLocks.get(userId) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => current)
  creditLocks.set(userId, queued)
  await previous
  try {
    const entitlement = await getEntitlementForUser(userId)
    if (isUnlimitedPlan(entitlement.plan) && isPaidStatus(entitlement.status)) {
      return { ok: true }
    }
    const credits = entitlement.interviewCredits ?? 0
    if (credits <= 0) {
      return { ok: false, error: 'No interview sessions left. Choose a plan to continue.' }
    }
    await syncUserBilling(userId, { interviewCredits: credits - 1 })
    return { ok: true, interviewCredits: credits - 1 }
  } finally {
    release()
    if (creditLocks.get(userId) === queued) creditLocks.delete(userId)
  }
}

export async function getUsageHistory(userId: string, days = 14): Promise<UsageRecord[]> {
  const pb = await getAdminPb()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (days - 1))
  const day = since.toISOString().slice(0, 10)
  const records = await pb.collection('usage').getFullList({
    filter: `user=${pbQuote(userId)} && date >= "${day} 00:00:00.000Z"`,
    sort: 'date',
  })
  return records as unknown as UsageRecord[]
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
  // B-6: Child collections all have cascadeDelete:true on the user relation,
  // so deleting the user record automatically removes all child records.
  try {
    await pb.collection('users').delete(userId)
  } catch {
    // ignore — user may have already been deleted
  }
}
