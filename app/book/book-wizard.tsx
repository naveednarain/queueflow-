'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Ticket,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { bookAppointment, getAvailableSlots } from '@/lib/actions/appointment'
import type { DepartmentGroup, TimeSlot, Appointment } from '@/lib/types'

interface Props {
  departments: DepartmentGroup[]
  userEmail: string
}

export default function BookWizard({ departments, userEmail }: Props) {
  const router = useRouter()
  // Wizard steps: 1 = Department, 2 = Service, 3 = Date & Slot, 4 = Confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
    } else if (step === 3) {
      setStep(2)
    } else {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
      } else {
        router.push('/')
      }
    }
  }

  const [selectedDeptId, setSelectedDeptId] = useState<string>('')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingPending, setBookingPending] = useState(false)
  const [confirmedAppt, setConfirmedAppt] = useState<Appointment | null>(null)

  // Local date formatter (avoids UTC timezone shift of toISOString)
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Next 8 days list (Today + next 7 days)
  const next7Days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const isoDate = formatLocalDate(d)
    const weekday = i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })
    const dayMonth = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    return { isoDate, weekday, dayMonth, isToday: i === 0 }
  })

  // Selected department and service objects
  const currentDept = departments.find((d) => d.id === selectedDeptId)
  const currentService = currentDept?.services.find((s) => s.id === selectedServiceId)
  const deptWorkingDays = currentDept?.working_days ?? [1, 2, 3, 4, 5]

  // Check if selectedDate is a working day
  const isSelectedDateWorkingDay = (() => {
    if (!selectedDate) return false
    const [y, m, dayNum] = selectedDate.split('-').map(Number)
    const dow = new Date(y, m - 1, dayNum).getDay()
    return deptWorkingDays.includes(dow)
  })()

  // Fetch slots whenever service or date changes in step 3
  useEffect(() => {
    if (!selectedServiceId || !selectedDate) return

    setSelectedSlot(null)

    const [y, m, dayNum] = selectedDate.split('-').map(Number)
    const dow = new Date(y, m - 1, dayNum).getDay()
    if (!deptWorkingDays.includes(dow)) {
      setSlots([])
      setLoadingSlots(false)
      return
    }

    setLoadingSlots(true)
    getAvailableSlots(selectedServiceId, selectedDate)
      .then((data) => {
        setSlots(data || [])
      })
      .catch(() => {
        toast.error('Failed to load slots for this date')
        setSlots([])
      })
      .finally(() => {
        setLoadingSlots(false)
      })
  }, [selectedServiceId, selectedDate, deptWorkingDays])

  const handleSelectDepartment = (deptId: string) => {
    setSelectedDeptId(deptId)
    setSelectedServiceId('')
    setSelectedSlot(null)
    setStep(2)
  }

  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId)
    setSelectedSlot(null)

    const dept = departments.find((d) => d.id === selectedDeptId)
    const workingDays = dept?.working_days ?? [1, 2, 3, 4, 5]

    // Find the next available working day from tomorrow (index 1) or today (index 0)
    const firstWorking =
      next7Days.slice(1).find((d) => {
        const [y, m, dayNum] = d.isoDate.split('-').map(Number)
        return workingDays.includes(new Date(y, m - 1, dayNum).getDay())
      }) ||
      next7Days.find((d) => {
        const [y, m, dayNum] = d.isoDate.split('-').map(Number)
        return workingDays.includes(new Date(y, m - 1, dayNum).getDay())
      })

    setSelectedDate(firstWorking?.isoDate || next7Days[0].isoDate)
    setStep(3)
  }

  const handleConfirmBooking = async () => {
    if (!selectedServiceId || !selectedDate || !selectedSlot || bookingPending) return
    if (!isSelectedDateWorkingDay) {
      toast.error('Department is closed on this day (Off Day)')
      return
    }
    setBookingPending(true)

    try {
      const res = await bookAppointment(
        selectedServiceId,
        selectedDate,
        selectedSlot.start_time
      )

      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        toast.success('Appointment booked successfully!')
        setConfirmedAppt(res.data)
        setStep(4)
      }
    } catch {
      toast.error('An unexpected error occurred while booking')
    } finally {
      setBookingPending(false)
    }
  }

  const handleReset = () => {
    setStep(1)
    setSelectedDeptId('')
    setSelectedServiceId('')
    setSelectedSlot(null)
    setConfirmedAppt(null)
  }

  // Format time (e.g. 09:00:00 -> 9:00 AM)
  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${m} ${ampm}`
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ── Wizard Progress Header ─────────────────────────────────── */}
      <div className="bg-gray-50/70 border-b border-gray-100 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200 shadow-xs transition-all duration-200 cursor-pointer"
              title={step > 1 && step < 4 ? 'Back to previous step' : 'Go back'}
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Back</span>
            </button>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#22C55E]">
                Appointment Scheduling
              </span>
              <h1 className="text-2xl font-black text-gray-900 mt-0.5">
                {step === 1 && 'Select a Department'}
                {step === 2 && 'Choose Service'}
                {step === 3 && 'Pick Date & Slot'}
                {step === 4 && 'Appointment Confirmed!'}
              </h1>
            </div>
          </div>

          {step < 4 && (
            <div className="flex items-center gap-2">
              {[
                { s: 1, label: 'Department' },
                { s: 2, label: 'Service' },
                { s: 3, label: 'Slot' },
              ].map(({ s, label }, idx) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === s
                        ? 'bg-[#22C55E] text-white shadow-md shadow-green-200'
                        : step > s
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step > s ? '✓' : s}
                  </div>
                  <span className={`text-xs hidden md:inline font-medium ${step === s ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                    {label}
                  </span>
                  {idx < 2 && <span className="text-gray-300 text-xs hidden md:inline">→</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 md:p-8">
        {/* ── Step 1: Department Selector ──────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Select the university office you wish to visit:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleSelectDepartment(dept.id)}
                  className="text-left p-6 rounded-2xl border-2 border-gray-100 hover:border-[#22C55E] bg-white hover:bg-emerald-50/20 transition-all group flex flex-col justify-between h-48 cursor-pointer shadow-xs hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#22C55E] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Building2 className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#22C55E] transition-colors">
                      {dept.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {dept.services.length} available service{dept.services.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Service Selector ─────────────────────────────── */}
        {step === 2 && currentDept && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-medium">Department</span>
                <h3 className="text-base font-bold text-gray-900">{currentDept.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Change Dept
              </button>
            </div>

            <div className="space-y-3">
              {currentDept.services.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => handleSelectService(svc.id)}
                  className="w-full text-left p-5 rounded-2xl border-2 border-gray-100 hover:border-[#22C55E] bg-white hover:bg-emerald-50/20 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 font-mono font-bold text-gray-700 flex items-center justify-center group-hover:bg-[#22C55E] group-hover:text-white transition-colors">
                      {svc.prefix}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{svc.name}</h4>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Approx. {svc.avg_duration} mins per visit
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#22C55E] group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Date & Slot Selection ────────────────────────── */}
        {step === 3 && currentDept && currentService && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <span className="text-xs text-gray-400 font-medium">Selected Service</span>
                <h3 className="text-base font-bold text-gray-900">
                  {currentService.name} <span className="text-gray-400 text-xs font-normal">({currentDept.name})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Change Service
              </button>
            </div>

            {/* Date Carousel (Next 7 Days) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  1. Select Date (Next 7 Days)
                </label>
                <span className="text-[11px] text-gray-400 font-medium">
                  Days marked <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-extrabold text-rose-700 bg-rose-100 border border-rose-200 uppercase text-[10px]"><Lock className="w-2.5 h-2.5" /> OFF</span> are closed
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {next7Days.map((d) => {
                  const [y, m, dayNum] = d.isoDate.split('-').map(Number)
                  const dayOfWeek = new Date(y, m - 1, dayNum).getDay()
                  const isWorking = deptWorkingDays.includes(dayOfWeek)
                  const isSelected = selectedDate === d.isoDate

                  return (
                    <button
                      key={d.isoDate}
                      type="button"
                      onClick={() => {
                        setSelectedDate(d.isoDate)
                        setSelectedSlot(null)
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer relative ${
                        isSelected
                          ? isWorking
                            ? 'bg-[#22C55E] text-white border-[#22C55E] shadow-md shadow-green-200 font-bold scale-[1.03]'
                            : 'bg-gray-900 text-white border-gray-900 shadow-md font-bold scale-[1.03]'
                          : isWorking
                          ? 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                          : 'bg-rose-50/40 hover:bg-rose-50 text-gray-700 border-rose-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="block text-[11px] uppercase opacity-80">{d.weekday}</span>
                      </div>

                      <span className="block text-sm font-bold mt-0.5">{d.dayMonth}</span>

                      {!isWorking ? (
                        <span
                          className={`inline-flex items-center justify-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md mt-1 tracking-wider uppercase ${
                            isSelected
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <Lock className="w-2.5 h-2.5" /> OFF
                        </span>
                      ) : d.isToday ? (
                        <span
                          className={`block text-[10px] mt-1 font-semibold ${
                            isSelected ? 'text-green-100' : 'text-[#22C55E]'
                          }`}
                        >
                          Today
                        </span>
                      ) : (
                        <span
                          className={`block text-[10px] mt-1 font-medium ${
                            isSelected ? 'text-green-100' : 'text-gray-400'
                          }`}
                        >
                          Open
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Slot Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  2. Select Time Slot
                </label>
                {isSelectedDateWorkingDay && (
                  <span className="text-xs text-gray-400">
                    Capacity: max {slots[0]?.max_capacity ?? 4} per slot
                  </span>
                )}
              </div>

              {!isSelectedDateWorkingDay ? (
                <div className="py-8 px-6 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold mb-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    DAY OFF · SLOTS ARE OFF
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-1">
                    {currentDept.name} is Closed on{' '}
                    {selectedDate &&
                      new Date(
                        Number(selectedDate.split('-')[0]),
                        Number(selectedDate.split('-')[1]) - 1,
                        Number(selectedDate.split('-')[2])
                      ).toLocaleDateString([], { weekday: 'long' })}
                    s (OFF)
                  </h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                    Online appointment slots are locked and unavailable for this day. Please select an active working day from the calendar above to view open slots.
                  </p>

                  {/* Visual locked slot indicators */}
                  <div className="max-w-md mx-auto grid grid-cols-2 sm:grid-cols-3 gap-2 opacity-50 pointer-events-none select-none">
                    {['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM'].map(
                      (t) => (
                        <div
                          key={t}
                          className="p-2.5 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-between text-gray-400"
                        >
                          <span className="text-xs font-mono font-bold">{t}</span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-gray-200 text-gray-500 px-1 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> OFF
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : loadingSlots ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#22C55E] mb-2" />
                  <span className="text-xs font-medium">Checking available time slots...</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                  <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold">No available slots for this date.</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Please choose another date above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {slots.map((slot) => {
                    const isFull = slot.status === 'full'
                    const isSelected = selectedSlot?.start_time === slot.start_time

                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        disabled={isFull}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                          isFull
                            ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed text-gray-400'
                            : isSelected
                            ? 'bg-emerald-50 border-[#22C55E] ring-2 ring-[#22C55E] shadow-sm text-gray-900 cursor-pointer'
                            : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm">
                            {formatTime(slot.start_time)}
                          </span>
                          {isFull ? (
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.2 rounded">
                              Full
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">
                              {slot.booked_count}/{slot.max_capacity}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 block mt-1">
                          to {formatTime(slot.end_time)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bottom Confirmation Bar */}
            {selectedSlot && (
              <div className="mt-8 pt-6 border-t border-gray-100 bg-gray-50/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase font-bold text-gray-400">Appointment Summary</span>
                  <div className="text-base font-bold text-gray-900 mt-0.5">
                    {currentService.name} · {selectedDate} at {formatTime(selectedSlot.start_time)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Booking confirmation will be sent to {userEmail}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={bookingPending}
                  className="flex items-center justify-center gap-2 bg-[#22C55E] hover:bg-green-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-md shadow-green-200 transition-all cursor-pointer text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bookingPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Booking</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Booking Confirmation Result ──────────────────── */}
        {step === 4 && confirmedAppt && (
          <div className="py-8 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#22C55E] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-black text-gray-900">Appointment Confirmed!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your time slot has been secured. Please check in when you arrive on campus.
            </p>

            {/* Reference Number Card */}
            <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 my-6 text-center">
              <span className="text-xs uppercase font-bold text-gray-400 block tracking-wider">
                Booking Reference
              </span>
              <span className="text-3xl font-mono font-black text-[#22C55E] tracking-wider block mt-1">
                {confirmedAppt.ref_no}
              </span>
              <div className="mt-3 pt-3 border-t border-gray-200/80 text-xs text-gray-600 flex items-center justify-between">
                <span>Date: <strong>{confirmedAppt.appointment_date}</strong></span>
                <span>Time: <strong>{formatTime(confirmedAppt.start_time)}</strong></span>
              </div>
            </div>

            <div className="w-full space-y-2.5">
              <Link
                href="/my"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#22C55E] hover:bg-green-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-md shadow-green-200 transition-all text-sm"
              >
                <Ticket className="w-4 h-4" />
                <span>View in My Appointments</span>
              </Link>

              <button
                type="button"
                onClick={handleReset}
                className="w-full text-xs font-semibold text-gray-500 hover:text-gray-800 py-2.5 cursor-pointer"
              >
                Book Another Appointment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
