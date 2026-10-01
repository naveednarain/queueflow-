'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Ticket, Calendar, Clock, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/actions/token'
import type { Notification } from '@/lib/types'

interface NotificationBellProps {
  userId: string
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Fetch initial notifications
  useEffect(() => {
    const supabase = createClient()

    async function loadNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(25)

      if (data) {
        setNotifications(data as Notification[])
      }
    }

    loadNotifications()

    // Subscribe to realtime notifications for this user
    const channel = supabase
      .channel(`user-notifications-${userId}`)
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

          // Trigger toast notification
          if (newNotif.type === 'token_called' || newNotif.type === 'token_recalled') {
            toast.success(newNotif.message, {
              description: 'Please proceed to your counter immediately.',
              duration: 8000,
            })
          } else if (newNotif.type === 'queue_close') {
            toast.warning(newNotif.message, {
              description: 'Get ready, your turn is approaching shortly!',
              duration: 6000,
            })
          } else {
            toast.info(newNotif.message, {
              duration: 5000,
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkOne = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    try {
      await markNotificationRead(id)
    } catch {
      // ignore
    }
  }

  const handleMarkAll = async () => {
    setLoading(true)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await markAllNotificationsRead()
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark all as read')
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (type: string | null | undefined) => {
    switch (type) {
      case 'token_called':
      case 'token_recalled':
        return <Ticket className="w-4 h-4 text-emerald-600" />
      case 'queue_close':
        return <Clock className="w-4 h-4 text-purple-600" />
      case 'appointment_confirmed':
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />
      case 'appointment_approaching':
        return <Calendar className="w-4 h-4 text-amber-600" />
      case 'appointment_cancelled':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  const formatTimeAgo = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Just now'
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        id="nav-notification-bell-btn"
        aria-label="Notifications"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 z-[100] text-gray-900">
          <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={loading}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 sm:hidden cursor-pointer"
                aria-label="Close notifications"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] sm:max-h-[360px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">Updates on your queue and appointments will appear here</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && handleMarkOne(notif.id)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                    notif.read ? 'bg-white hover:bg-gray-50' : 'bg-emerald-50/40 hover:bg-emerald-50/70'
                  }`}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-gray-50 border border-gray-100 shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${notif.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
