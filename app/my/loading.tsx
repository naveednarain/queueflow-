import { NavbarSkeleton, MyQueueSkeleton } from '@/components/skeletons'

export default function MyQueueLoading() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <NavbarSkeleton />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 md:py-10">
        <div className="space-y-2 mb-6">
          <div className="h-7 w-36 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-4 w-56 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <MyQueueSkeleton />
      </main>
    </div>
  )
}
