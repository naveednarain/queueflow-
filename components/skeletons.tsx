import React from 'react'

/** Animated shimmer skeleton block */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  )
}

/** Full navbar skeleton (matches real navbar height) */
export function NavbarSkeleton() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm h-16 flex items-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-24 h-5" />
        </div>
        <div className="hidden md:flex items-center gap-2">
          {[80, 100, 72, 96, 88].map((w, i) => (
            <Skeleton key={i} className={`h-8 rounded-lg`} style={{ width: w }} />
          ))}
        </div>
        <Skeleton className="w-20 h-8 rounded-lg" />
      </div>
    </nav>
  )
}

/** Card grid skeleton for dashboard/admin pages */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-16 h-5 rounded-full" />
          </div>
          <Skeleton className="w-20 h-8" />
          <Skeleton className="w-32 h-4" />
        </div>
      ))}
    </div>
  )
}

/** Table skeleton for list pages */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-24 h-8 rounded-lg" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="w-40 h-4" />
                <Skeleton className="w-28 h-3" />
              </div>
            </div>
            <Skeleton className="w-16 h-6 rounded-full shrink-0" />
            <Skeleton className="w-20 h-7 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Counter card skeleton for staff page */
export function CounterCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="w-28 h-5" />
              <Skeleton className="w-20 h-4" />
            </div>
            <Skeleton className="w-20 h-7 rounded-full" />
          </div>
          <div className="bg-gray-50 rounded-xl p-6 flex flex-col items-center gap-2">
            <Skeleton className="w-24 h-16" />
            <Skeleton className="w-32 h-4" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-10 rounded-xl" />
            <Skeleton className="flex-1 h-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Chart skeleton for manager dashboard */
export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-36 h-5" />
        <Skeleton className="w-20 h-7 rounded-lg" />
      </div>
      <div className="flex items-end gap-2 h-40">
        {[60, 80, 45, 90, 55, 70, 40, 85, 65, 75].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

/** Wizard step skeleton for book/token pages */
export function WizardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <Skeleton className="w-8 h-8 rounded-full" />
            {s < 3 && <Skeleton className="flex-1 h-1" />}
          </React.Fragment>
        ))}
      </div>
      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <Skeleton className="w-48 h-6" />
        <Skeleton className="w-full h-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** My queue skeleton */
export function MyQueueSkeleton() {
  return (
    <div className="space-y-5">
      {/* Active token card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="w-32 h-6" />
          <Skeleton className="w-20 h-6 rounded-full" />
        </div>
        <div className="text-center py-4 space-y-2">
          <Skeleton className="w-28 h-16 mx-auto" />
          <Skeleton className="w-40 h-4 mx-auto" />
          <Skeleton className="w-32 h-4 mx-auto" />
        </div>
      </div>
      {/* Appointments list */}
      <TableSkeleton rows={3} />
    </div>
  )
}
