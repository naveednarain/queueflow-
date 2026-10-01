import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getServicesGrouped } from '@/lib/actions/token'
import BookWizard from './book-wizard'

export const dynamic = 'force-dynamic'

export default async function BookPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in to book an appointment.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  const departments = await getServicesGrouped()

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <BookWizard
          departments={departments}
          userEmail={profile?.email ?? user.email ?? ''}
        />
      </main>
    </div>
  )
}
