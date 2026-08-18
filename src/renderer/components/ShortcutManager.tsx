import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { eventToAccelerator, formatAccelerator, modifierCount } from '@shared/accelerator'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_DESCRIPTIONS,
  SHORTCUT_GROUPS,
  SHORTCUT_LABELS,
  SHORTCUT_TAKEN_MESSAGE,
} from '@shared/defaults'
import type { ShortcutId } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input, Kbd } from '@/components/ui/input'
import { desktop } from '@/lib/desktop'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/app-store'

export function ShortcutManager() {
  const shortcuts = useAppStore((state) => state.shortcuts)
  const recording = useAppStore((state) => state.recordingShortcut)
  const blockedShortcuts = useAppStore((state) => state.blockedShortcuts)
  const setRecordingShortcut = useAppStore((state) => state.setRecordingShortcut)
  const setShortcut = useAppStore((state) => state.setShortcut)
  const resetShortcuts = useAppStore((state) => state.resetShortcuts)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (!recording) return
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        setRecordingShortcut(null)
        setError(null)
        return
      }
      const accelerator = eventToAccelerator(event)
      if (!accelerator) return
      if (modifierCount(accelerator) < 2) {
        setError('Use two modifiers, such as Ctrl+Alt, so it will not clash with other apps.')
        return
      }
      setShortcut(recording, accelerator)
        .then(() => {
          setRecordingShortcut(null)
          setError(null)
        })
        .catch((err: Error) => {
          setError(err.message)
        })
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, setRecordingShortcut, setShortcut])

  useEffect(() => {
    return () => {
      if (useAppStore.getState().recordingShortcut) {
        useAppStore.getState().setRecordingShortcut(null)
      }
    }
  }, [])

  const platform = desktop.platform
  const lowerQuery = query.trim().toLowerCase()

  const groups = useMemo(() => {
    return SHORTCUT_GROUPS.map((group) => ({
      ...group,
      ids: group.ids.filter((id) => {
        if (!lowerQuery) return true
        const haystack = [
          group.title,
          SHORTCUT_LABELS[id],
          SHORTCUT_DESCRIPTIONS[id],
          shortcuts[id],
          formatAccelerator(shortcuts[id], platform),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(lowerQuery)
      }),
    })).filter((group) => group.ids.length > 0)
  }, [lowerQuery, platform, shortcuts])

  const customized = (Object.keys(DEFAULT_SHORTCUTS) as ShortcutId[]).some(
    (id) => shortcuts[id] !== DEFAULT_SHORTCUTS[id],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-muted">
          Tudso uses Ctrl+Alt chords so they stay out of the way of Windows and Mac apps. On a Mac that is Control+Option, not Command. Click a key to change it.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!customized || resetting}
          loading={resetting}
          onClick={() => {
            setError(null)
            setRecordingShortcut(null)
            setResetting(true)
            void resetShortcuts().finally(() => setResetting(false))
          }}
        >
          Reset all
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-surface-2 px-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shortcuts"
          className="h-9 border-0 bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent"
          aria-label="Search shortcuts"
        />
      </div>

      {groups.map((group) => (
        <section key={group.title}>
          <h4 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">{group.title}</h4>
          <div className="divide-y divide-border overflow-hidden rounded-md bg-surface-2">
            {group.ids.map((id) => (
              <ShortcutRow
                key={id}
                id={id}
                value={shortcuts[id]}
                recording={recording === id}
                blocked={blockedShortcuts.includes(id)}
                error={recording === id ? error : null}
                onRecord={() => {
                  setError(null)
                  setRecordingShortcut(recording === id ? null : id)
                }}
                onReset={() => {
                  setError(null)
                  void setShortcut(id, DEFAULT_SHORTCUTS[id]).catch((err: Error) => setError(err.message))
                }}
              />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">No shortcuts match “{query.trim()}”.</p>
      ) : null}

      {error && !recording ? <p className="text-xs text-danger">{error}</p> : null}

      <p className="text-[12px] leading-relaxed text-muted">
        Esc cancels recording. Enter still sends from the prompt, Shift+Enter inserts a new line.
      </p>
    </div>
  )
}

function ShortcutRow({
  id,
  value,
  recording,
  blocked,
  error,
  onRecord,
  onReset,
}: {
  id: ShortcutId
  value: string
  recording: boolean
  blocked: boolean
  error: string | null
  onRecord: () => void
  onReset: () => void
}) {
  const changed = value !== DEFAULT_SHORTCUTS[id]
  const message = recording && error ? error : blocked ? SHORTCUT_TAKEN_MESSAGE : null

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{SHORTCUT_LABELS[id]}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{SHORTCUT_DESCRIPTIONS[id]}</p>
        {message ? <p className="mt-1 text-[12px] text-danger">{message}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {changed ? (
          <button
            type="button"
            className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-lift hover:text-fg"
            onClick={onReset}
            aria-label={`Reset ${SHORTCUT_LABELS[id]}`}
            title="Reset to default"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            'min-w-[7.5rem] rounded-md bg-surface px-2 py-1 text-[12px] transition-colors duration-150 hover:bg-lift hover:text-fg',
            recording && 'bg-lift text-accent',
            blocked && !recording && 'text-danger',
          )}
          onClick={onRecord}
          aria-label={`Edit shortcut for ${SHORTCUT_LABELS[id]}`}
        >
          {recording ? 'Press keys…' : <Kbd>{formatAccelerator(value, desktop.platform)}</Kbd>}
        </button>
      </div>
    </div>
  )
}
