import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { useAppStore, windowModeFromWidth } from '@/store/app-store'

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
      <div className="app-shell">{children}</div>
    </div>
  )
}
