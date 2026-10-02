import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { getServicesGrouped } from '@/lib/actions/token'
import BookWizard from './book-wizard'
import { WizardSkeleton } from '@/components/skeletons'

export default async function BookPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?message=Please sign in to book an appointment.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, account_status, phone')
    .eq('id', user.id)
    .single<Profile>()

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <Suspense fallback={<WizardSkeleton />}>
          <BookDataLoader userEmail={profile?.email ?? user.email ?? ''} />
        </Suspense>
      </main>
    </div>
  )
}

async function BookDataLoader({ userEmail }: { userEmail: string }) {
  const departments = await getServicesGrouped()
  return <BookWizard departments={departments} userEmail={userEmail} />
}
