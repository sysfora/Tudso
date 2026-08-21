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
  const [theme, setTheme] = React.useState<WebTheme>('light')

  React.useEffect(() => {
    setTheme(readTheme())
  }, [])

  const toggle = React.useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { theme, dark: theme === 'dark', toggle }
}
