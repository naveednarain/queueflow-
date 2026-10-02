import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getCounters } from '@/lib/actions/staff'
import { markMissedAppointments } from '@/lib/actions/appointment'
import StaffClient from './staff-client'
import { StaffPageSkeleton } from '@/components/skeletons'

export default async function StaffPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, account_status, phone')
    .eq('id', user.id)
    .single<Profile>()

  const allowedRoles = ['staff', 'manager', 'admin']
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/login?message=You need staff access to view that page.')
  }

  // Next.js streams the Navbar and StaffPageSkeleton instantly!
  // Live counter data streams in as soon as fetched.
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<StaffPageSkeleton />}>
          <StaffDataLoader
            userEmail={profile.email ?? ''}
            userRole={profile.role}
          />
        </Suspense>
      </main>
    </div>
  )
}

async function StaffDataLoader({
  userEmail,
  userRole,
}: {
  userEmail: string
  userRole: string
}) {
  const [counters] = await Promise.all([
    getCounters(),
    Promise.resolve(markMissedAppointments()).catch(() => 0),
  ])

  return (
    <StaffClient
      initialCounters={counters}
      userEmail={userEmail}
      userRole={userRole}
    />
  )
}
