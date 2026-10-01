'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Calendar,
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Monitor,
  Building2,
  TrendingUp,
  RotateCw,
  Edit,
  Save,
  X,
  Layers,
  Sparkles,
  Zap,
  ArrowUpRight,
  ShieldAlert,
  Percent,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { toast } from 'sonner'
import BackButton from '@/components/back-button'
import {
  fetchDashboardStats,
  saveCounterConfig,
  saveServiceConfig,
  saveDepartmentConfig,
  type DashboardData,
  type ManagerCounterItem,
  type ManagerServiceItem,
  type ManagerDepartmentItem,
} from '@/lib/actions/manager'

interface Props {
  initialData: DashboardData | null
  initialCounters: ManagerCounterItem[]
  initialServices: ManagerServiceItem[]
  initialDepartments: ManagerDepartmentItem[]
  staffList: Array<{ id: string; name: string; email: string; role: string }>
  userEmail: string
  userRole: string
}

export default function ManagerDashboardClient({
  initialData,
  initialCounters,
  initialServices,
  initialDepartments,
  staffList,
  userEmail,
  userRole,
}: Props) {
  const [data, setData] = useState<DashboardData | null>(initialData)
  const [counters, setCounters] = useState<ManagerCounterItem[]>(initialCounters)
  const [services, setServices] = useState<ManagerServiceItem[]>(initialServices)
  const [departments, setDepartments] = useState<ManagerDepartmentItem[]>(initialDepartments)

  const [activeTab, setActiveTab] = useState<'analytics' | 'counters' | 'services' | 'departments'>('analytics')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Edit Counter Modal State
  const [editingCounter, setEditingCounter] = useState<ManagerCounterItem | null>(null)
  const [counterForm, setCounterForm] = useState({
    status: 'available',
    service_id: '',
    assigned_staff: '',
  })
  const [savingCounter, setSavingCounter] = useState(false)

  // Edit Service State
  const [editingService, setEditingService] = useState<ManagerServiceItem | null>(null)
  const [serviceDuration, setServiceDuration] = useState(5)
  const [serviceActive, setServiceActive] = useState(true)
  const [savingService, setSavingService] = useState(false)

  // Edit Department State
  const [editingDept, setEditingDept] = useState<ManagerDepartmentItem | null>(null)
  const [deptForm, setDeptForm] = useState({
    open_time: '09:00',
    close_time: '17:00',
    slot_minutes: 30,
    max_per_slot: 6,
  })
  const [savingDept, setSavingDept] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // ── Auto Refresh Every 10 Seconds (Task 1) ────────────────────
  const refreshStats = useCallback(async (showToast = false) => {
    setIsRefreshing(true)
    try {
      const res = await fetchDashboardStats()
      if (res.data) {
        setData(res.data)
        if (showToast) toast.success('Dashboard metrics updated')
      }
    } catch {
      if (showToast) toast.error('Failed to refresh stats')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      refreshStats(false)
    }, 10000)
    return () => clearInterval(timer)
  }, [refreshStats])

  // ── Counter Management Handlers ───────────────────────────────
  const handleOpenEditCounter = (c: ManagerCounterItem) => {
    setEditingCounter(c)
    setCounterForm({
      status: c.status,
      service_id: c.service_id || '',
      assigned_staff: c.assigned_staff || '',
    })
  }

  const handleSaveCounter = async () => {
    if (!editingCounter) return
    setSavingCounter(true)
    try {
      const res = await saveCounterConfig(
        editingCounter.id,
        counterForm.status,
        counterForm.service_id || null,
        counterForm.assigned_staff || null
      )
      if (res.success) {
        toast.success(`Counter ${editingCounter.name} updated`)
        setCounters((prev) =>
          prev.map((c) =>
            c.id === editingCounter.id
              ? {
                  ...c,
                  status: counterForm.status as any,
                  service_id: counterForm.service_id || null,
                  assigned_staff: counterForm.assigned_staff || null,
                  service_name: services.find((s) => s.id === counterForm.service_id)?.name || '',
                  staff_name: staffList.find((st) => st.id === counterForm.assigned_staff)?.name || '',
                }
              : c
          )
        )
        setEditingCounter(null)
        refreshStats(false)
      } else {
        toast.error(res.error || 'Failed to update counter')
      }
    } finally {
      setSavingCounter(false)
    }
  }

  // ── Service Management Handlers ───────────────────────────────
  const handleOpenEditService = (s: ManagerServiceItem) => {
    setEditingService(s)
    setServiceDuration(s.avg_duration)
    setServiceActive(s.active)
  }

  const handleSaveService = async () => {
    if (!editingService) return
    setSavingService(true)
    try {
      const res = await saveServiceConfig(editingService.id, Number(serviceDuration), serviceActive)
      if (res.success) {
        toast.success(`Service ${editingService.name} updated`)
        setServices((prev) =>
          prev.map((s) =>
            s.id === editingService.id
              ? { ...s, avg_duration: Number(serviceDuration), active: serviceActive }
              : s
          )
        )
        setEditingService(null)
        refreshStats(false)
      } else {
        toast.error(res.error || 'Failed to update service')
      }
    } finally {
      setSavingService(false)
    }
  }

  // ── Department Management Handlers ────────────────────────────
  const handleOpenEditDept = (d: ManagerDepartmentItem) => {
    setEditingDept(d)
    setDeptForm({
      open_time: d.open_time,
      close_time: d.close_time,
      slot_minutes: d.slot_minutes,
      max_per_slot: d.max_per_slot,
    })
  }

  const handleSaveDept = async () => {
    if (!editingDept) return
    setSavingDept(true)
    try {
      const res = await saveDepartmentConfig(
        editingDept.id,
        deptForm.open_time,
        deptForm.close_time,
        Number(deptForm.slot_minutes),
        Number(deptForm.max_per_slot)
      )
      if (res.success) {
        toast.success(`Department ${editingDept.name} updated`)
        setDepartments((prev) =>
          prev.map((d) =>
            d.id === editingDept.id
              ? {
                  ...d,
                  open_time: deptForm.open_time,
                  close_time: deptForm.close_time,
                  slot_minutes: Number(deptForm.slot_minutes),
                  max_per_slot: Number(deptForm.max_per_slot),
                }
              : d
          )
        )
        setEditingDept(null)
      } else {
        toast.error(res.error || 'Failed to update department')
      }
    } finally {
      setSavingDept(false)
    }
  }

  const summary = data?.summary
  const charts = data?.charts

  return (
    <div className="space-y-8">
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <BackButton fallbackHref="/" />
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  Executive Suite
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {userEmail} ({userRole.toUpperCase()})
                </span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 mt-1 tracking-tight">
                Manager Dashboard & Analytics
              </h1>
              <p className="text-xs text-gray-500">
                Live performance metrics, capacity utilization, and operational controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshStats(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-xl border border-gray-200 shadow-xs transition-colors cursor-pointer text-xs"
              title="Force Refresh Metrics"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#22C55E]' : ''}`} />
              <span>Auto-refresh: 10s</span>
            </button>
          </div>
        </div>

        {/* ── Tab Bar Navigation ──────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-gray-100 mt-6 pt-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'analytics', label: 'Overview & Charts', icon: <TrendingUp className="w-4 h-4" /> },
            { id: 'counters', label: `Counters (${counters.length})`, icon: <Monitor className="w-4 h-4" /> },
            { id: 'services', label: `Services (${services.length})`, icon: <Layers className="w-4 h-4" /> },
            { id: 'departments', label: `Departments (${departments.length})`, icon: <Building2 className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#22C55E] text-gray-900 bg-emerald-50/40 rounded-t-xl'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: ANALYTICS & STAT CARDS ──────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* ── Top 11 Stat Cards (Task 2) ─────────────────────────── */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#22C55E]" />
              Core Performance Indicators (14-Day Baseline)
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {/* Card 1: Appointments Today */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-blue-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Appts Today
                  </span>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-gray-900">
                  {summary ? summary.appts_today : '—'}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Booked for today</p>
              </div>

              {/* Card 2: Walk-in Tokens */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-indigo-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Walk-in Tokens
                  </span>
                  <Ticket className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-gray-900">
                  {summary ? summary.walkin_tokens : '—'}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Direct walk-ins</p>
              </div>

              {/* Card 3: Currently Waiting */}
              <div className="bg-white rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-amber-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Currently Waiting
                  </span>
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-amber-700">
                  {summary ? summary.waiting_tokens : '—'}
                </div>
                <p className="text-[10px] text-amber-600 font-medium mt-0.5">Active in lobby</p>
              </div>

              {/* Card 4: Active Counters */}
              <div className="bg-white rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-[#16A34A] mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Active Counters
                  </span>
                  <Monitor className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-[#15803D]">
                  {summary ? summary.active_counters : '—'}
                </div>
                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Open & serving</p>
              </div>

              {/* Card 5: Completed Tokens */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-emerald-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Completed
                  </span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-gray-900">
                  {summary ? summary.completed_tokens : '—'}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Served successfully</p>
              </div>

              {/* Card 6: Missed Tokens */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-rose-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Missed (No-show)
                  </span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-gray-900">
                  {summary ? summary.missed_tokens : '—'}
                </div>
                <p className="text-[10px] text-rose-500 font-medium mt-0.5">
                  {summary ? `${summary.no_show_rate}% rate` : '—'}
                </p>
              </div>

              {/* Card 7: Avg Waiting Time */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-teal-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Avg Wait Time
                  </span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-gray-900">
                  {summary ? `${summary.avg_wait_minutes}m` : '—'}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Ticket to counter</p>
              </div>

              {/* Card 8: Avg Service Duration */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-sky-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Avg Duration
                  </span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-gray-900">
                  {summary ? `${summary.avg_service_minutes}m` : '—'}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Counter handling time</p>
              </div>

              {/* Card 9: Busiest Department */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-purple-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Top Department
                  </span>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-gray-900 truncate" title={summary?.busiest_department}>
                  {summary ? summary.busiest_department : '—'}
                </div>
                <p className="text-[10px] text-purple-600 font-semibold mt-1">Highest visitor volume</p>
              </div>

              {/* Card 10: Busiest Service */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-cyan-600 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Top Service
                  </span>
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-base font-black text-gray-900 truncate" title={summary?.busiest_service}>
                  {summary ? summary.busiest_service : '—'}
                </div>
                <p className="text-[10px] text-cyan-700 font-semibold mt-1">Most requested service</p>
              </div>

              {/* Card 11: Peak Hour (Highlighted) */}
              <div className="col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl shadow-md p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-100">
                    Operational Peak Hour
                  </span>
                  <div className="text-2xl font-black tracking-tight mt-0.5">
                    {summary ? summary.peak_hour : '—'}
                  </div>
                  <p className="text-xs text-emerald-100 font-medium">
                    Highest queue concentration — schedule extra staff
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Recharts Analytics Section (Task 3) ──────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Queue Length by Hour (Highlight peak in green) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Queue Volume by Hour</h3>
                  <p className="text-xs text-gray-400">Peak hour is highlighted in vibrant emerald</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Peak: {summary?.peak_hour}
                </span>
              </div>

              <div className="h-72 w-full">
                {isMounted && charts?.queue_by_hour ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.queue_by_hour} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {charts.queue_by_hour.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.is_peak ? '#22C55E' : '#94A3B8'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
                )}
              </div>
            </div>

            {/* Chart 2: Daily & Weekly Visitor Trend (Tokens vs Appointments) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">14-Day Visitor Trend</h3>
                  <p className="text-xs text-gray-400">Total walk-in tokens vs scheduled appointments</p>
                </div>
              </div>

              <div className="h-72 w-full">
                {isMounted && charts?.daily_trend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.daily_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tokenColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="apptColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Area
                        type="monotone"
                        dataKey="tokens"
                        name="Tokens"
                        stroke="#22C55E"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#tokenColor)"
                      />
                      <Area
                        type="monotone"
                        dataKey="appointments"
                        name="Appointments"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#apptColor)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
                )}
              </div>
            </div>

            {/* Chart 3: Waiting Time by Department */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Average Wait Time by Department</h3>
                  <p className="text-xs text-gray-400">Minutes from ticket generation to counter call</p>
                </div>
              </div>

              <div className="h-72 w-full">
                {isMounted && charts?.wait_by_department ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.wait_by_department} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="avg_wait" name="Avg Wait (min)" fill="#6366F1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
                )}
              </div>
            </div>

            {/* Chart 4: Staff Workload (Completed per staff) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Staff Workload Distribution</h3>
                  <p className="text-xs text-gray-400">Total completed services handled by each officer</p>
                </div>
              </div>

              <div className="h-72 w-full">
                {isMounted && charts?.staff_workload ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.staff_workload} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="staff_name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="completed" name="Completed Tickets" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
                )}
              </div>
            </div>

            {/* Chart 5: Service Completion Time vs Target */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Service Duration vs Benchmark Target</h3>
                  <p className="text-xs text-gray-400">Actual average duration (min) vs assigned SLA target duration</p>
                </div>
              </div>

              <div className="h-72 w-full">
                {isMounted && charts?.service_completion_time ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.service_completion_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="service" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="avg_duration" name="Actual Avg (min)" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="target_duration" name="Target SLA (min)" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: COUNTER MANAGEMENT PANEL (Task 5) ───────────────── */}
      {activeTab === 'counters' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Counter Configuration & Staff Assignment</h2>
              <p className="text-xs text-gray-500">
                Control active counter operational statuses, dedicated services, and duty officers
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-y border-gray-200">
                <tr>
                  <th className="py-3 px-4">Counter</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned Service</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {counters.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{c.name}</td>
                    <td className="py-3.5 px-4 text-gray-600">{c.department_name || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          c.status === 'available'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : c.status === 'busy'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'break'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'available'
                              ? 'bg-blue-500'
                              : c.status === 'busy'
                              ? 'bg-[#22C55E]'
                              : c.status === 'break'
                              ? 'bg-amber-500'
                              : 'bg-gray-400'
                          }`}
                        />
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {c.service_name || <span className="text-gray-400 italic">All Services</span>}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {c.staff_name || <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditCounter(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Configure</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: SERVICE MANAGEMENT PANEL (Task 5) ────────────────── */}
      {activeTab === 'services' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Service Catalog & SLA Configuration</h2>
            <p className="text-xs text-gray-500">
              Manage target handling duration and active availability across public departments
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-y border-gray-200">
                <tr>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Prefix</th>
                  <th className="py-3 px-4">Target Duration</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{s.name}</td>
                    <td className="py-3.5 px-4 text-gray-600">{s.department_name}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{s.prefix}</td>
                    <td className="py-3.5 px-4 text-gray-800">{s.avg_duration} mins</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          s.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-[#22C55E]' : 'bg-rose-500'}`} />
                        {s.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditService(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit SLA</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: DEPARTMENT SETTINGS (Task 5) ─────────────────────── */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Department Operational Rules</h2>
            <p className="text-xs text-gray-500">
              Configure business operating hours, appointment slot sizes, and slot capacity limits
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((d) => (
              <div key={d.id} className="border border-gray-200 rounded-2xl p-5 bg-gray-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-black text-gray-900">{d.name}</span>
                    <Building2 className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Working Hours:</span>
                      <span className="font-bold text-gray-800">
                        {d.open_time} – {d.close_time}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Slot Interval:</span>
                      <span className="font-bold text-gray-800">{d.slot_minutes} mins</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Max Appointments / Slot:</span>
                      <span className="font-bold text-gray-800">{d.max_per_slot} visitors</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEditDept(d)}
                  className="mt-5 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-800 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Update Hours & Capacity</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT COUNTER ─────────────────────────────────────── */}
      {editingCounter && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Configure {editingCounter.name}</h3>
              <button
                onClick={() => setEditingCounter(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                <select
                  value={counterForm.status}
                  onChange={(e) => setCounterForm({ ...counterForm, status: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                >
                  <option value="available">Available (Open for calls)</option>
                  <option value="busy">Busy (In service)</option>
                  <option value="break">On Break (Paused)</option>
                  <option value="closed">Closed (Offline)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Assigned Service</label>
                <select
                  value={counterForm.service_id}
                  onChange={(e) => setCounterForm({ ...counterForm, service_id: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                >
                  <option value="">All Department Services</option>
                  {services
                    .filter((s) => s.department_id === editingCounter.department_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.prefix})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Duty Officer / Staff</label>
                <select
                  value={counterForm.assigned_staff}
                  onChange={(e) => setCounterForm({ ...counterForm, assigned_staff: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingCounter(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingCounter}
                onClick={handleSaveCounter}
                className="px-5 py-2 text-xs font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingCounter ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT SERVICE ─────────────────────────────────────── */}
      {editingService && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit {editingService.name}</h3>
              <button
                onClick={() => setEditingService(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                  Target Service Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                />
                <p className="text-[11px] text-gray-400 mt-1">Used as benchmark for waiting estimation and SLAs.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="service-active-chk"
                  checked={serviceActive}
                  onChange={(e) => setServiceActive(e.target.checked)}
                  className="w-4 h-4 text-[#22C55E] rounded-md focus:ring-[#22C55E]"
                />
                <label htmlFor="service-active-chk" className="text-sm font-bold text-gray-800 cursor-pointer">
                  Service is Active & Available for Booking/Tokens
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingService}
                onClick={handleSaveService}
                className="px-5 py-2 text-xs font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingService ? 'Saving...' : 'Save Service'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT DEPARTMENT ──────────────────────────────────── */}
      {editingDept && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editingDept.name} Rules</h3>
              <button
                onClick={() => setEditingDept(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Open Time</label>
                  <input
                    type="time"
                    value={deptForm.open_time}
                    onChange={(e) => setDeptForm({ ...deptForm, open_time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Close Time</label>
                  <input
                    type="time"
                    value={deptForm.close_time}
                    onChange={(e) => setDeptForm({ ...deptForm, close_time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Slot Size (Minutes)</label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  step="5"
                  value={deptForm.slot_minutes}
                  onChange={(e) => setDeptForm({ ...deptForm, slot_minutes: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Max Bookings Per Slot</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={deptForm.max_per_slot}
                  onChange={(e) => setDeptForm({ ...deptForm, max_per_slot: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingDept}
                onClick={handleSaveDept}
                className="px-5 py-2 text-xs font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingDept ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
