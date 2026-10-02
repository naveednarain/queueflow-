import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { markMissedAppointments } from '@/lib/actions/appointment'
import { fetchDashboardStats, getManagementData } from '@/lib/actions/manager'
import ManagerDashboardClient from './manager-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function ManagerPage() {
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

  const allowedRoles = ['manager', 'admin']
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/login?message=You need manager access to view that page.')
  }

  // All 3 run in parallel: stats, management config, and maintenance cleanup
  const [statsRes, mgmtData] = await Promise.all([
    fetchDashboardStats(),
    getManagementData(),
    markMissedAppointments().catch(() => {}),
  ])

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <ManagerDashboardClient
          initialData={statsRes.data}
          initialCounters={mgmtData.counters}
          initialServices={mgmtData.services}
          initialDepartments={mgmtData.departments}
          staffList={mgmtData.staffList}
          userEmail={profile.email || user.email || ''}
          userRole={profile.role}
        />
      </main>
    </div>
  )
}
