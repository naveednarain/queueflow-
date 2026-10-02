import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getAdminData } from '@/lib/actions/admin'
import AdminPanelClient from './admin-panel-client'
import { AdminPageSkeleton } from '@/components/skeletons'

export default async function AdminPage() {
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

  if (!profile || profile.role !== 'admin') {
    redirect('/login?message=You need administrator access to view that page.')
  }

  // Next.js streams the Navbar and AdminPageSkeleton instantly!
  // Data is fetched in the background by AdminDataLoader and streamed in.
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<AdminPageSkeleton />}>
          <AdminDataLoader adminEmail={profile.email ?? ''} />
        </Suspense>
      </main>
    </div>
  )
}

async function AdminDataLoader({ adminEmail }: { adminEmail: string }) {
  const adminData = await getAdminData()
  return <AdminPanelClient initialData={adminData} adminEmail={adminEmail} />
}
