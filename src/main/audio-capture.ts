import { BrowserWindow, desktopCapturer, ipcMain } from 'electron'
import { ensureCaptureAccess } from './capture'
import { restoreOverlayAfterCapture } from './windows'

let captureWindow: BrowserWindow | null = null
let chunkListener: ((chunk: ArrayBuffer) => void) | null = null
let chunkHandler: ((_event: Electron.IpcMainEvent, buffer: ArrayBuffer) => void) | null = null
let errorHandler: ((_event: Electron.IpcMainEvent, message: string) => void) | null = null

const captureHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <script>
    const { ipcRenderer } = require('electron')
    let mediaRecorder = null
    let stream = null

    function desktopConstraint(sourceId) {
      return {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      }
    }

    function recorderOptions() {
      if (typeof MediaRecorder === 'undefined') return {}
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return { mimeType: 'audio/webm;codecs=opus' }
      if (MediaRecorder.isTypeSupported('audio/webm')) return { mimeType: 'audio/webm' }
      if (MediaRecorder.isTypeSupported('audio/mp4')) return { mimeType: 'audio/mp4' }
      return {}
    }

    async function openDesktopStream(sourceId) {
      const desktop = desktopConstraint(sourceId)
      try {
        const mixed = await navigator.mediaDevices.getUserMedia({ audio: desktop, video: desktop })
        mixed.getVideoTracks().forEach((track) => {
          track.stop()
          mixed.removeTrack(track)
        })
        if (mixed.getAudioTracks().length) return mixed
        mixed.getTracks().forEach((track) => track.stop())
      } catch {
        undefined
      }
      return navigator.mediaDevices.getUserMedia({ audio: desktop, video: false })
    }

    ipcRenderer.on('start', async (_event, sourceId) => {
      try {
        stream = await openDesktopStream(sourceId)
        mediaRecorder = new MediaRecorder(stream, recorderOptions())
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            event.data.arrayBuffer().then((buffer) => {
              ipcRenderer.send('audio-chunk', buffer)
            })
          }
        }
        mediaRecorder.start(1000)
      } catch (error) {
        ipcRenderer.send('audio-error', error && error.message ? error.message : String(error))
      }
    })
    ipcRenderer.on('stop', () => {
      try { mediaRecorder?.stop() } catch (_) {}
      stream?.getTracks().forEach((track) => track.stop())
      mediaRecorder = null
      stream = null
    })
  </script>
</body>
</html>`

export async function getAudioSources(): Promise<Array<{ id: string; name: string }>> {
  try {
    await ensureCaptureAccess()
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
    })
    return sources.map((s) => ({ id: s.id, name: s.name }))
  } finally {
    restoreOverlayAfterCapture()
  }
}

export async function startAudioCapture(sourceId: string, onChunk: (chunk: ArrayBuffer) => void): Promise<void> {
  stopAudioCapture()
  chunkListener = onChunk
  await ensureCaptureAccess()

  captureWindow = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    focusable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  captureWindow.loadURL(`data:text/html;base64,${Buffer.from(captureHtml).toString('base64')}`)

  chunkHandler = (_event, buffer: ArrayBuffer) => {
    chunkListener?.(buffer)
  }
  errorHandler = (_event, message: string) => {
    console.error('[audio] capture failed', message)
  }
  ipcMain.on('audio-chunk', chunkHandler)
  ipcMain.on('audio-error', errorHandler)

  captureWindow.webContents.on('did-finish-load', () => {
    captureWindow?.webContents.send('start', sourceId)
  })
}

export function stopAudioCapture(): void {
  captureWindow?.webContents.send('stop')
  captureWindow?.close()
  captureWindow = null
  if (chunkHandler) {
    ipcMain.removeListener('audio-chunk', chunkHandler)
    chunkHandler = null
  }
  if (errorHandler) {
    ipcMain.removeListener('audio-error', errorHandler)
    errorHandler = null
  }
  chunkListener = null
}
