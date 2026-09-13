import type { PointerEvent, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { useAppStore, windowModeFromWidth } from '@/store/app-store'
import { desktop } from '@/lib/desktop'

const RESIZE_HANDLES = [
  { edge: 'n', className: 'top-0 inset-x-3 h-2 cursor-n-resize' },
  { edge: 's', className: 'bottom-0 inset-x-3 h-2 cursor-s-resize' },
  { edge: 'e', className: 'right-0 inset-y-3 w-2 cursor-e-resize' },
  { edge: 'w', className: 'left-0 inset-y-3 w-2 cursor-w-resize' },
  { edge: 'ne', className: 'top-0 right-0 h-3 w-3 cursor-ne-resize' },
  { edge: 'nw', className: 'top-0 left-0 h-3 w-3 cursor-nw-resize' },
  { edge: 'se', className: 'bottom-0 right-0 h-3 w-3 cursor-se-resize' },
  { edge: 'sw', className: 'bottom-0 left-0 h-3 w-3 cursor-sw-resize' },
] as const

function ResizeHandle({ edge, className }: (typeof RESIZE_HANDLES)[number]) {
  const start = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    desktop.window.resizeStart(edge, event.screenX, event.screenY)
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons) desktop.window.resizeMove(event.screenX, event.screenY)
  }

  const end = (event: PointerEvent<HTMLDivElement>) => {
    desktop.window.resizeEnd()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      className={`window-resize-handle ${className}`}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const setWindowWidth = useAppStore((state) => state.setWindowWidth)
  const width = useAppStore((state) => state.windowWidth)
  const mode = windowModeFromWidth(width)

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next) setWindowWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [setWindowWidth])

  return (
    <div ref={frameRef} className="app-frame" data-mode={mode}>
      <div className="app-shell">
        {children}
        {RESIZE_HANDLES.map((handle) => <ResizeHandle key={handle.edge} {...handle} />)}
      </div>
    </div>
  )
}
