import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getServicesGrouped } from '@/lib/actions/token'
import TokenFlow from './token-flow'
import { WizardSkeleton } from '@/components/skeletons'

export default async function TokenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in to get a token.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, account_status, phone')
    .eq('id', user.id)
    .single<Profile>()

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <Suspense fallback={<WizardSkeleton />}>
          <TokenDataLoader userId={user.id} />
        </Suspense>
      </main>
    </div>
  )
}

async function TokenDataLoader({ userId }: { userId: string }) {
  const departments = await getServicesGrouped()
  return <TokenFlow departments={departments} userId={userId} />
}
