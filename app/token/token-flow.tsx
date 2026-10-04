'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Ticket,
  Clock,
  Users,
  CheckCircle2,
  Loader2,
  ChevronDown,
  MapPin,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { createToken } from '@/lib/actions/token'
import type { DepartmentGroup, Token } from '@/lib/types'
import Link from 'next/link'
import BackButton from '@/components/back-button'

interface Props {
  departments: DepartmentGroup[]
  userId: string
}

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-700 border-amber-200',
  called: 'bg-blue-100 text-blue-700 border-blue-200',
  in_service: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  missed: 'bg-red-100 text-red-700 border-red-200',
}

export default function TokenFlow({ departments, userId }: Props) {
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [selectedService, setSelectedService] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<Token | null>(null)

  const activeDept = departments.find((d) => d.id === selectedDept)
  const activeService = activeDept?.services.find((s) => s.id === selectedService)

  const handleGetToken = async () => {
    if (loading) return
    if (!selectedService) {
      toast.error('Please select a service first.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await createToken(selectedService)
      if (error) {
        toast.error(error)
        return
      }
      if (data) {
        setToken(data)
        toast.success(`Token ${data.token_number} issued!`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setToken(null)
    setSelectedDept('')
    setSelectedService('')
  }

  if (token) {
    return <TokenResultCard token={token} service={activeService} onReset={handleReset} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-[#22C55E]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Get a Token</h1>
              <p className="text-sm text-gray-500">Join the walk-in queue from anywhere</p>
            </div>
          </div>
          <BackButton fallbackHref="/" />
        </div>
      </div>

      {/* Step 1: Department */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center text-white text-xs font-bold">
            1
          </div>
          <span className="text-sm font-semibold text-gray-700">Select Department</span>
        </div>

        {departments.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No departments available yet.</p>
            <p className="text-xs mt-1">Ask your administrator to add departments and services.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => {
                  setSelectedDept(dept.id)
                  setSelectedService('')
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  selectedDept === dept.id
                    ? 'border-[#22C55E] bg-[#22C55E]/5 text-[#22C55E]'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-medium text-sm">{dept.name}</div>
                  <div className="text-xs text-gray-400">
                    {dept.services.filter((s) => s.active).length} service
                    {dept.services.filter((s) => s.active).length !== 1 ? 's' : ''}
                  </div>
                </div>
                {selectedDept === dept.id && (
                  <CheckCircle2 className="w-4 h-4 ml-auto text-[#22C55E]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Service */}
      {selectedDept && activeDept && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center text-white text-xs font-bold">
              2
            </div>
            <span className="text-sm font-semibold text-gray-700">Select Service</span>
          </div>

          <div className="space-y-2">
            {activeDept.services
              .filter((s) => s.active)
              .map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => setSelectedService(svc.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    selectedService === svc.id
                      ? 'border-[#22C55E] bg-[#22C55E]/5'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        selectedService === svc.id
                          ? 'bg-[#22C55E] text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {svc.prefix}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{svc.name}</div>
                      <div className="text-xs text-gray-400">
                        ~{svc.avg_duration} min per person
                      </div>
                    </div>
                  </div>
                  {selectedService === svc.id && (
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                  )}
                </button>
              ))}

            {activeDept.services.filter((s) => !s.active).length > 0 && (
              <div className="pt-2 space-y-2">
                {activeDept.services
                  .filter((s) => !s.active)
                  .map((svc) => (
                    <div
                      key={svc.id}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center font-bold text-sm text-gray-400">
                        {svc.prefix}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-gray-400">{svc.name}</div>
                        <div className="text-xs text-red-400">Temporarily unavailable</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {selectedService && activeService && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center text-white text-xs font-bold">
              3
            </div>
            <span className="text-sm font-semibold text-gray-700">Confirm</span>
          </div>

          <div className="bg-[#F5F5F5] rounded-xl p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Department</span>
              <span className="font-medium text-gray-900">{activeDept?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Service</span>
              <span className="font-medium text-gray-900">{activeService.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Avg. duration</span>
              <span className="font-medium text-gray-900">~{activeService.avg_duration} min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Token prefix</span>
              <span className="font-bold text-[#22C55E]">{activeService.prefix}-###</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            You can wait nearby instead of standing in line. We&apos;ll update your position in real
            time on the &quot;My Queue&quot; page.
          </p>

          <button
            id="get-token-submit-btn"
            onClick={handleGetToken}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#22C55E] text-white font-semibold py-3 px-4 rounded-xl hover:bg-[#16A34A] transition-colors shadow-lg shadow-green-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Ticket className="w-5 h-5" />
            )}
            {loading ? 'Getting your token…' : 'Get Token'}
          </button>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Token Result Card — shown after successful token creation
// ──────────────────────────────────────────────────────────
function TokenResultCard({
  token,
  service,
  onReset,
}: {
  token: Token
  service: { name: string; prefix: string; avg_duration: number } | undefined
  onReset: () => void
}) {
  const statusLabel: Record<string, string> = {
    waiting: 'Waiting',
    called: 'Called — please proceed',
    in_service: 'In Service',
    completed: 'Completed',
    missed: 'Missed',
  }

  return (
    <div className="space-y-4">
      {/* Big token card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Green header band */}
        <div className="bg-[#22C55E] px-6 py-4 text-white">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            Token issued successfully
          </div>
          <div className="text-5xl font-black tracking-widest">{token.token_number}</div>
          {service && <div className="text-sm opacity-80 mt-1">{service.name}</div>}
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-1 bg-[#F5F5F5] rounded-xl p-4">
            <Users className="w-5 h-5 text-[#22C55E]" />
            <span className="text-2xl font-bold text-gray-900">
              {token.queue_position != null ? token.queue_position - 1 : '—'}
            </span>
            <span className="text-xs text-gray-500 text-center">People ahead</span>
          </div>
          <div
            className="flex flex-col items-center gap-1 bg-emerald-50/40 rounded-xl p-4 border border-emerald-100/80 cursor-help"
            title="AI-estimated wait based on 20 recent services and live counter throughput"
          >
            <div className="flex items-center gap-1 text-[#16A34A]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">AI Estimate</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {token.estimated_wait != null ? `${token.estimated_wait}` : '—'}
            </span>
            <span className="text-xs text-gray-600 text-center font-medium">AI-estimated wait (min)</span>
            <span className="text-[10px] text-gray-400">based on 20 recent services</span>
          </div>
        </div>

        <div className="px-6 pb-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              STATUS_COLORS[token.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {statusLabel[token.status] ?? token.status}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm text-gray-600 mb-4">
          💡 <strong>You can wait nearby</strong> instead of standing in line. Your live position
          and estimated wait time are updated in real time on the{' '}
          <strong>My Queue</strong> page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/my"
            id="view-my-queue-btn"
            prefetch={false}
            className="flex-1 flex items-center justify-center gap-2 bg-[#22C55E] text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-[#16A34A] transition-colors"
          >
            Track Live Position
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={onReset}
            className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Get Another Token
          </button>
        </div>
      </div>
    </div>
  )
}
