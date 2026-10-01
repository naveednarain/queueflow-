import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import { redirect } from 'next/navigation'
import { Shield, Building2, UserCog, Settings } from 'lucide-react'
import BackButton from '@/components/back-button'

export default async function AdminPage() {
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

  if (!profile || profile.role !== 'admin') {
    redirect('/login?message=You need administrator access to view that page.')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-sm text-gray-500">Departments, users, services, rules, activity log</p>
              </div>
            </div>
            <BackButton fallbackHref="/" />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">🚧 Coming in Phase 7</p>
            <p className="text-sm text-amber-700 mt-1">
              Departments management, user role assignment, service rules, and activity log will be added in Phase 7.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-50">
            {[
              { icon: <Building2 className="w-5 h-5 text-red-500" />, label: 'Departments', value: '0' },
              { icon: <UserCog className="w-5 h-5 text-red-500" />, label: 'Users', value: '0' },
              { icon: <Settings className="w-5 h-5 text-red-500" />, label: 'Services', value: '0' },
              { icon: <Shield className="w-5 h-5 text-red-500" />, label: 'Rules', value: '0' },
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
            {' '}· Role: <span className="font-medium text-red-600 capitalize">{profile.role}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
