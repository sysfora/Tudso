import { desktop, isElectron } from '@/lib/desktop'
import type { PickedResume } from '@shared/types'

export async function pickResumeFile(): Promise<PickedResume | null> {
  if (isElectron) return desktop.app.pickResume()
  return pickResumeInBrowser()
}

function pickResumeInBrowser(): Promise<PickedResume | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.docx,.txt,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: await file.arrayBuffer(),
      })
    })
    input.click()
  })
}
