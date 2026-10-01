import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import type { Profile } from '@/lib/types'
import {
  Calendar,
  Ticket,
  Clock,
  CheckCircle,
  BarChart3,
  Smartphone,
  ArrowRight,
  Users,
} from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-[#22C55E]/10 text-[#22C55E] text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          No more standing in line
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 max-w-3xl leading-tight mb-6">
          Smart queues for{' '}
          <span className="text-[#22C55E]">modern services</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-xl mb-10">
          Book appointments or join a digital queue at banks, clinics,
          universities, and government offices. See your live position and
          estimated wait time — anywhere, on any device.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/book"
            id="book-appointment-btn"
            className="inline-flex items-center gap-2 bg-[#22C55E] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#16A34A] transition-colors shadow-lg shadow-green-200"
          >
            <Calendar className="w-5 h-5" />
            Book Appointment
          </Link>
          <Link
            href="/token"
            id="get-token-btn"
            className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
          >
            <Ticket className="w-5 h-5 text-[#22C55E]" />
            Get Token
            <ArrowRight className="w-4 h-4 text-gray-400" />
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl w-full">
          {[
            { label: 'Avg. Wait Saved', value: '24 min', icon: <Clock className="w-5 h-5 text-[#22C55E]" /> },
            { label: 'No-show Rate', value: '↓ 40%', icon: <CheckCircle className="w-5 h-5 text-[#22C55E]" /> },
            { label: 'Departments', value: '3+', icon: <BarChart3 className="w-5 h-5 text-[#22C55E]" /> },
            { label: 'Works on', value: 'Any device', icon: <Smartphone className="w-5 h-5 text-[#22C55E]" /> },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col items-center gap-1"
            >
              {stat.icon}
              <span className="text-xl font-bold text-gray-900">{stat.value}</span>
              <span className="text-xs text-gray-500 text-center">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-t border-gray-100 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Calendar className="w-6 h-6 text-[#22C55E]" />,
                title: 'Appointment Booking',
                desc: 'Choose a department, service, date, and slot. Receive a reference number and reminders.',
              },
              {
                icon: <Ticket className="w-6 h-6 text-[#22C55E]" />,
                title: 'Walk-in Tokens',
                desc: 'Generate a token instantly. Wait anywhere and return only when it&apos;s your turn.',
              },
              {
                icon: <Clock className="w-6 h-6 text-[#22C55E]" />,
                title: 'Live Wait Estimates',
                desc: 'AI-powered estimates based on real queue data and active counters.',
              },
              {
                icon: <Users className="w-6 h-6 text-[#22C55E]" />,
                title: 'Staff Workflow',
                desc: 'One-click token calling, start, complete, skip, and recall from the staff dashboard.',
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-[#22C55E]" />,
                title: 'Manager Analytics',
                desc: 'Queue trends, peak hours, no-show rates, and AI-generated operational insights.',
              },
              {
                icon: <Smartphone className="w-6 h-6 text-[#22C55E]" />,
                title: 'Mobile-first',
                desc: 'Customers track their queue on any phone. No app download required.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-[#F5F5F5] rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-3 shadow-sm">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} QueueFlow — Built for the hackathon
      </footer>
    </div>
  )
}
