import { NavbarSkeleton, TableSkeleton, CardGridSkeleton } from '@/components/skeletons'

export default function AdminLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <NavbarSkeleton />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-4 w-56 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-xl bg-gray-200" />
        </div>
        {/* Tab bar */}
        <div className="flex gap-2">
          {[80, 100, 88, 72, 96].map((w, i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-gray-200" style={{ width: w }} />
          ))}
        </div>
        {/* Stats summary */}
        <CardGridSkeleton count={4} />
        {/* Main table */}
        <TableSkeleton rows={6} />
      </main>
    </div>
  )
}
