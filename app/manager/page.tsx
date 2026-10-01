import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { BarChart3, TrendingUp, Users, Zap } from 'lucide-react'
import BackButton from '@/components/back-button'

import { markMissedAppointments } from '@/lib/actions/appointment'

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

  // Lazily clean up missed appointments
  await markMissedAppointments().catch(() => {})

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Manager Dashboard</h1>
                <p className="text-sm text-gray-500">Analytics, AI insights, and settings</p>
              </div>
            </div>
            <BackButton fallbackHref="/" />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">🚧 Coming in Phase 6</p>
            <p className="text-sm text-amber-700 mt-1">
              Stats cards, Recharts graphs, AI insights, no-show trends, and counter management panel will be added in Phase 6.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-50">
            {[
              { icon: <Users className="w-5 h-5 text-purple-500" />, label: 'Appointments Today', value: '—' },
              { icon: <TrendingUp className="w-5 h-5 text-purple-500" />, label: 'Avg Wait Time', value: '— min' },
              { icon: <BarChart3 className="w-5 h-5 text-purple-500" />, label: 'Completed', value: '—' },
              { icon: <Zap className="w-5 h-5 text-purple-500" />, label: 'Active Counters', value: '—' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-4 flex flex-col items-center gap-1 text-center">
                {s.icon}
                <span className="text-2xl font-bold text-gray-300">{s.value}</span>
                <span className="text-xs text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 text-sm text-gray-400">
            Signed in as <span className="font-medium text-gray-600">{profile.email}</span>
            {' '}· Role: <span className="font-medium text-purple-600 capitalize">{profile.role}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
