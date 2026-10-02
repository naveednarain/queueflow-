'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  ClipboardList,
  Monitor,
  Users,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
  Bell,
  ArrowLeft,
} from 'lucide-react'
import type { Profile } from '@/lib/types'
import { logout } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from './notification-bell'

interface NavbarProps {
  profile: Profile | null
}

interface NavLink {
  href: string
  label: string
  icon: React.ReactNode
  roles: string[]
}

const navLinks: NavLink[] = [
  {
    href: '/',
    label: 'Home',
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ['customer', 'staff', 'manager', 'admin'],
  },
  {
    href: '/book',
    label: 'Book Appointment',
    icon: <Calendar className="w-4 h-4" />,
    roles: ['customer'],
  },
  {
    href: '/token',
    label: 'Get Token',
    icon: <Ticket className="w-4 h-4" />,
    roles: ['customer'],
  },
  {
    href: '/my',
    label: 'My Queue',
    icon: <ClipboardList className="w-4 h-4" />,
    roles: ['customer'],
  },
  {
    href: '/display',
    label: 'Display Board',
    icon: <Monitor className="w-4 h-4" />,
    roles: ['customer', 'staff', 'manager', 'admin'],
  },
  {
    href: '/staff',
    label: 'Counter',
    icon: <Users className="w-4 h-4" />,
    roles: ['staff', 'manager', 'admin'],
  },
  {
    href: '/manager',
    label: 'Dashboard',
    icon: <BarChart3 className="w-4 h-4" />,
    roles: ['manager', 'admin'],
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: <Shield className="w-4 h-4" />,
    roles: ['admin'],
  },
]

export default function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const role = profile?.role ?? 'customer'
  const visibleLinks = profile
    ? navLinks.filter((l) => l.roles.includes(role))
    : navLinks.filter((l) => l.roles.includes('customer'))

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // Ignored if client session was already cleared
      }
      toast.success('Signed out successfully')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Failed to sign out. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    manager: 'bg-purple-100 text-purple-700',
    staff: 'bg-blue-100 text-blue-700',
    customer: 'bg-green-100 text-green-700',
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Back button */}
          <div className="flex items-center gap-2">
            {pathname !== '/' && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back()
                  } else {
                    router.push('/')
                  }
                }}
                className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Go back"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <div className="w-8 h-8 rounded-lg bg-[#22C55E] flex items-center justify-center">
                <Ticket className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-900">QueueFlow</span>
            </Link>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {visibleLinks.map((link) => {
              const active =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={true}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 active:opacity-70 ${
                    active
                      ? 'bg-[#22C55E]/10 text-[#22C55E]'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {profile ? (
              <>
                <NotificationBell userId={profile.id} />
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E] font-semibold text-sm">
                    {(profile.name ?? profile.email ?? 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 leading-tight">
                      {profile.name ?? profile.email}
                    </span>
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize self-start ${
                        roleBadgeColor[role] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {loggingOut ? 'Signing out…' : 'Sign out'}
                  </span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#22C55E] text-white hover:bg-[#16A34A] transition-colors"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-2">
          {profile && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E] font-semibold text-sm">
                  {(profile.name ?? profile.email ?? 'U')[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-900 leading-tight">
                    {profile.name ?? profile.email}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.2 rounded capitalize self-start ${
                      roleBadgeColor[role] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {role}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {visibleLinks.map((link) => {
              const active =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 active:opacity-70 ${
                    active
                      ? 'bg-[#22C55E]/10 text-[#22C55E]'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              )
            })}
          </div>

          {profile && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setMobileOpen(false)
                  handleLogout()
                }}
                disabled={loggingOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
