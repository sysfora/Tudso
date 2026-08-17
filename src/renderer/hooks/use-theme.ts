import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

export function useTheme() {
  const theme = useAppStore((state) => state.settings.theme)
  const fontSize = useAppStore((state) => state.settings.fontSize)
  const compactMode = useAppStore((state) => state.settings.compactMode)
  const transparency = useAppStore((state) => state.settings.transparency)
  const transparencyAmount = useAppStore((state) => state.settings.transparencyAmount)

  useEffect(() => {
    const root = document.documentElement
    const apply = (dark: boolean) => {
      root.classList.toggle('dark', dark)
      root.style.colorScheme = dark ? 'dark' : 'light'
    }

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      apply(media.matches)
      const onChange = () => apply(media.matches)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    }

    apply(theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)
    document.documentElement.classList.toggle('compact', compactMode)
  }, [fontSize, compactMode])

  useEffect(() => {
    const amount = transparency ? Math.min(80, Math.max(5, transparencyAmount)) : 0
    document.documentElement.style.setProperty('--transparency', `${amount}%`)
  }, [transparency, transparencyAmount])
}
