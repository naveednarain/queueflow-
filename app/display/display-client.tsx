'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Monitor,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Clock,
  Layers,
  Coffee,
  CheckCircle2,
  RotateCw,
  Megaphone,
  MegaphoneOff,
  UserCheck,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getDisplayData } from '@/lib/actions/staff'
import type { DisplayCounterItem } from '@/lib/types'
import BackButton from '@/components/back-button'

interface Props {
  initialCounters: DisplayCounterItem[]
  initialNextUp: Array<{ token_number: string; service_name: string; department_name: string }>
}

export default function DisplayClient({ initialCounters, initialNextUp }: Props) {
  const [counters, setCounters] = useState<DisplayCounterItem[]>(initialCounters)
  const [nextUp, setNextUp] = useState(initialNextUp)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false) // Default to LIGHT to match rest of UI
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [flashingCounterId, setFlashingCounterId] = useState<string | null>(null)
  const prevTokensRef = useRef<Record<string, string | null>>({})

  // Initialize previous tokens map
  useEffect(() => {
    const map: Record<string, string | null> = {}
    for (const c of initialCounters) {
      map[c.counter_id] = c.token_number
    }
    prevTokensRef.current = map
  }, [initialCounters])

  // ── Web Audio Chime (Airport-style 2-tone melodic chime) ───────
  const playAirportChime = useCallback(() => {
    if (!soundEnabled) return
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()

      // Tone 1: F5 (698.46 Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(698.46, ctx.currentTime)
      gain1.gain.setValueAtTime(0.28, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.45)

      // Tone 2: A5 (880 Hz) - crisp harmonic
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.2)
      gain2.gain.setValueAtTime(0.32, ctx.currentTime + 0.2)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(ctx.currentTime + 0.2)
      osc2.stop(ctx.currentTime + 0.9)
    } catch {
      // Audio context might be waiting for user gesture
    }
  }, [soundEnabled])

  // ── Speech Synthesis Voice Announcement ────────────────────────
  const speakTokenAnnouncement = useCallback(
    (tokenNumber: string, counterName: string) => {
      if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
      try {
        window.speechSynthesis.cancel()
        const spacedToken = tokenNumber.split('').join(' ')
        const text = `Token ${spacedToken}, please proceed to ${counterName}`
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.92
        utterance.pitch = 1.05
        window.speechSynthesis.speak(utterance)
      } catch {
        // Ignore speech synthesis errors
      }
    },
    [voiceEnabled]
  )

  // ── Live Clock & Date ─────────────────────────────────────────
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      )
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // ── Refresh Board Data ────────────────────────────────────────
  const refreshBoard = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const data = await getDisplayData()
      setCounters(data.counters)
      setNextUp(data.nextUp)

      // Detect newly called tokens to play chime and flash
      for (const c of data.counters) {
        const prevToken = prevTokensRef.current[c.counter_id]
        if (
          c.token_number &&
          c.token_number !== prevToken &&
          (c.token_status === 'called' || c.token_status === 'recalled')
        ) {
          playAirportChime()
          setFlashingCounterId(c.counter_id)
          setTimeout(() => {
            speakTokenAnnouncement(c.token_number!, c.counter_name)
          }, 600)
          setTimeout(() => setFlashingCounterId(null), 8500)
        }
        prevTokensRef.current[c.counter_id] = c.token_number
      }
    } catch (err) {
      console.error('Display refresh failed:', err)
    } finally {
      setTimeout(() => setIsRefreshing(false), 400)
    }
  }, [playAirportChime, speakTokenAnnouncement])

  // ── Realtime Subscription ─────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('display-board-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        () => {
          refreshBoard()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'counters' },
        () => {
          refreshBoard()
        }
      )
      .subscribe()

    // Backup polling every 8s
    const pollInterval = setInterval(refreshBoard, 8000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [refreshBoard])

  // ── Fullscreen Toggle ─────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  // Active stats
  const activeServingCount = counters.filter(
    (c) =>
      c.token_number &&
      (c.token_status === 'called' || c.token_status === 'in_service' || c.token_status === 'recalled')
  ).length
  const availableCountersCount = counters.filter((c) => c.status === 'available').length

  return (
    <div
      className={`min-h-screen flex flex-col font-sans select-none overflow-x-hidden transition-colors duration-300 ${
        isDarkMode
          ? 'bg-[#030712] text-white selection:bg-emerald-500 selection:text-black'
          : 'bg-[#F5F5F5] text-gray-900 selection:bg-[#22C55E] selection:text-white'
      }`}
    >
      {/* ── Background Patterns ───────────────────────────────────── */}
      {isDarkMode ? (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none -z-10" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035] -z-10"
            style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#22C55E]/5 rounded-full blur-[128px] pointer-events-none -z-10" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[140px] pointer-events-none -z-10" />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03] -z-10"
            style={{
              backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.5) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        </>
      )}

      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-md px-6 py-3.5 transition-colors duration-300 border-b ${
          isDarkMode
            ? 'bg-slate-950/80 border-slate-800/80 shadow-2xl'
            : 'bg-white/90 border-gray-200/80 shadow-xs'
        }`}
      >
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Operational Status */}
          <div className="flex items-center gap-3.5">
            <BackButton
              fallbackHref="/"
              variant={isDarkMode ? 'dark' : 'light'}
            />

            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-[#22C55E] flex items-center justify-center shadow-md shadow-green-200">
                <Monitor className="w-6 h-6 text-white stroke-[2.5]" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#16A34A] ring-2 ring-white" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                  Queue<span className="text-[#22C55E]">Flow</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    isDarkMode
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                  Live Display
                </span>
              </div>
              <div
                className={`flex items-center gap-2 mt-0.5 text-xs ${
                  isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}
              >
                <span>Public Service Terminal</span>
                <span>•</span>
                <span className="text-[#16A34A] font-semibold">
                  {activeServingCount} In Service · {availableCountersCount} Ready
                </span>
              </div>
            </div>
          </div>

          {/* Center / Right: Live Digital Clock & Interactive Controls */}
          <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
            {/* Monospace Digital Clock */}
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900/80 border-slate-800/80 text-emerald-400'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            >
              <Clock className="w-5 h-5 text-[#22C55E] animate-pulse" />
              <div className="text-right">
                <div className="text-xl sm:text-3xl font-mono font-black tracking-wider text-gray-900 dark:text-emerald-400">
                  {currentTime || '--:--:--'}
                </div>
                <div
                  className={`text-[11px] font-semibold uppercase tracking-wide hidden sm:block ${
                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                  }`}
                >
                  {currentDate || 'Loading date...'}
                </div>
              </div>
            </div>

            {/* Controls Toolbar */}
            <div
              className={`flex items-center gap-1.5 sm:gap-2 ${
                isDarkMode ? 'border-slate-800' : 'border-gray-200'
              }`}
            >
              {/* Theme Toggle (Light / Dark) */}
              <button
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900/80 border-slate-800 text-amber-300 hover:bg-slate-800'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-xs'
                }`}
                title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                <span className="text-xs font-semibold hidden md:inline">
                  {isDarkMode ? 'Light' : 'Dark'}
                </span>
              </button>

              {/* Chime Sound Toggle */}
              <button
                onClick={() => setSoundEnabled((prev) => !prev)}
                className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  soundEnabled
                    ? isDarkMode
                      ? 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/60'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                    : isDarkMode
                    ? 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 shadow-xs'
                }`}
                title={soundEnabled ? 'Chime sound is ACTIVE' : 'Chime sound is MUTED'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-[#22C55E]" /> : <VolumeX className="w-4 h-4" />}
                <span className="text-xs font-semibold hidden md:inline">
                  {soundEnabled ? 'Chime ON' : 'Chime OFF'}
                </span>
              </button>

              {/* Voice Announcement Toggle */}
              <button
                onClick={() => setVoiceEnabled((prev) => !prev)}
                className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  voiceEnabled
                    ? isDarkMode
                      ? 'bg-cyan-950/70 border-cyan-600/60 text-cyan-300 hover:bg-cyan-900/60'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-xs'
                    : isDarkMode
                    ? 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 shadow-xs'
                }`}
                title={voiceEnabled ? 'Voice announcements ACTIVE' : 'Voice announcements MUTED'}
              >
                {voiceEnabled ? (
                  <Megaphone className={`w-4 h-4 ${isDarkMode ? 'text-cyan-400' : 'text-blue-600'}`} />
                ) : (
                  <MegaphoneOff className="w-4 h-4" />
                )}
                <span className="text-xs font-semibold hidden md:inline">
                  {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
                </span>
              </button>

              {/* Manual Refresh */}
              <button
                onClick={refreshBoard}
                disabled={isRefreshing}
                className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs'
                }`}
                title="Force Refresh Data"
              >
                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#22C55E]' : ''}`} />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs'
                }`}
                title="Toggle Fullscreen Mode"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Counters Live Display ─────────────────────────────── */}
      <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-[1920px] mx-auto w-full flex flex-col justify-start">
        {counters.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
            <div
              className={`w-20 h-20 rounded-3xl border flex items-center justify-center mb-4 shadow-sm ${
                isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-600' : 'bg-white border-gray-200 text-gray-400'
              }`}
            >
              <Monitor className="w-10 h-10" />
            </div>
            <h3
              className={`text-2xl font-bold ${
                isDarkMode ? 'text-slate-300' : 'text-gray-800'
              }`}
            >
              No Counters Configured
            </h3>
            <p
              className={`text-sm mt-1 max-w-md ${
                isDarkMode ? 'text-slate-500' : 'text-gray-500'
              }`}
            >
              Please initialize service counters in the Admin Station to activate this live terminal board.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 auto-rows-fr">
            {counters.map((c) => {
              const isFlashing = flashingCounterId === c.counter_id
              const isServing = Boolean(
                c.token_number &&
                  (c.token_status === 'called' || c.token_status === 'in_service' || c.token_status === 'recalled')
              )
              const isAvailable = c.status === 'available' && !isServing
              const isBreak = c.status === 'break' && !isServing
              const isClosed = c.status === 'closed' && !isServing

              return (
                <div
                  key={c.counter_id}
                  className={`group relative rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden border ${
                    isDarkMode
                      ? isFlashing
                        ? 'bg-gradient-to-b from-emerald-950/90 via-slate-900/95 to-slate-950 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_50px_rgba(16,185,129,0.35)] scale-[1.02] z-20 animate-pulse'
                        : isServing
                        ? 'bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-emerald-950/20 border-emerald-500/40 shadow-xl shadow-slate-950/80 hover:border-emerald-500/60'
                        : isAvailable
                        ? 'bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-sky-950/20 border-sky-500/30 shadow-lg shadow-slate-950/50 hover:border-sky-500/50'
                        : isBreak
                        ? 'bg-gradient-to-b from-slate-900/90 to-amber-950/20 border-amber-500/30 shadow-lg shadow-slate-950/50'
                        : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                      : isFlashing
                      ? 'bg-white border-[#22C55E] ring-4 ring-[#22C55E]/30 shadow-xl shadow-green-500/20 scale-[1.02] z-20 animate-pulse'
                      : isServing
                      ? 'bg-white border-emerald-200 shadow-md shadow-emerald-500/5 hover:border-emerald-300'
                      : isAvailable
                      ? 'bg-white border-blue-200 shadow-sm hover:border-blue-300'
                      : isBreak
                      ? 'bg-white border-amber-200 shadow-sm'
                      : 'bg-gray-100/70 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Flashing "NOW CALLING" Banner */}
                  {isFlashing && (
                    <div className="absolute top-0 inset-x-0 bg-[#22C55E] text-white py-1.5 px-4 text-center font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md animate-bounce">
                      <Megaphone className="w-4 h-4 fill-white" />
                      <span>NOW CALLING — PLEASE PROCEED</span>
                      <Megaphone className="w-4 h-4 fill-white rotate-180" />
                    </div>
                  )}

                  {/* Counter Card Top Header */}
                  <div className={`flex items-start justify-between gap-3 ${isFlashing ? 'mt-4 mb-4' : 'mb-5'}`}>
                    <div>
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${
                          isDarkMode
                            ? 'bg-slate-800/80 text-emerald-300 border-slate-700/60'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        <Layers className="w-3 h-3 text-[#22C55E]" />
                        <span>{c.department_name || 'Service Station'}</span>
                      </div>
                      <h2
                        className={`text-2xl font-black mt-1 tracking-tight flex items-center gap-2 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {c.counter_name}
                      </h2>
                    </div>

                    {/* Live Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-xs ${
                        isDarkMode
                          ? isServing
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : isAvailable
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : isBreak
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700'
                          : isServing
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isAvailable
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : isBreak
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isServing
                            ? 'bg-[#22C55E] animate-ping'
                            : isAvailable
                            ? 'bg-blue-500 animate-pulse'
                            : isBreak
                            ? 'bg-amber-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      {isServing ? 'SERVING' : isAvailable ? 'READY' : isBreak ? 'ON BREAK' : 'CLOSED'}
                    </span>
                  </div>

                  {/* Main Token Display Box (Hero) */}
                  <div
                    className={`flex-1 rounded-2xl p-6 text-center border flex flex-col items-center justify-center min-h-[220px] transition-all ${
                      isDarkMode
                        ? 'bg-[#02050c]/90 border-slate-800/80 shadow-inner group-hover:border-slate-700/80'
                        : isServing
                        ? 'bg-emerald-50/40 border-emerald-100 shadow-inner'
                        : isAvailable
                        ? 'bg-blue-50/40 border-blue-100 shadow-inner'
                        : isBreak
                        ? 'bg-amber-50/40 border-amber-100 shadow-inner'
                        : 'bg-gray-50 border-gray-200 shadow-inner'
                    }`}
                  >
                    {isServing && c.token_number ? (
                      <div className="w-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
                        <div
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest mb-1 ${
                            isDarkMode ? 'text-emerald-400/90' : 'text-emerald-700'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>
                            {c.token_status === 'in_service' ? 'Currently In Service' : 'Please Proceed to Counter'}
                          </span>
                        </div>

                        {/* Huge Monospace Token Number */}
                        <div
                          className={`text-5xl sm:text-7xl lg:text-8xl font-mono font-black tracking-widest my-1 ${
                            isDarkMode
                              ? 'text-emerald-400 drop-shadow-[0_0_24px_rgba(52,211,153,0.5)]'
                              : 'text-[#16A34A] drop-shadow-xs'
                          }`}
                        >
                          {c.token_number}
                        </div>

                        {/* Service Name Badge */}
                        {c.service_name && (
                          <div
                            className={`mt-2.5 max-w-[90%] px-3.5 py-1 rounded-xl text-xs font-semibold truncate border shadow-xs ${
                              isDarkMode
                                ? 'bg-slate-900/90 border-slate-800 text-slate-200'
                                : 'bg-white border-gray-200 text-gray-800'
                            }`}
                          >
                            {c.service_name}
                          </div>
                        )}
                      </div>
                    ) : isAvailable ? (
                      <div className="flex flex-col items-center justify-center py-3">
                        <div
                          className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-3 shadow-xs ${
                            isDarkMode
                              ? 'bg-sky-500/10 border-sky-500/20 text-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.2)]'
                              : 'bg-blue-100/70 border-blue-200 text-blue-600'
                          }`}
                        >
                          <CheckCircle2 className="w-6 h-6 animate-pulse" />
                        </div>
                        <div
                          className={`text-3xl font-black tracking-tight ${
                            isDarkMode ? 'text-sky-200' : 'text-blue-900'
                          }`}
                        >
                          READY
                        </div>
                        <p
                          className={`text-xs font-medium mt-1 ${
                            isDarkMode ? 'text-slate-400' : 'text-blue-600'
                          }`}
                        >
                          Available for next customer
                        </p>
                      </div>
                    ) : isBreak ? (
                      <div className="flex flex-col items-center justify-center py-3">
                        <div
                          className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-3 shadow-xs ${
                            isDarkMode
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                              : 'bg-amber-100/70 border-amber-200 text-amber-600'
                          }`}
                        >
                          <Coffee className="w-6 h-6" />
                        </div>
                        <div
                          className={`text-3xl font-black tracking-tight ${
                            isDarkMode ? 'text-amber-400' : 'text-amber-900'
                          }`}
                        >
                          ON BREAK
                        </div>
                        <p
                          className={`text-xs font-medium mt-1 ${
                            isDarkMode ? 'text-slate-400' : 'text-amber-700'
                          }`}
                        >
                          Counter temporarily paused
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-3">
                        <div
                          className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-3 ${
                            isDarkMode
                              ? 'bg-slate-800/40 border-slate-800 text-slate-600'
                              : 'bg-gray-200/70 border-gray-300 text-gray-500'
                          }`}
                        >
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div
                          className={`text-3xl font-black tracking-tight ${
                            isDarkMode ? 'text-slate-500' : 'text-gray-500'
                          }`}
                        >
                          CLOSED
                        </div>
                        <p
                          className={`text-xs font-medium mt-1 ${
                            isDarkMode ? 'text-slate-600' : 'text-gray-400'
                          }`}
                        >
                          Counter is currently offline
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Bottom Bar: Next In Line Ticker ────────────────────────── */}
      <footer
        className={`sticky bottom-0 z-30 backdrop-blur-md px-6 py-3.5 transition-colors duration-300 border-t ${
          isDarkMode
            ? 'bg-slate-950/90 border-slate-800/80 shadow-2xl'
            : 'bg-white/95 border-gray-200/90 shadow-xs'
        }`}
      >
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          {/* Header Tag */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#16A34A]" />
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  isDarkMode ? 'text-slate-200' : 'text-gray-800'
                }`}
              >
                Next Up in Queue:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  isDarkMode
                    ? 'bg-slate-800 text-cyan-300 border-slate-700'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                {nextUp.length} waiting
              </span>
            </div>
          </div>

          {/* Tokens Horizontal Strip */}
          <div className="flex-1 overflow-x-auto">
            {nextUp.length === 0 ? (
              <span
                className={`text-xs italic flex items-center gap-2 ${
                  isDarkMode ? 'text-slate-500' : 'text-gray-500'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                All queues are clear. No pending waiting tokens.
              </span>
            ) : (
              <div className="flex items-center gap-3">
                {nextUp.map((item, idx) => (
                  <div
                    key={`${item.token_number}-${idx}`}
                    className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl shrink-0 transition-all duration-200 border ${
                      isDarkMode
                        ? 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 text-slate-200'
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800 shadow-xs'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono font-black px-2 py-0.5 rounded border shadow-xs ${
                        isDarkMode
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                          : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                      }`}
                    >
                      {item.token_number}
                    </span>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold truncate max-w-[140px]">
                        {item.service_name}
                      </span>
                      {item.department_name && (
                        <span
                          className={`text-[10px] truncate max-w-[140px] ${
                            isDarkMode ? 'text-slate-500' : 'text-gray-500'
                          }`}
                        >
                          {item.department_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-time Indicator Tag */}
          <div
            className={`text-[11px] shrink-0 hidden lg:flex items-center gap-2 ${
              isDarkMode ? 'text-slate-500' : 'text-gray-500'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span>Supabase Real-Time Broadcast Sync</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
