import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import { transcription } from './ai.js'
import { resolveAccessToken } from './auth.js'
import { log, logError } from './log.js'
import { getOrCreateProfile, incrementUsage, getEntitlementForUser } from './pocketbase.js'
import { isPaidPlan } from './plans.js'
import { isActionableTranscript } from './transcript.js'
import type { UserProfile } from './types.js'

interface RealtimeSession {
  userId: string
  chunks: Buffer[]
  lastTranscript: string
  totalAudioSeconds: number
  transcribing: boolean
  closed: boolean
}

const sessions = new Map<WebSocket, RealtimeSession>()

export function attachRealtimeAudio(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/realtime/audio' })

  wss.on('connection', async (ws, req) => {
    const token = extractToken(req.url)
    if (!token) {
      log.warn('Realtime audio rejected', { reason: 'missing token' })
      ws.close(1008, 'Missing token')
      return
    }
    const user = await resolveAccessToken(token)
    if (!user) {
      log.warn('Realtime audio rejected', { reason: 'invalid token' })
      ws.close(1008, 'Invalid token')
      return
    }
    const entitlement = await getEntitlementForUser(user.userId)
    if (!isPaidPlan(entitlement.plan, entitlement.status)) {
      log.warn('Realtime audio rejected', { user: user.userId, reason: 'plan' })
      ws.close(1008, 'Live copilot requires an active Pro or Premium subscription')
      return
    }

    const session: RealtimeSession = {
      userId: user.userId,
      chunks: [],
      lastTranscript: '',
      totalAudioSeconds: 0,
      transcribing: false,
      closed: false,
    }
    sessions.set(ws, session)
    log.info('Realtime audio connected', { user: user.userId })
    send(ws, { type: 'ready' })

    ws.on('message', (data) => {
      if (session.closed) return
      const buffer = asBuffer(data)
      if (!buffer.length) return
      session.chunks.push(buffer)
      void processAudio(ws, session)
    })

    ws.on('close', () => cleanup(session, ws))
    ws.on('error', () => cleanup(session, ws))
  })
}

function extractToken(url?: string): string | null {
  if (!url) return null
  const parsed = new URL(url, 'http://localhost')
  return parsed.searchParams.get('token')
}

function asBuffer(data: RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data)
  if (Buffer.isBuffer(data)) return data
  return Buffer.from(data)
}

async function processAudio(ws: WebSocket, session: RealtimeSession): Promise<void> {
  if (session.closed || session.transcribing || session.chunks.length === 0) return
  const buffer = session.chunks.shift()
  if (!buffer || buffer.length < 800) {
    if (session.chunks.length) void processAudio(ws, session)
    return
  }

  session.transcribing = true
  try {
    const transcript = await transcription(buffer)
    if (!isActionableTranscript(transcript)) return
    const seconds = Math.max(2, Math.round(buffer.length / 3500))
    session.lastTranscript = transcript
    const minutesBefore = Math.floor(session.totalAudioSeconds / 60)
    session.totalAudioSeconds += seconds
    const minutesAfter = Math.floor(session.totalAudioSeconds / 60)
    if (minutesAfter > minutesBefore) {
      await incrementUsage(session.userId, { audioMinutes: minutesAfter - minutesBefore }).catch(() => undefined)
    }
    const profile = await getOrCreateProfile(session.userId)
    send(ws, { type: 'transcript', transcript, context: buildContext(profile, transcript) })
  } catch (error) {
    logError('Realtime transcription failed', error, { user: session.userId })
    send(ws, { type: 'error', message: (error as Error).message })
  } finally {
    session.transcribing = false
    if (session.chunks.length) void processAudio(ws, session)
  }
}

function buildContext(profile: UserProfile, transcript: string): string {
  const parts: string[] = []
  if (profile.preferredName) parts.push(`User: ${profile.preferredName}`)
  if (profile.profession) parts.push(`Profession: ${profile.profession}`)
  if (profile.skills?.length) parts.push(`Skills: ${profile.skills.join(', ')}`)
  parts.push(`Realtime transcript: ${transcript}`)
  return parts.join('\n')
}

function send(ws: WebSocket, message: unknown): void {
  if (ws.readyState === 1) ws.send(JSON.stringify(message))
}

function cleanup(session: RealtimeSession, ws: WebSocket): void {
  if (!session.closed) log.info('Realtime audio closed', { user: session.userId })
  session.closed = true
  sessions.delete(ws)
}
