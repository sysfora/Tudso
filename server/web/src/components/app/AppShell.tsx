import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'

const ThemeContext = createContext<ReturnType<typeof useAppTheme> | null>(null)

export function AppShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const theme = useAppTheme()
  useEffect(() => {
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = theme.dark ? '#1c1c1f' : '#f4f4f5'
    return () => {
      document.body.style.backgroundColor = previous
    }
  }, [theme.dark])
  return (
    <ThemeContext.Provider value={theme}>
      <div className={cn('app-ui', theme.dark && 'dark', className)}>{children}</div>
    </ThemeContext.Provider>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useContext(ThemeContext)
  if (!theme) return null
  return (
    <Button
      type="button"
      variant="quiet"
      size="icon"
      className={className}
      onClick={theme.toggle}
      aria-label={theme.dark ? 'Use light mode' : 'Use dark mode'}
      title={theme.dark ? 'Light mode' : 'Dark mode'}
    >
      {theme.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
