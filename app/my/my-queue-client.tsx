'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Ticket,
  Clock,
  Users,
  Bell,
  BellOff,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Calendar,
  CalendarCheck,
  Building2,
  Trash2,
  ArrowRight,
  Sparkles,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import BackButton from '@/components/back-button'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead } from '@/lib/actions/token'
import {
  checkInAppointment,
  cancelAppointment,
  getUserAppointments,
  rescheduleAppointment,
} from '@/lib/actions/appointment'
import type { Token, Notification, AppointmentWithDetails } from '@/lib/types'

interface Props {
  userId: string
  initialToken: Token | null
  initialAppointments: AppointmentWithDetails[]
  initialHistory: (Token & { services: { name: string; prefix: string } | null; counters: { name: string } | null })[]
  initialNotifications: Notification[]
}

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-800 border-amber-200',
  called: 'bg-blue-100 text-blue-800 border-blue-200',
  recalled: 'bg-purple-100 text-purple-800 border-purple-200',
  in_service: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  missed: 'bg-red-100 text-red-700 border-red-200',
  skipped: 'bg-orange-100 text-orange-700 border-orange-200',
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting in line',
  called: 'Called — please proceed to your counter',
  recalled: 'Recalled — please proceed immediately',
  in_service: 'Currently being served',
  completed: 'Service completed',
  missed: 'Marked as missed',
  skipped: 'Skipped',
}

