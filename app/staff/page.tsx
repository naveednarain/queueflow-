import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getCounters } from '@/lib/actions/staff'
import { markMissedAppointments } from '@/lib/actions/appointment'
import StaffClient from './staff-client'

export default async function StaffPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  const allowedRoles = ['staff', 'manager', 'admin']
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/login?message=You need staff access to view that page.')
  }

  // Lazily update any past appointments that missed check-in window
  await markMissedAppointments().catch(() => {})

  const counters = await getCounters()

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <StaffClient
          initialCounters={counters}
          userEmail={profile.email ?? ''}
          userRole={profile.role}
        />
      </main>
    </div>
  )
}
