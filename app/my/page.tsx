import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getMyQueueData } from '@/lib/actions/token'
import MyQueueClient from './my-queue-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in to view your queue status.')

  // Fetch profile and complete queue data in parallel
  const [profileRes, queueData] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, role, account_status, phone')
      .eq('id', user.id)
      .single<Profile>(),
    getMyQueueData(user.id),
  ])

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar profile={profileRes.data} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 md:py-10">
        <MyQueueClient
          userId={user.id}
          initialToken={queueData.activeToken}
          initialAppointments={queueData.appointments}
          initialHistory={queueData.history as any}
          initialNotifications={queueData.notifications as any}
        />
      </main>
    </div>
  )
}