export default function MyQueueClient({
  userId,
  initialToken,
  initialAppointments,
  initialHistory,
  initialNotifications,
}: Props) {
  const [activeToken, setActiveToken] = useState<Token | null>(initialToken)
  const [checkingToken, setCheckingToken] = useState<boolean>(!initialToken)
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(initialAppointments)
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [showNotifications, setShowNotifications] = useState(false)
  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'history'>('queue')
  const [actionPending, setActionPending] = useState(false)
  const [rescheduleModalAppt, setRescheduleModalAppt] = useState<AppointmentWithDetails | null>(null)

  // Keep activeToken in sync if server provides fresh initialToken
  useEffect(() => {
    if (initialToken) {
      setActiveToken(initialToken)
      setCheckingToken(false)
    }
  }, [initialToken])

  // Immediate client-side verification on mount if no initial token
  useEffect(() => {
    let isMounted = true
    const checkImmediate = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('tokens')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['waiting', 'called', 'recalled', 'in_service'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (isMounted) {
          if (data) {
            setActiveToken(data as Token)
          }
          setCheckingToken(false)
        }
      } catch {
        if (isMounted) setCheckingToken(false)
      }
    }

    if (!initialToken) {
      checkImmediate()
    } else {
      setCheckingToken(false)
    }

    return () => {
      isMounted = false
    }
  }, [userId, initialToken])

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const unreadCount = notifications.filter((n) => !n.read).length

  // Refresh appointments
  const refreshAppointments = useCallback(async () => {
    try {
      const appts = await getUserAppointments(userId)
      setAppointments(appts)
    } catch (err) {
      console.error('Failed to refresh appointments:', err)
    }
  }, [userId])

  // ── Realtime subscription ────────────────────────────────
  const subscribeRealtime = useCallback(() => {
    const supabase = createClient()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`my-account-channel-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tokens',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Token
          if (!updated) return

          const activeStatuses = ['waiting', 'called', 'recalled', 'in_service']
          if (activeStatuses.includes(updated.status)) {
            setActiveToken((prev) => {
              if (prev && prev.status !== updated.status) {
                if (updated.status === 'called') {
                  toast.success(`Token ${updated.token_number} has been called! Please proceed to your counter.`, { duration: 8000 })
                } else if (updated.status === 'recalled') {
                  toast.warning(`Token ${updated.token_number} recalled — please proceed immediately.`, { duration: 8000 })
                }
              }
              return updated
            })
          } else {
            setActiveToken(null)
            if (updated.status === 'completed') {
              toast.success('Your service is complete. Thank you!')
            } else if (updated.status === 'missed') {
              toast.error('Your token was marked as missed.')
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refreshAppointments()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
          toast.info(newNotif.message, { duration: 6000 })
        }
      )
      .subscribe()

    channelRef.current = channel
    return channel
  }, [userId, refreshAppointments])

  useEffect(() => {
    subscribeRealtime()
    return () => {
      const supabase = createClient()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [subscribeRealtime])

  // ── Polling Fallback (Fast 3s interval) ───────────────────────
  useEffect(() => {
    const supabase = createClient()
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['waiting', 'called', 'recalled', 'in_service'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setActiveToken((prev) => {
        if (!data) return prev?.status && ['waiting', 'called', 'recalled', 'in_service'].includes(prev.status) ? null : prev
        return data as Token
      })
      setCheckingToken(false)
    }, 3000)
    return () => clearInterval(poll)
  }, [userId])

  // ── Handlers ──────────────────────────────────────────────────
  const handleMarkRead = async (notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    )
    await markNotificationRead(notifId)
  }

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await Promise.all(unread.map((n) => markNotificationRead(n.id)))
  }

  const handleCheckIn = async (appointmentId: string) => {
    if (actionPending) return
    setActionPending(true)
    try {
      const res = await checkInAppointment(appointmentId)
      if (res.error) {
        toast.error(res.error)
      } else if (res.token) {
        toast.success(`Checked in successfully! Priority Token ${res.token.token_number} issued.`, { duration: 6000 })
        setActiveToken(res.token)
        setActiveTab('queue')
        await refreshAppointments()
      }
    } catch {
      toast.error('Check-in failed. Please try again.')
    } finally {
      setActionPending(false)
    }
  }

  const handleCancelAppointment = async (appointmentId: string, refNo: string | null) => {
    if (actionPending) return
    if (!confirm(`Are you sure you want to cancel appointment ${refNo || ''}?`)) return
    setActionPending(true)
    try {
      const res = await cancelAppointment(appointmentId)
      if (!res.success) {
        toast.error(res.error || 'Failed to cancel appointment')
      } else {
        toast.success(`Appointment ${refNo || ''} has been cancelled.`)
        await refreshAppointments()
      }
    } catch {
      toast.error('Failed to cancel appointment')
    } finally {
      setActionPending(false)
    }
  }

  // Format time (e.g. 10:00:00 -> 10:00 AM)
  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${m} ${ampm}`
  }

  // Check-In window status helper
  const getWindowStatus = (appt: AppointmentWithDetails) => {
    if (appt.status === 'checked_in' || appt.status === 'waiting' || appt.status === 'in_service') {
      return { canCheckIn: false, label: 'Checked In', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    }
    if (appt.status === 'completed') {
      return { canCheckIn: false, label: 'Completed', badge: 'bg-gray-100 text-gray-600 border-gray-200' }
    }
    if (appt.status === 'cancelled') {
      return { canCheckIn: false, label: 'Cancelled', badge: 'bg-rose-50 text-rose-700 border-rose-200' }
    }
    if (appt.status === 'missed') {
      return { canCheckIn: false, label: 'Missed', badge: 'bg-rose-50 text-rose-700 border-rose-200' }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const isToday = appt.appointment_date === todayStr

    const apptDateTime = new Date(`${appt.appointment_date}T${appt.start_time}`)
    const now = new Date()

    // 10 minutes early, 10 minutes late
    const earlyWindow = new Date(apptDateTime.getTime() - 10 * 60 * 1000)
    const lateWindow = new Date(apptDateTime.getTime() + 10 * 60 * 1000)

    if (!isToday && apptDateTime > now) {
      return {
        canCheckIn: false,
        label: 'Opens on date of visit',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    }

    if (now < earlyWindow) {
      const opensStr = earlyWindow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return {
        canCheckIn: false,
        label: `Opens at ${opensStr}`,
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    }

    if (now > lateWindow) {
      return {
        canCheckIn: false,
        label: 'Window Closed',
        badge: 'bg-gray-100 text-gray-500 border-gray-200',
      }
    }

    return {
      canCheckIn: true,
      label: 'CHECK IN AVAILABLE',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }

  const upcomingAppts = appointments.filter(
    (a) => a.status === 'confirmed' || a.status === 'booked' || a.status === 'checked_in'
  )

  return (
    <div className="space-y-6">
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" />
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Queue & Bookings</h1>
            <p className="text-xs text-gray-500">Live ticket tracker and appointment pass</p>
          </div>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 shadow-xs transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            {unreadCount > 0 ? (
              <Bell className="w-4 h-4 text-[#22C55E]" />
            ) : (
              <BellOff className="w-4 h-4 text-gray-400" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#22C55E] rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <span className="font-bold text-sm text-gray-900">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#22C55E] font-medium hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 15).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleMarkRead(notif.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notif.read ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mt-1.5 shrink-0" />
                        )}
                        <div>
                          <p className="text-xs text-gray-700 leading-snug">{notif.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(notif.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Segmented Tab Selector ─────────────────────────────────── */}
      <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200/80">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>Live Queue</span>
          {activeToken && (
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'appointments'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Appointments</span>
          {upcomingAppts.length > 0 && (
            <span className="bg-[#22C55E]/15 text-[#22C55E] font-bold text-[10px] px-1.5 py-0.2 rounded-full">
              {upcomingAppts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </div>

      {/* ── TAB 1: Live Queue ──────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {checkingToken ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-5 w-36 bg-gray-200 rounded-lg" />
                <div className="h-5 w-28 bg-gray-200 rounded-full" />
              </div>
              <div className="py-6 text-center space-y-3">
                <div className="h-16 w-36 bg-gray-200 rounded-2xl mx-auto" />
                <div className="h-4 w-48 bg-gray-200 rounded mx-auto" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="h-20 bg-gray-100 rounded-2xl" />
                <div className="h-20 bg-gray-100 rounded-2xl" />
              </div>
            </div>
          ) : activeToken ? (
            <ActiveTokenCard token={activeToken} />
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 text-gray-400 mx-auto flex items-center justify-center mb-4">
                <Ticket className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No Active Ticket</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-6">
                You do not currently have a waiting ticket. Get a walk-in token or book a priority appointment.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/token"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#22C55E] hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-green-200 text-xs transition-all"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Get Walk-in Token</span>
                </Link>

                <Link
                  href="/book"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold px-6 py-3 rounded-xl border border-gray-200 text-xs transition-all"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book Appointment</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Appointments ────────────────────────────────────── */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Upcoming & Past Appointments ({appointments.length})
            </span>
            <Link
              href="/book"
              className="text-xs font-bold text-[#22C55E] hover:underline inline-flex items-center gap-1"
            >
              <span>+ Book New</span>
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900">No Appointments Booked</h3>
              <p className="text-xs text-gray-500 mt-1 mb-5">
                Reserve your spot in advance and skip regular walk-in wait times.
              </p>
              <Link
                href="/book"
                className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-green-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-green-200 text-xs transition-all"
              >
                <span>Book an Appointment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const win = getWindowStatus(appt)
                const isCheckedIn = appt.status === 'checked_in' || appt.status === 'waiting' || appt.status === 'in_service'

                return (
                  <div
                    key={appt.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 transition-all hover:shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#22C55E] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            {appt.ref_no}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${win.badge}`}
                          >
                            {win.label}
                          </span>
                        </div>

                        <h3 className="font-bold text-gray-900 text-base mt-2">
                          {appt.services?.name ?? 'Service'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {appt.services?.departments?.name ?? 'Department Office'}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {appt.appointment_date}
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
                          </span>
                        </div>
                      </div>

                      {/* Check-in / Actions Area */}
                      <div className="flex flex-col sm:items-end gap-2 shrink-0">
                        {win.canCheckIn && (
                          <button
                            type="button"
                            onClick={() => handleCheckIn(appt.id)}
                            disabled={actionPending}
                            className="bg-[#22C55E] hover:bg-green-600 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md shadow-green-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <CalendarCheck className="w-4 h-4" />
                            <span>CHECK IN NOW</span>
                          </button>
                        )}

                        {isCheckedIn && (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-xl">
                            Checked In · Priority Token Active
                          </div>
                        )}

                        {appt.status === 'confirmed' && (
                          <div className="flex items-center gap-2 mt-1">
                            <Link
                              href={`/book`}
                              className="text-[11px] font-semibold text-blue-600 hover:underline"
                            >
                              Reschedule
                            </Link>
                            <span className="text-gray-300">·</span>
                            <button
                              type="button"
                              onClick={() => handleCancelAppointment(appt.id, appt.ref_no)}
                              disabled={actionPending}
                              className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: History ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-gray-500" />
            <h3 className="font-bold text-gray-900 text-sm">Past Ticket History</h3>
          </div>

          {initialHistory.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">
              No completed visits yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {initialHistory.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-gray-800">{item.token_number}</span>
                    <span className="text-gray-400 ml-2">{item.services?.name ?? 'Service'}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Active Token Card Sub-component
// ────────────────────────────────────────────────────────────
function ActiveTokenCard({ token }: { token: Token }) {
  const isCalled = token.status === 'called' || token.status === 'recalled'
  const peopleAhead = token.queue_position != null ? Math.max(0, token.queue_position - 1) : null

  return (
    <div
      className={`rounded-3xl border shadow-sm overflow-hidden transition-all ${
        isCalled
          ? 'border-blue-300 ring-2 ring-blue-500 shadow-lg shadow-blue-100'
          : 'border-gray-100 bg-white'
      }`}
    >
      {/* Status banner */}
      <div
        className={`px-6 py-5 ${
          isCalled
            ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white'
            : token.status === 'in_service'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white'
            : 'bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
            <Ticket className="w-4 h-4" />
            <span>Active Live Ticket</span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isCalled || token.status === 'in_service'
                ? 'bg-white/20 text-white'
                : STATUS_COLORS[token.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            {STATUS_LABEL[token.status] ?? token.status}
          </span>
        </div>

        <div className="mt-3">
          <div
            className={`text-6xl font-mono font-black tracking-wider ${
              isCalled || token.status === 'in_service' ? 'text-white' : 'text-gray-900'
            }`}
          >
            {token.token_number}
          </div>
        </div>
      </div>

      {/* Live Metrics */}
      {!isCalled && token.status !== 'in_service' && (
        <div className="bg-white p-6 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <Users className="w-5 h-5 text-[#22C55E]" />
            <span className="text-3xl font-black text-gray-900">
              {peopleAhead !== null ? peopleAhead : '—'}
            </span>
            <span className="text-xs text-gray-500 text-center font-medium">People ahead of you</span>
          </div>

          <div
            className="flex flex-col items-center gap-1 bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100/80 relative group cursor-help transition-all hover:bg-emerald-50"
            title="AI-estimated wait based on 20 recent completed services and live counter throughput"
          >
            <div className="flex items-center gap-1 text-[#16A34A]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">AI Estimate</span>
            </div>
            <span className="text-3xl font-black text-gray-900">
              {token.estimated_wait != null ? token.estimated_wait : '—'}
            </span>
            <span className="text-xs text-gray-600 text-center font-medium">AI-estimated wait (mins)</span>
            <span className="text-[10px] text-gray-400 group-hover:text-emerald-700 transition-colors">
              based on 20 recent services
            </span>
          </div>
        </div>
      )}

      {/* Called alert message */}
      {(isCalled || token.status === 'in_service') && (
        <div className="bg-white p-6">
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm text-blue-900 font-bold">
                {token.status === 'in_service'
                  ? 'Your service is currently underway.'
                  : 'Your number has been called!'}
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                {token.status === 'in_service'
                  ? 'Please follow the counter staff instructions.'
                  : 'Please walk to your counter immediately to avoid being marked as missed.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="bg-gray-50/70 border-t border-gray-100 px-6 py-3 flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-[#22C55E] animate-spin" />
          <span>Live real-time sync active</span>
        </span>
        <span className="italic">You can wait nearby instead of standing in line.</span>
      </div>
    </div>
  )
}
