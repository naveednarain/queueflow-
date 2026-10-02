import { NavbarSkeleton, CardGridSkeleton } from '@/components/skeletons'

export default function DisplayLoading() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header skeleton */}
      <header className="sticky top-0 z-30 bg-white/90 border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 animate-pulse rounded-xl bg-gray-200" />
            <div className="space-y-1">
              <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-20 h-9 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <CardGridSkeleton count={4} />
      </main>
    </div>
  )
}
