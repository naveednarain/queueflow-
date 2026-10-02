import { NavbarSkeleton, WizardSkeleton } from '@/components/skeletons'

export default function BookLoading() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <NavbarSkeleton />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <WizardSkeleton />
      </main>
    </div>
  )
}
