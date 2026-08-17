import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { captureMicrophone, mergeSpokenText, primeAudioContext, startAudioClips, stopMediaStream } from '@/lib/media-audio'
import { useAppStore } from '@/store/app-store'
import { cleanTranscript } from '@shared/transcript'

export function useVoiceInput() {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stopClipsRef = useRef<(() => void) | null>(null)
  const queueRef = useRef(Promise.resolve())

  useEffect(() => {
    return () => {
      stopClipsRef.current?.()
      stopMediaStream(streamRef.current)
    }
  }, [])

  const stop = () => {
    stopClipsRef.current?.()
    stopClipsRef.current = null
    stopMediaStream(streamRef.current)
    streamRef.current = null
    setListening(false)
  }

  const appendTranscript = (text: string) => {
    const composer = useAppStore.getState().composer
    useAppStore.getState().setComposer(mergeSpokenText(composer, text))
  }

  const transcribeClip = async (blob: Blob) => {
    if (blob.size < 500) return
    try {
      const text = cleanTranscript((await api.ai.transcribe(blob)).trim())
      if (text) {
        appendTranscript(text)
        setError(null)
      }
    } catch (caught) {
      setError((caught as Error).message || 'Transcription failed.')
    }
  }

  const start = async () => {
    if (listening) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice input is not supported in this window.')
      return
    }

    setError(null)
    try {
      await primeAudioContext()
      const stream = await captureMicrophone()
      streamRef.current = stream
      setListening(true)
      stopClipsRef.current = startAudioClips(stream, (blob) => {
        queueRef.current = queueRef.current.then(() => transcribeClip(blob)).catch(() => undefined)
      }, 2000, { requireSpeech: true })
    } catch (caught) {
      const name = (caught as DOMException).name
      setError(
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Microphone permission was denied.'
          : 'Could not access the microphone.',
      )
      stopMediaStream(streamRef.current)
      streamRef.current = null
      setListening(false)
    }
  }

  const toggle = () => {
    if (listening) stop()
    else void start()
  }

  return { listening, error, toggle }
}
