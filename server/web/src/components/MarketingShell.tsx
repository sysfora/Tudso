import { Link } from 'react-router-dom'
import { ArrowRight, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { displayFont } from '@/lib/brand'
import { BrandMark } from '@/components/app/BrandMark'
import type { ReactNode } from 'react'

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-page min-h-screen bg-background text-foreground" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="fixed left-1/2 top-3 z-50 w-[min(1100px,calc(100%-1.5rem))] -translate-x-1/2">
        <nav className="flex items-center justify-between gap-3 rounded-full bg-secondary/95 px-2.5 py-2 shadow-lg shadow-black/10 backdrop-blur">
          <Link to="/" className="flex min-w-0 items-center gap-2 pl-2 text-white">
            <BrandMark className="h-7 w-7 rounded-md" />
            <span className="truncate font-semibold tracking-tight">Tudso</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link to="/" className="text-sm text-white/80 transition hover:text-white">Home</Link>
            <Link to="/#features" className="text-sm text-white/80 transition hover:text-white">Features</Link>
            <Link to="/#pricing" className="text-sm text-white/80 transition hover:text-white">Pricing</Link>
            <Link to="/download" className="text-sm text-white transition">Download</Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex" asChild>
              <Link to="/login"><LogIn className="h-4 w-4" /> Login</Link>
            </Button>
            <Button size="sm" className="rounded-full bg-white text-secondary hover:bg-white/90" asChild>
              <Link to="/login?mode=register">Sign up <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </nav>
      </header>
      {children}
      <footer className="bg-secondary px-4 py-12 text-white/60 sm:px-5 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-2xl font-black text-white" style={displayFont}>Tudso</div>
          <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/download">Download</Link>
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#faq">FAQ</a>
          </nav>
          <div className="mt-8 border-t border-white/10 pt-5 text-xs">© Tudso 2026</div>
        </div>
      </footer>
    </div>
  )
}
