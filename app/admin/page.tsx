import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getAdminData } from '@/lib/actions/admin'
import AdminPanelClient from './admin-panel-client'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in.')

  // Parallel: profile + all admin data in one shot
  const [{ data: profile }, adminData] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role, account_status').eq('id', user.id).single<Profile>(),
    getAdminData(),
  ])

  if (!profile || profile.role !== 'admin') {
    redirect('/login?message=You need administrator access to view that page.')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <AdminPanelClient initialData={adminData} adminEmail={profile.email ?? ''} />
      </main>
    </div>
  )
}
