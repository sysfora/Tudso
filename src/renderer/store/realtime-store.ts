import { create } from 'zustand'
import { config } from '@/config'
import { getInterviewSessionToken, getToken } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import {
  captureSystemAudio,
  mergeSpokenText,
  primeAudioContext,
  startUtteranceCapture,
  startVoiceActivity,
  stopMediaStream,
} from '@/lib/media-audio'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { hasProductAccess } from '@shared/plans'
import { cleanTranscript, isActionableTranscript } from '@shared/transcript'

export type AudioMode = 'system'

interface RealtimeState {
  listening: boolean
  speaking: boolean
  mode: AudioMode
  transcript: string
  error: string | null
}

interface RealtimeActions {
  start: (mode?: AudioMode) => Promise<void>
  toggle: () => Promise<void>
  stop: () => void
  clear: () => void
}

let socket: WebSocket | null = null
let mediaStream: MediaStream | null = null
let stopVoice: (() => void) | null = null
let utterance: { begin: () => void; end: () => void; stop: () => void } | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let intentionalStop = false
let sending = false
let queued = false
let speaking = false
let unsent = ''
let lastSent = ''

function realtimeUrl(token: string, sessionToken: string): string {
  return `${config.serverUrl.replace(/^http/, 'ws')}/realtime/audio?token=${encodeURIComponent(token)}&session=${encodeURIComponent(sessionToken)}`
}

function connectSocket(token: string, sessionToken: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const next = new WebSocket(realtimeUrl(token, sessionToken))
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      next.close()
      reject(new Error('Realtime connection timed out'))
    }, 8000)
    next.onopen = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(next)
    }
    next.onerror = () => undefined
    next.onclose = (event) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(event.reason || 'Realtime connection closed'))
    }
  })
}

function clearIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
}

function armIdleTimer() {
  clearIdleTimer()
  idleTimer = setTimeout(() => {
    idleTimer = null
    void answerIfQuiet()
  }, 220)
}

async function answerIfQuiet(force = false) {
  if (intentionalStop) return
  if (!force && speaking) return
  const text = unsent.trim()
  if (!isActionableTranscript(text) || text === lastSent) return
  if (sending || useAppStore.getState().generatingId) {
    queued = true
    return
  }

  sending = true
  queued = false
  lastSent = text
  unsent = ''
  useRealtimeStore.setState({ transcript: '' })
  const mode = useRealtimeStore.getState().mode
  try {
    await useAppStore.getState().sendMessage(undefined, {
      fromRealtime: true,
      audioText: text,
      audioSource: mode,
    })
  } finally {
    sending = false
    lastSent = ''
    if (!intentionalStop && useRealtimeStore.getState().listening && queued && !speaking) {
      queued = false
      void answerIfQuiet()
    }
  }
}

export const useRealtimeStore = create<RealtimeState & RealtimeActions>((set, get) => ({
  listening: false,
  speaking: false,
  mode: 'system',
  transcript: '',
  error: null,

  toggle: async () => {
    if (get().listening) {
      get().stop()
      return
    }
    await get().start(get().mode)
  },

  start: async (mode = 'system') => {
    if (get().listening) return
    if (!liveAllowed()) {
      set({ error: liveError() })
      return
    }
    if (useAppStore.getState().expireLiveSession()) {
      set({ error: 'This session reached its time limit.' })
      return
    }
    if (!useAppStore.getState().runningSessionId) {
      const started = await useAppStore.getState().startDefaultSession()
      if (!started || !useAppStore.getState().runningSessionId) {
        set({ error: 'Could not start an interview session.' })
        return
      }
    }
    const token = getToken()
    if (!token) {
      set({ error: 'Sign in to use live copilot.' })
      return
    }
    const sessionToken = getInterviewSessionToken()
    if (!sessionToken) {
      set({ error: 'Start an interview session first.' })
      return
    }

    intentionalStop = false
    sending = false
    queued = false
    speaking = false
    unsent = ''
    lastSent = ''
    clearIdleTimer()
    set({ listening: true, speaking: false, mode, error: null, transcript: '' })

    try {
      await primeAudioContext()
      const nextSocket = await connectSocket(token, sessionToken)
      socket = nextSocket
      nextSocket.onmessage = (event) => {
        const data = JSON.parse(String(event.data)) as { type: string; transcript?: string; message?: string }
        if (data.type === 'transcript' && data.transcript) {
          const spoken = cleanTranscript(data.transcript)
          if (!isActionableTranscript(spoken)) return
          unsent = mergeSpokenText(unsent, spoken)
          set({ transcript: unsent, error: null })
          if (speaking) armIdleTimer()
          else void answerIfQuiet()
        } else if (data.type === 'error') {
          set({ error: data.message ?? 'Realtime error' })
        }
      }
      nextSocket.onclose = (event) => {
        if (intentionalStop) return
        get().stop()
        set({ error: event.reason || 'Realtime connection closed', listening: false, speaking: false })
      }

      mediaStream = await startSystemStream()
      void desktop.window.restoreTaskbar()
      if (intentionalStop || !get().listening || socket?.readyState !== WebSocket.OPEN) {
        stopMediaStream(mediaStream)
        mediaStream = null
        return
      }

      utterance = startUtteranceCapture(mediaStream, (blob) => {
        if (socket?.readyState === WebSocket.OPEN && blob.size > 800) socket.send(blob)
      })

      try {
        stopVoice = startVoiceActivity(mediaStream, {
          onSpeechStart: () => {
            speaking = true
            lastSent = ''
            clearIdleTimer()
            utterance?.begin()
            set({ speaking: true })
          },
          onSpeechEnd: () => {
            speaking = false
            utterance?.end()
            set({ speaking: false })
            clearIdleTimer()
          },
          onSpeakingChange: (next) => set({ speaking: next }),
        }, {
          silenceMs: 400,
          minSpeechMs: 220,
          confirmMs: 140,
          minRms: 0.012,
        })
      } catch {
        stopVoice = null
      }
    } catch (error) {
      get().stop()
      set({ error: (error as Error).message || 'Could not start live copilot.', listening: false, speaking: false })
    }
  },

  stop: () => {
    intentionalStop = true
    queued = false
    speaking = false
    unsent = ''
    lastSent = ''
    clearIdleTimer()
    stopVoice?.()
    stopVoice = null
    utterance?.stop()
    utterance = null
    stopMediaStream(mediaStream)
    mediaStream = null
    socket?.close()
    socket = null
    void desktop.window.restoreTaskbar()
    set({ listening: false, speaking: false, transcript: '' })
  },

  clear: () => set({ transcript: '', error: null }),
}))

async function startSystemStream(): Promise<MediaStream> {
  const sources = await desktop.audio.getSources()
  const source = sources.find((item) => item.id.startsWith('screen:')) ?? sources[0]
  if (!source) throw new Error('No computer audio source was found.')
  return captureSystemAudio(source.id)
}

function liveAllowed(): boolean {
  const entitlement = useAuthStore.getState().entitlement
  return hasProductAccess(entitlement?.plan, entitlement?.status, entitlement?.interviewCredits)
}

function liveError(): string {
  return 'Live copilot needs remaining interview sessions or an active plan.'
}
