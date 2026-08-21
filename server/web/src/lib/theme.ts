import * as React from 'react'

const KEY = 'tudso.web.theme'

export type WebTheme = 'light' | 'dark'

function readTheme(): WebTheme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useAppTheme() {
  const [theme, setThemeState] = React.useState<WebTheme>('light')

  React.useEffect(() => {
    setThemeState(readTheme())
  }, [])

  const setTheme = React.useCallback((next: WebTheme) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
    setThemeState(next)
  }, [])

  const toggle = React.useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { theme, dark: theme === 'dark', toggle, setTheme }
}
