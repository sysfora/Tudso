import { BrowserWindow, desktopCapturer, ipcMain } from 'electron'
import { restoreTaskbarPresence } from './windows'

let captureWindow: BrowserWindow | null = null
let chunkListener: ((chunk: ArrayBuffer) => void) | null = null
let chunkHandler: ((_event: Electron.IpcMainEvent, buffer: ArrayBuffer) => void) | null = null

const captureHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <script>
    const { ipcRenderer } = require('electron')
    let mediaRecorder = null
    let stream = null
    ipcRenderer.on('start', async (_event, sourceId) => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
            },
          },
          video: false,
        })
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            event.data.arrayBuffer().then((buffer) => {
              ipcRenderer.send('audio-chunk', buffer)
            })
          }
        }
        mediaRecorder.start(1000)
      } catch (error) {
        ipcRenderer.send('audio-error', error.message)
      }
    })
    ipcRenderer.on('stop', () => {
      mediaRecorder?.stop()
      stream?.getTracks().forEach((track) => track.stop())
      mediaRecorder = null
      stream = null
    })
  </script>
</body>
</html>`

export async function getAudioSources(): Promise<Array<{ id: string; name: string }>> {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
    return sources.map((s) => ({ id: s.id, name: s.name }))
  } finally {
    restoreTaskbarPresence()
  }
}

export async function startAudioCapture(sourceId: string, onChunk: (chunk: ArrayBuffer) => void): Promise<void> {
  stopAudioCapture()
  chunkListener = onChunk

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
  ipcMain.on('audio-chunk', chunkHandler)

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
  chunkListener = null
}

// Audio chunks are forwarded to the renderer by the IPC listener in ipc.ts.
