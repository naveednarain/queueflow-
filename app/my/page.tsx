import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getActiveToken, getTokenHistory, getUserNotifications } from '@/lib/actions/token'
import { getUserAppointments } from '@/lib/actions/appointment'
import MyQueueClient from './my-queue-client'

export default async function MyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in to view your queue status.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  // Fetch initial data server-side for fast first paint
  const [activeToken, appointments, history, notifications] = await Promise.all([
    getActiveToken(user.id),
    getUserAppointments(user.id),
    getTokenHistory(user.id),
    getUserNotifications(user.id),
  ])

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 md:py-10">
        <MyQueueClient
          userId={user.id}
          initialToken={activeToken}
          initialAppointments={appointments}
          initialHistory={history as any}
          initialNotifications={notifications as any}
        />
      </main>
    </div>
  )
}
