import { BrandMark } from '@/components/app/BrandMark'
import { cn } from '@/lib/utils'

const WAVE = [22, 36, 28, 52, 40, 68, 44, 60, 34, 72, 48, 58, 32, 50]

export function SkeletonBar({ className, delay }: { className?: string; delay?: number }) {
  return <div className={cn('skeleton-bar', className)} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4" aria-busy="true" aria-label={label}>
      <BrandMark className="h-8 w-8" />
      <div className="flex h-11 items-end gap-1">
        {WAVE.map((height, index) => (
          <div
            key={index}
            className="skeleton-bar w-1.5 rounded-sm"
            style={{ height, animationDelay: `${index * 70}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-44 items-end gap-1 rounded-3xl bg-card px-6 py-5', className)} aria-hidden>
      {WAVE.map((height, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col items-center justify-end">
          <div
            className="skeleton-bar w-full max-w-5 rounded-sm"
            style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }}
          />
        </div>
      ))}
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <div className="dashboard-page space-y-8" aria-busy="true" aria-label="Loading analytics">
      <div>
        <SkeletonBar className="h-5 w-28" />
        <SkeletonBar className="mt-2 h-3 w-72 max-w-full" delay={80} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {['a', 'b', 'c', 'd'].map((key, index) => (
          <div key={key} className="rounded-3xl bg-surface-2 px-5 py-5">
            <SkeletonBar className="h-3 w-16" delay={index * 60} />
            <SkeletonBar className="mt-2 h-5 w-12" delay={80 + index * 60} />
          </div>
        ))}
      </div>
      <div>
        <SkeletonBar className="mb-2 h-3 w-24" />
        <ChartSkeleton />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {['e', 'f', 'g', 'h'].map((key, index) => (
          <div key={key} className="rounded-3xl bg-card px-5 py-5">
            <SkeletonBar className="h-3 w-20" delay={index * 70} />
            <SkeletonBar className="mt-3 h-1.5 w-full" delay={80 + index * 70} />
          </div>
        ))}
      </div>
    </div>
  )
}
