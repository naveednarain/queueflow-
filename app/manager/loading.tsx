import { NavbarSkeleton, CardGridSkeleton, TableSkeleton, ChartSkeleton } from '@/components/skeletons'

export default function ManagerLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <NavbarSkeleton />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-4 w-64 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-xl bg-gray-200" />
        </div>
        {/* Stats cards */}
        <CardGridSkeleton count={4} />
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        {/* Table */}
        <TableSkeleton rows={4} />
      </main>
    </div>
  )
}
