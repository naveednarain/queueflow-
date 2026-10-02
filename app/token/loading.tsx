import { NavbarSkeleton, WizardSkeleton } from '@/components/skeletons'

export default function TokenLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavbarSkeleton />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-4 w-64 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <WizardSkeleton />
      </main>
    </div>
  )
}
