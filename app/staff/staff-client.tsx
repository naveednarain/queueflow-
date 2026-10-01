'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users,
  PhoneCall,
  Play,
  CheckCircle2,
  Volume2,
  SkipForward,
  UserX,
  RefreshCw,
  Clock,
  Sparkles,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ChevronDown,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  callNextToken,
  startService,
  completeService,
  recallToken,
  skipToken,
  markTokenMissed,
  setCounterStatus,
  getCounterQueue,
  getCounterDetails,
} from '@/lib/actions/staff'
import { getNoShowBadge, calculateNoShowRisk } from '@/lib/ai/noShow'
import type { StaffCounter, StaffQueueItem, TokenStatus } from '@/lib/types'
import BackButton from '@/components/back-button'

interface Props {
  initialCounters: StaffCounter[]
  userEmail: string
  userRole: string
}

export default function StaffClient({ initialCounters, userEmail, userRole }: Props) {
  const [counters, setCounters] = useState<StaffCounter[]>(initialCounters)
  const [selectedCounterId, setSelectedCounterId] = useState<string>(
    initialCounters[0]?.id ?? ''
  )
  const [queue, setQueue] = useState<StaffQueueItem[]>([])
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const activeCounter = counters.find((c) => c.id === selectedCounterId) ?? null
  const currentToken = activeCounter?.current_token_details ?? null

  // Web Audio chime for call notification
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.18) // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.18)
      osc2.start(ctx.currentTime + 0.18)
      osc2.stop(ctx.currentTime + 0.7)
    } catch {
      // AudioContext might be blocked before first user gesture
    }
  }, [])

  // ── Refresh Queue for Active Counter ──────────────────────────
  const refreshQueue = useCallback(async (counterId?: string) => {
    const id = counterId || selectedCounterId
    if (!id) return
    setLoadingQueue(true)
    try {
      const q = await getCounterQueue(id)
      setQueue(q)
    } catch (err: any) {
      console.error('Failed to load queue:', err)
    } finally {
      setLoadingQueue(false)
    }
  }, [selectedCounterId])

  // ── Refresh Counter Details ───────────────────────────────────
  const refreshCounter = useCallback(async (counterId?: string) => {
    const id = counterId || selectedCounterId
    if (!id) return
    try {
      const details = await getCounterDetails(id)
      if (details) {
        setCounters((prev) =>
          prev.map((c) => (c.id === details.id ? details : c))
        )
      }
    } catch (err) {
      console.error('Failed to refresh counter:', err)
    }
  }, [selectedCounterId])

  // ── Refresh Both ──────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (!selectedCounterId) return
    await Promise.all([refreshCounter(), refreshQueue()])
  }, [selectedCounterId, refreshCounter, refreshQueue])

  // Load queue whenever selected counter changes
  useEffect(() => {
    if (selectedCounterId) {
      refreshAll()
    }
  }, [selectedCounterId, refreshAll])

  // ── Live Service Elapsed Timer ────────────────────────────────
  useEffect(() => {
    if (!currentToken) {
      setElapsedSeconds(0)
      return
    }

    const referenceTime = currentToken.started_at || currentToken.called_at
    if (!referenceTime) {
      setElapsedSeconds(0)
      return
    }

    const startTs = new Date(referenceTime).getTime()
    const updateElapsed = () => {
      const now = Date.now()
      setElapsedSeconds(Math.max(0, Math.floor((now - startTs) / 1000)))
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [currentToken])

  // ── Realtime Subscription to tokens & counters ────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('staff-realtime-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        () => {
          refreshAll()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'counters' },
        () => {
          refreshCounter()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshAll, refreshCounter])

  // ── Format Timer (mm:ss) ──────────────────────────────────────
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ── Handlers ──────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: 'available' | 'busy' | 'break' | 'closed') => {
    if (!activeCounter) return
    setActionPending(true)
    try {
      const res = await setCounterStatus(activeCounter.id, newStatus)
      if (!res.success) {
        toast.error(res.error || 'Failed to update counter status')
      } else {
        toast.success(`Counter status set to ${newStatus}`)
        await refreshCounter()
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setActionPending(false)
    }
  }

  const handleCallNext = async () => {
    if (!activeCounter || actionPending) return
    setActionPending(true)
    try {
      playChime()
      const res = await callNextToken(activeCounter.id)
      if (res.error) {
        toast.error(res.error)
      } else if (res.token) {
        toast.success(`Called token ${res.token.token_number}!`, { duration: 5000 })
        await refreshAll()
      }
    } catch {
      toast.error('Failed to call next token')
    } finally {
      setActionPending(false)
    }
  }

  const handleStartService = async () => {
    if (!currentToken || actionPending) return
    setActionPending(true)
    try {
      const res = await startService(currentToken.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to start service')
      } else {
        toast.success(`Service started for ${currentToken.token_number}`)
        await refreshAll()
      }
    } catch {
      toast.error('Failed to start service')
    } finally {
      setActionPending(false)
    }
  }

  const handleCompleteService = async () => {
    if (!currentToken || actionPending) return
    setActionPending(true)
    try {
      const res = await completeService(currentToken.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to complete service')
      } else {
        toast.success(`Token ${currentToken.token_number} marked as completed!`)
        await refreshAll()
      }
    } catch {
      toast.error('Failed to complete service')
    } finally {
      setActionPending(false)
    }
  }

  const handleRecall = async () => {
    if (!currentToken || actionPending) return
    setActionPending(true)
    try {
      playChime()
      const res = await recallToken(currentToken.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to recall token')
      } else {
        toast.info(`Recalled token ${currentToken.token_number}`)
        await refreshAll()
      }
    } catch {
      toast.error('Failed to recall token')
    } finally {
      setActionPending(false)
    }
  }

  const handleSkip = async () => {
    if (!currentToken || actionPending) return
    setActionPending(true)
    try {
      const res = await skipToken(currentToken.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to skip token')
      } else {
        toast.warning(`Token ${currentToken.token_number} was skipped`)
        await refreshAll()
      }
    } catch {
      toast.error('Failed to skip token')
    } finally {
      setActionPending(false)
    }
  }

  const handleMarkMissed = async () => {
    if (!currentToken || actionPending) return
    setActionPending(true)
    try {
      const res = await markTokenMissed(currentToken.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to mark as missed')
      } else {
        toast.error(`Token ${currentToken.token_number} marked as missed (no-show recorded)`)
        await refreshAll()
      }
    } catch {
      toast.error('Failed to mark token as missed')
    } finally {
      setActionPending(false)
    }
  }

  // Can call next if counter is not on break or closed and doesn't have an active token
  const canCallNext =
    Boolean(activeCounter) &&
    activeCounter?.status !== 'break' &&
    activeCounter?.status !== 'closed' &&
    (!currentToken || currentToken.status === 'completed' || currentToken.status === 'skipped' || currentToken.status === 'missed')

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Counter Selector & Status Control ────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <BackButton fallbackHref="/" />
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Staff Station
                </span>
                <span className="text-xs text-gray-400">· {userRole.toUpperCase()}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mt-0.5">
                {activeCounter ? activeCounter.name : 'Select a Counter'}
              </h1>
              <p className="text-xs text-gray-500">
                Department: {activeCounter?.department_name}
                {activeCounter?.service_name ? ` · Serving: ${activeCounter.service_name}` : ' · All Services'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Counter Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedCounterId}
                onChange={(e) => setSelectedCounterId(e.target.value)}
                className="appearance-none bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 pr-9 text-sm font-semibold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {counters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status.toUpperCase()})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <button
              onClick={refreshAll}
              disabled={loadingQueue || actionPending}
              className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
              title="Refresh Queue and Counter"
            >
              <RefreshCw className={`w-4 h-4 ${loadingQueue ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Counter Status Segmented Control */}
        {activeCounter && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Counter State:
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  activeCounter.status === 'available'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : activeCounter.status === 'busy'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : activeCounter.status === 'break'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeCounter.status === 'available'
                      ? 'bg-emerald-500 animate-pulse'
                      : activeCounter.status === 'busy'
                      ? 'bg-blue-500'
                      : activeCounter.status === 'break'
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                  }`}
                />
                {activeCounter.status.toUpperCase()}
              </span>
            </div>

            <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200 gap-1">
              <button
                type="button"
                onClick={() => handleStatusChange('available')}
                disabled={actionPending || activeCounter.status === 'available'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCounter.status === 'available'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🟢 Available
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('busy')}
                disabled={actionPending || activeCounter.status === 'busy'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCounter.status === 'busy'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🔵 Busy
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('break')}
                disabled={actionPending || activeCounter.status === 'break'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCounter.status === 'break'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ☕ Break
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('closed')}
                disabled={actionPending || activeCounter.status === 'closed'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCounter.status === 'closed'
                    ? 'bg-white text-gray-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ⚪ Closed
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Dual Panel: Workspace + Realtime Waiting Queue ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Call Next + Now Serving Card (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Big Call Next Action Banner */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-blue-200">
                  Queue Dispatcher
                </span>
                <h2 className="text-2xl font-black mt-0.5">
                  {queue.length > 0
                    ? `${queue.length} Customer${queue.length === 1 ? '' : 's'} Waiting`
                    : 'Queue Is Empty'}
                </h2>
                <p className="text-xs text-blue-100 mt-1 max-w-sm">
                  {currentToken
                    ? 'Complete, skip, or mark the current customer as missed before calling the next one.'
                    : activeCounter?.status === 'break' || activeCounter?.status === 'closed'
                    ? 'Switch counter state to Available to start calling tickets.'
                    : 'Click Call Next to automatically dispatch the highest-priority ticket.'}
                </p>
              </div>

              <button
                onClick={handleCallNext}
                disabled={!canCallNext || actionPending || queue.length === 0}
                className={`flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-base font-extrabold shadow-lg transition-all transform active:scale-95 ${
                  canCallNext && queue.length > 0 && !actionPending
                    ? 'bg-white text-blue-700 hover:bg-blue-50 cursor-pointer shadow-blue-900/30 hover:shadow-xl'
                    : 'bg-white/20 text-white/50 cursor-not-allowed'
                }`}
              >
                <PhoneCall className={`w-5 h-5 ${canCallNext && queue.length > 0 ? 'animate-bounce' : ''}`} />
                <span>CALL NEXT</span>
              </button>
            </div>
          </div>

          {/* Now Serving Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="font-bold text-gray-900">Now Serving</h3>
              </div>
              {currentToken && (
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full text-xs font-semibold text-gray-700">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>{formatTimer(elapsedSeconds)}</span>
                </div>
              )}
            </div>

            <div className="p-6">
              {currentToken ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            currentToken.status === 'in_service'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : currentToken.status === 'recalled'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {currentToken.status === 'in_service'
                            ? '● In Service'
                            : currentToken.status === 'recalled'
                            ? '● Recalled'
                            : '● Called'}
                        </span>
                        {currentToken.appointment_ref && (
                          <span className="text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-0.5 rounded-full">
                            APT: {currentToken.appointment_ref}
                          </span>
                        )}
                      </div>

                      <div className="text-5xl font-mono font-black text-gray-900 tracking-tight mt-2">
                        {currentToken.token_number}
                      </div>

                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">{currentToken.user_name}</span>
                        {currentToken.service_name && (
                          <span className="text-gray-400"> · {currentToken.service_name}</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-right min-w-[140px]">
                      <span className="text-xs text-gray-400 font-medium block">Counter</span>
                      <span className="text-sm font-bold text-gray-800 block">
                        {activeCounter?.name}
                      </span>
                      <span className="text-xs text-gray-400 font-medium block mt-2">Duration</span>
                      <span className="text-base font-mono font-bold text-blue-600 block">
                        {formatTimer(elapsedSeconds)}
                      </span>
                    </div>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="mt-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {currentToken.status !== 'in_service' ? (
                        <button
                          type="button"
                          onClick={handleStartService}
                          disabled={actionPending}
                          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>Start Service</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCompleteService}
                          disabled={actionPending}
                          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Complete Service</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleRecall}
                        disabled={actionPending}
                        className="flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>Recall Chime</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleSkip}
                        disabled={actionPending}
                        className="flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer text-xs"
                      >
                        <SkipForward className="w-4 h-4" />
                        <span>Skip Customer</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleMarkMissed}
                        disabled={actionPending}
                        className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer text-xs"
                      >
                        <UserX className="w-4 h-4" />
                        <span>Mark No-Show</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3 text-gray-400">
                    <PhoneCall className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg">No Customer Being Served</h4>
                  <p className="text-sm text-gray-500 max-w-sm mt-1">
                    Your counter is ready. Click <strong>CALL NEXT</strong> above to invite the next ticket in line.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Waiting Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900">Waiting List</h3>
                <span className="bg-blue-50 text-blue-700 font-bold text-xs px-2 py-0.5 rounded-full">
                  {queue.length}
                </span>
              </div>
              <span className="text-xs text-gray-400">Live priority order</span>
            </div>

            {queue.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-2 font-bold">
                  ✓
                </div>
                <p className="font-medium text-gray-700">Queue is clear!</p>
                <p className="text-xs text-gray-400 mt-1">No customers currently waiting for this counter.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto pr-1">
                {queue.map((item, index) => {
                  const riskBadge = getNoShowBadge(
                    item.appointment_no_show_risk ??
                      calculateNoShowRisk({ noShowCount: item.user_no_show_count })
                  )

                  return (
                    <div
                      key={item.token_id}
                      className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 hover:bg-gray-50/60 rounded-xl px-2 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          #{item.queue_position || index + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-gray-900">
                              {item.token_number}
                            </span>
                            {item.appointment_id ? (
                              <span className="bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                APT
                              </span>
                            ) : (
                              <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                                Walk-in
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-600 mt-0.5">
                            {item.service_name}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5">
                            {/* AI No-Show Risk Badge */}
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${riskBadge.badgeClass}`}
                              title={`Calculated no-show risk: ${riskBadge.scorePercent}%`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${riskBadge.dotClass}`} />
                              <span>{riskBadge.label}</span>
                            </span>

                            {item.estimated_wait !== null && (
                              <span className="text-[10px] text-gray-400 font-medium">
                                ~{item.estimated_wait}m wait
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-gray-400">
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Counter Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs text-gray-500 space-y-1.5">
            <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Queue Logic & Priority Rules</span>
            </div>
            <p>
              • <strong>Appointment tokens</strong> are prioritized before walk-ins.
            </p>
            <p>
              • <strong>Calling Next</strong> automatically alerts the customer on their live device and updates the display board.
            </p>
            <p>
              • Marking <strong>No-Show</strong> logs activity and increments the customer&apos;s penalty score for future smart risk analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
