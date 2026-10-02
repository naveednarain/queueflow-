import { NavbarSkeleton, CounterCardSkeleton } from '@/components/skeletons'

export default function StaffLoading() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <NavbarSkeleton />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-44 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-4 w-60 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-xl bg-gray-200" />
        </div>
        {/* Counter cards */}
        <CounterCardSkeleton count={3} />
        {/* Queue list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="h-5 w-36 animate-pulse rounded-lg bg-gray-200" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-t border-gray-50">
              <div className="w-12 h-10 animate-pulse rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-7 w-16 animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
