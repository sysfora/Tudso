import { useEffect } from 'react'
import { desktop } from '@/lib/desktop'
import { runAppCommand } from '@/lib/commands'
import { useAppStore } from '@/store/app-store'

export function useDesktopEvents() {
  const replaceSettings = useAppStore((state) => state.replaceSettings)
  const replaceShortcuts = useAppStore((state) => state.replaceShortcuts)
  const setBlockedShortcuts = useAppStore((state) => state.setBlockedShortcuts)
  const setWindowCollapsed = useAppStore((state) => state.setWindowCollapsed)

  useEffect(() => {
    const offCommand = desktop.app.onCommand((command) => {
      runAppCommand(command)
    })
    const offSettings = desktop.settings.onChange(replaceSettings)
    const offShortcuts = desktop.shortcuts.onChange(replaceShortcuts)
    const offFailed = desktop.shortcuts.onFailed(setBlockedShortcuts)
    const offCollapsed = desktop.window.onCollapsed(setWindowCollapsed)
    return () => {
      offCommand()
      offSettings()
      offShortcuts()
      offFailed()
      offCollapsed()
    }
  }, [replaceSettings, replaceShortcuts, setBlockedShortcuts, setWindowCollapsed])
}
