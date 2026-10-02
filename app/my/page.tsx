import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getActiveToken, getTokenHistory, getUserNotifications } from '@/lib/actions/token'
import { getUserAppointments } from '@/lib/actions/appointment'
import MyQueueClient from './my-queue-client'
import { MyQueueSkeleton } from '@/components/skeletons'

export default async function MyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in to view your queue status.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, account_status, phone')
    .eq('id', user.id)
    .single<Profile>()

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 md:py-10">
        <Suspense fallback={<MyQueueSkeleton />}>
          <MyQueueDataLoader userId={user.id} />
        </Suspense>
      </main>
    </div>
  )
}

async function MyQueueDataLoader({ userId }: { userId: string }) {
  const [activeToken, appointments, history, notifications] = await Promise.all([
    getActiveToken(userId),
    getUserAppointments(userId),
    getTokenHistory(userId),
    getUserNotifications(userId),
  ])

  return (
    <MyQueueClient
      userId={userId}
      initialToken={activeToken}
      initialAppointments={appointments}
      initialHistory={history as any}
      initialNotifications={notifications as any}
    />
  )
}
