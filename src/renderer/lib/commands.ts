import { FONT_SIZE_MAX, FONT_SIZE_MIN, chatModelLabel, toggleChatModel } from '@shared/defaults'
import type { AppCommand } from '@shared/types'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'
import { useRealtimeStore } from '@/store/realtime-store'

export function focusComposer() {
  document.getElementById('composer-input')?.focus()
}

let lastCommand: AppCommand | null = null
let lastCommandAt = 0

export function runAppCommand(command: AppCommand) {
  const now = Date.now()
  if (command === lastCommand && now - lastCommandAt < 200) return
  lastCommand = command
  lastCommandAt = now

  const store = useAppStore.getState()

  switch (command) {
    case 'new-conversation':
      if (store.runningSessionId) return
      store.newConversation()
      requestAnimationFrame(focusComposer)
      return
    case 'end-session':
      useRealtimeStore.getState().stop()
      store.endSession()
      return
    case 'focus-composer':
      store.setSettingsOpen(false)
      requestAnimationFrame(focusComposer)
      return
    case 'send-message':
      void store.sendMessage()
      return
    case 'ask-screen':
      void store.askFromScreen()
      return
    case 'live-copilot-screen':
      void useRealtimeStore.getState().toggle(true)
      return
    case 'live-copilot-audio':
      void useRealtimeStore.getState().toggle(false)
      return
    case 'stop-generation':
      useRealtimeStore.getState().stop()
      store.stopGeneration()
      return
    case 'copy-last-answer':
      void store.copyAnswer(1, 'markdown')
      return
    case 'copy-last-answer-plain':
      void store.copyAnswer(1, 'plain')
      return
    case 'copy-last-code':
      void store.copyAnswer(1, 'code')
      return
    case 'copy-answer-1':
    case 'copy-answer-2':
    case 'copy-answer-3':
    case 'copy-answer-4':
    case 'copy-answer-5':
    case 'copy-answer-6':
    case 'copy-answer-7':
    case 'copy-answer-8':
    case 'copy-answer-9':
      void store.copyAnswer(Number(command.slice(-1)), 'markdown')
      return
    case 'copy-answer-plain-1':
    case 'copy-answer-plain-2':
    case 'copy-answer-plain-3':
    case 'copy-answer-plain-4':
    case 'copy-answer-plain-5':
    case 'copy-answer-plain-6':
    case 'copy-answer-plain-7':
    case 'copy-answer-plain-8':
    case 'copy-answer-plain-9':
      void store.copyAnswer(Number(command.slice(-1)), 'plain')
      return
    case 'copy-answer-code-1':
    case 'copy-answer-code-2':
    case 'copy-answer-code-3':
    case 'copy-answer-code-4':
    case 'copy-answer-code-5':
    case 'copy-answer-code-6':
    case 'copy-answer-code-7':
    case 'copy-answer-code-8':
    case 'copy-answer-code-9':
      void store.copyAnswer(Number(command.slice(-1)), 'code')
      return
    case 'open-settings':
      store.setSettingsOpen(true)
      return
    case 'open-account':
      store.setSettingsOpen(true, 'account')
      return
    case 'open-subscription':
      store.setSettingsOpen(true, 'subscription')
      return
    case 'next-conversation':
      store.cycleConversation(1)
      return
    case 'previous-conversation':
      store.cycleConversation(-1)
      return
    case 'window-compact':
      void desktop.window.setMode('compact')
      return
    case 'window-normal':
      void desktop.window.setMode('normal')
      return
    case 'window-expanded':
      void desktop.window.setMode('expanded')
      return
    case 'increase-font-size': {
      const next = Math.min(FONT_SIZE_MAX, store.settings.fontSize + 1)
      if (next !== store.settings.fontSize) void store.setSettings({ fontSize: next })
      return
    }
    case 'decrease-font-size': {
      const next = Math.max(FONT_SIZE_MIN, store.settings.fontSize - 1)
      if (next !== store.settings.fontSize) void store.setSettings({ fontSize: next })
      return
    }
    case 'hide-window':
      desktop.window.hide()
      return
    case 'toggle-collapsed':
      desktop.window.minimize()
      return
    case 'toggle-privacy':
      void store.setSettings({ privacyMode: !store.settings.privacyMode })
      return
    case 'toggle-hide-from-capture':
      void store.setSettings({ hideFromCapture: !store.settings.hideFromCapture })
      return
    case 'toggle-model': {
      const next = toggleChatModel(store.settings.model)
      void store.setSettings({ model: next })
      desktop.app.notify('Model', chatModelLabel(next))
      return
    }
    case 'open-command-palette':
      window.dispatchEvent(new Event('tudso:open-command-palette'))
      return
    case 'position-window-1':
    case 'position-window-2':
    case 'position-window-3':
    case 'position-window-4':
    case 'position-window-5':
    case 'position-window-6':
    case 'position-window-7':
    case 'position-window-8':
    case 'position-window-9':
      void desktop.window.positionTo(Number(command.slice(-1)))
      return
    case 'move-window-left':
      void desktop.window.nudge('left')
      return
    case 'move-window-right':
      void desktop.window.nudge('right')
      return
    case 'move-window-up':
      void desktop.window.nudge('up')
      return
    case 'move-window-down':
      void desktop.window.nudge('down')
      return
  }
}
