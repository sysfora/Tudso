import { desktop } from '@/lib/desktop'

export function recorderMimeType(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
}

export function mergeSpokenText(existing: string, incoming: string): string {
  const current = existing.trim()
  const next = incoming.trim()
  if (!next) return existing
  if (!current) return next
  if (current.endsWith(next)) return current
  if (next.startsWith(current)) return next
  return `${current} ${next}`
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

let sharedAudioContext: AudioContext | null = null

function audioContextCtor(): typeof AudioContext | undefined {
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

export async function primeAudioContext(): Promise<void> {
  const AudioCtx = audioContextCtor()
  if (!AudioCtx) return
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') sharedAudioContext = new AudioCtx()
  if (sharedAudioContext.state === 'suspended') await sharedAudioContext.resume()
}

function getAudioContext(): AudioContext | null {
  const AudioCtx = audioContextCtor()
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') return sharedAudioContext
  if (!AudioCtx) return null
  sharedAudioContext = new AudioCtx()
  void sharedAudioContext.resume()
  return sharedAudioContext
}

function createSpeechDetector(stream: MediaStream, minRms = 0.01): { isSpeech: () => boolean; stop: () => void; ready: Promise<void> } {
  const context = getAudioContext()
  if (!context) return { isSpeech: () => false, stop: () => undefined, ready: Promise.resolve() }

  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.45
  source.connect(analyser)
  const freq = new Uint8Array(analyser.frequencyBinCount)
  const time = new Uint8Array(analyser.fftSize)
  let noiseRms = minRms
  const startedAt = performance.now()
  const ready = context.state === 'running' ? Promise.resolve() : context.resume().then(() => undefined)

  return {
    ready,
    isSpeech: () => {
      if (context.state !== 'running') return false
      analyser.getByteTimeDomainData(time)
      analyser.getByteFrequencyData(freq)
      let energy = 0
      for (const value of time) {
        const n = (value - 128) / 128
        energy += n * n
      }
      const rms = Math.sqrt(energy / time.length)
      const binHz = context.sampleRate / 2 / freq.length
      let speech = 0
      let speechN = 0
      for (let i = 0; i < freq.length; i += 1) {
        const hz = i * binHz
        if (hz >= 250 && hz <= 4000) {
          speech += freq[i] ?? 0
          speechN += 1
        }
      }
      const speechAvg = speechN ? speech / speechN : 0
      if (performance.now() - startedAt < 350) {
        noiseRms = noiseRms * 0.85 + rms * 0.15
        return false
      }
      const talking = rms > Math.max(minRms, noiseRms * 2.2) && speechAvg > 6
      if (!talking) noiseRms = noiseRms * 0.97 + rms * 0.03
      return talking
    },
    stop: () => {
      try {
        source.disconnect()
      } catch {
        undefined
      }
    },
  }
}

export function startVoiceActivity(
  stream: MediaStream,
  handlers: {
    onSpeechStart?: () => void
    onSpeechEnd?: () => void
    onSpeakingChange?: (speaking: boolean) => void
  },
  options?: { silenceMs?: number; minSpeechMs?: number; confirmMs?: number; minRms?: number },
): () => void {
  const silenceMs = options?.silenceMs ?? 350
  const minSpeechMs = options?.minSpeechMs ?? 180
  const confirmMs = options?.confirmMs ?? 90
  const detector = createSpeechDetector(stream, options?.minRms ?? 0.01)
  let raf = 0
  let speaking = false
  let lastLoud = 0
  let speechStartedAt = 0
  let candidateAt = 0
  let stopped = false

  const tick = () => {
    if (stopped) return
    const loud = detector.isSpeech()
    const now = performance.now()
    if (loud) {
      lastLoud = now
      if (!speaking) {
        if (!candidateAt) candidateAt = now
        if (now - candidateAt >= confirmMs) {
          speaking = true
          speechStartedAt = candidateAt
          handlers.onSpeechStart?.()
          handlers.onSpeakingChange?.(true)
        }
      }
    } else {
      candidateAt = 0
      if (speaking && now - lastLoud >= silenceMs && now - speechStartedAt >= minSpeechMs) {
        speaking = false
        handlers.onSpeakingChange?.(false)
        handlers.onSpeechEnd?.()
      }
    }
    raf = requestAnimationFrame(tick)
  }

  void detector.ready.then(() => {
    if (!stopped) raf = requestAnimationFrame(tick)
  })

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    detector.stop()
  }
}

export function startAudioClips(
  stream: MediaStream,
  onBlob: (blob: Blob) => void,
  intervalMs = 2500,
  options?: { requireSpeech?: boolean; speechActive?: () => boolean },
): () => void {
  let stopped = false
  let recorder: MediaRecorder | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let sampleTimer: ReturnType<typeof setInterval> | null = null
  const probe = options?.requireSpeech && !options.speechActive ? createSpeechDetector(stream) : null
  const active = () => Boolean(options?.speechActive?.() || probe?.isSpeech())
  const gated = Boolean(options?.requireSpeech || options?.speechActive)

  const run = () => {
    if (stopped) return
    const mimeType = recorderMimeType()
    const next = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    recorder = next
    const chunks: Blob[] = []
    let speechFrames = 0
    if (sampleTimer) clearInterval(sampleTimer)
    sampleTimer = setInterval(() => {
      if (!gated || active()) speechFrames += 1
    }, 40)
    next.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    next.onstop = () => {
      if (sampleTimer) clearInterval(sampleTimer)
      sampleTimer = null
      const spoken = !gated || speechFrames >= 3
      if (!stopped && chunks.length && spoken) onBlob(new Blob(chunks, { type: next.mimeType || 'audio/webm' }))
      if (!stopped) run()
    }
    try {
      next.start()
    } catch {
      stopped = true
      return
    }
    timer = setTimeout(() => {
      if (next.state !== 'inactive') next.stop()
    }, intervalMs)
  }

  run()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
    if (sampleTimer) clearInterval(sampleTimer)
    sampleTimer = null
    probe?.stop()
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    recorder = null
  }
}

export function startUtteranceCapture(stream: MediaStream, onBlob: (blob: Blob) => void): {
  begin: () => void
  end: () => void
  stop: () => void
} {
  let stopped = false
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let restart = false

  const begin = () => {
    if (stopped) return
    if (recorder && recorder.state !== 'inactive') return
    const mimeType = recorderMimeType()
    const next = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    recorder = next
    chunks = []
    next.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    next.onstop = () => {
      const blob = new Blob(chunks, { type: next.mimeType || 'audio/webm' })
      chunks = []
      recorder = null
      if (!stopped && blob.size > 800) onBlob(blob)
      if (!stopped && restart) {
        restart = false
        begin()
      }
    }
    try {
      next.start()
    } catch {
      recorder = null
    }
  }

  const end = () => {
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }

  return {
    begin: () => {
      if (recorder && recorder.state !== 'inactive') return
      if (recorder) {
        restart = true
        return
      }
      begin()
    },
    end,
    stop: () => {
      stopped = true
      restart = false
      end()
    },
  }
}

export async function captureMicrophone(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  })
  void desktop.window.restoreTaskbar()
  return stream
}

export async function captureSystemAudio(sourceId: string): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: 2,
        maxHeight: 2,
      },
    },
  } as unknown as MediaStreamConstraints)
  stream.getVideoTracks().forEach((track) => track.stop())
  void desktop.window.restoreTaskbar()
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((track) => track.stop())
    throw new Error('This display source has no computer audio.')
  }
  return stream
}
