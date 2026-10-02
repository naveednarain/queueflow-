import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getServicesGrouped } from '@/lib/actions/token'
import TokenFlow from './token-flow'

export const dynamic = 'force-dynamic'

export default async function TokenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in to get a token.')

  // Parallel fetch: profile + services in one round-trip
  const [{ data: profile }, departments] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single<Profile>(),
    getServicesGrouped(),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <TokenFlow departments={departments} userId={user.id} />
      </main>
    </div>
  )
}
