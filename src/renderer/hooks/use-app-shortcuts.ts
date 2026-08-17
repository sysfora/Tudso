import { useEffect } from 'react'
import { eventMatchesAccelerator } from '@shared/accelerator'
import { commandForShortcut, localShortcutIds } from '@shared/shortcut-commands'
import { runAppCommand } from '@/lib/commands'
import { useAppStore } from '@/store/app-store'

export function useAppShortcuts() {
  const shortcuts = useAppStore((state) => state.shortcuts)
  const recordingShortcut = useAppStore((state) => state.recordingShortcut)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (recordingShortcut) return
      const target = event.target as HTMLElement | null
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || Boolean(target?.isContentEditable)

      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        const store = useAppStore.getState()
        if (store.generatingId) {
          store.stopGeneration()
          return
        }
        if (store.settingsOpen) {
          store.setSettingsOpen(false)
          return
        }
        if (inField && store.composer) {
          store.setComposer('')
          return
        }
        runAppCommand('hide-window')
        return
      }

      for (const id of localShortcutIds(shortcuts)) {
        const accelerator = shortcuts[id]
        if (!accelerator || !eventMatchesAccelerator(event, accelerator)) continue
        event.preventDefault()
        const command = commandForShortcut(id)
        if (command) runAppCommand(command)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [shortcuts, recordingShortcut])
}
