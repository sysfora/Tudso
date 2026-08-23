import { Link } from 'react-router-dom'
import { ArrowRight, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { displayFont } from '@/lib/brand'
import type { ReactNode } from 'react'

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6">
        <Link to="/" className="text-xl font-black tracking-tight sm:text-2xl" style={displayFont}>
          Tudso
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" className="sm:h-10 sm:px-4" asChild>
            <Link to="/download">Download</Link>
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex sm:h-10 sm:px-4" asChild>
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          </Button>
          <Button size="sm" className="sm:h-10 sm:px-4" asChild>
            <Link to="/login?mode=register">
              Start applying
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-5 sm:pb-10">
        <div className="rounded-3xl bg-secondary p-8 text-center sm:p-10">
          <div className="text-2xl font-black" style={displayFont}>Tudso</div>
          <nav className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Link to="/download">Download</Link>
            <a href="/#faq">FAQ</a>
            <a href="#">Terms of Use</a>
            <a href="#">Privacy Policy</a>
          </nav>
          <div className="mt-6 text-xs text-muted-foreground">© Tudso 2026</div>
        </div>
      </footer>
    </div>
  )
}
