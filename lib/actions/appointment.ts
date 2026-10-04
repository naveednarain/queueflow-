'use server'

import { createClient } from '@/lib/supabase/server'
import type { Appointment, AppointmentWithDetails, TimeSlot, Token } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const postgresUuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const bookSchema = z.object({
  serviceId: z.string().regex(postgresUuidRegex, 'Invalid service selected'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  startTime: z.string().min(4).max(10),
})

const uuidSchema = z.string().regex(postgresUuidRegex, 'Invalid record ID')

function sanitizeErrorMessage(msg?: string): string {
  if (!msg) return 'Operation failed. Please try again.'
  if (
    msg.includes('already full') ||
    msg.includes('past') ||
    msg.includes('already have') ||
    msg.includes('working hours') ||
    msg.includes('working day') ||
    msg.includes('closed') ||
    msg.includes('Off Day') ||
    msg.includes('off day') ||
    msg.includes('break time') ||
    msg.includes('maximum') ||
    msg.includes('window') ||
    msg.includes('Unauthorized') ||
    msg.includes('authenticated')
  ) {
    return msg
  }
  return 'A temporary system error occurred. Please try again.'
}

export async function getAvailableSlots(
  serviceId: string,
  date: string
): Promise<TimeSlot[]> {
  const parsed = z.object({
    serviceId: z.string().regex(postgresUuidRegex, 'Invalid service selected'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).safeParse({ serviceId, date })

  if (!parsed.success) return []

  const supabase = await createClient()

  // Pre-check working days for the department
  const { data: svc } = await supabase
    .from('services')
    .select('department_id, departments(working_days)')
    .eq('id', parsed.data.serviceId)
    .single()

  if (svc) {
    const [y, m, d] = parsed.data.date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const deptWorkingDays: number[] = (svc as any)?.departments?.working_days ?? [1, 2, 3, 4, 5]
    if (!deptWorkingDays.includes(dow)) {
      // Off day: Return empty slots immediately
      return []
    }
  }

  const { data, error } = await supabase.rpc('get_available_slots', {
    p_service: parsed.data.serviceId,
    p_date: parsed.data.date,
  })

  if (error || !data) {
    return []
  }

  return (data as any[]).map((s) => ({
    start_time: s.start_time,
    end_time: s.end_time,
    max_capacity: s.max_capacity,
    booked_count: s.booked_count,
    status: s.status as 'available' | 'full',
  }))
}

export async function bookAppointment(
  serviceId: string,
  date: string,
  startTime: string
): Promise<{ data: Appointment | null; error: string | null }> {
  const parsed = bookSchema.safeParse({ serviceId, date, startTime })
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  // Validate department working days before calling RPC
  const { data: svc } = await supabase
    .from('services')
    .select('department_id, departments(name, working_days)')
    .eq('id', parsed.data.serviceId)
    .single()

  if (svc) {
    const [y, m, d] = parsed.data.date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const deptWorkingDays: number[] = (svc as any)?.departments?.working_days ?? [1, 2, 3, 4, 5]
    if (!deptWorkingDays.includes(dow)) {
      return {
        data: null,
        error: 'Department is closed on this day (Off Day). Appointments cannot be booked.',
      }
    }
  }

  const { data, error } = await supabase.rpc('book_appointment', {
    p_service: parsed.data.serviceId,
    p_date: parsed.data.date,
    p_start: parsed.data.startTime,
  })

  if (error) {
    return { data: null, error: sanitizeErrorMessage(error.message) }
  }

  const appt = Array.isArray(data) ? data[0] : data
  revalidatePath('/book')
  revalidatePath('/my')
  return { data: (appt as Appointment) ?? null, error: null }
}

export async function checkInAppointment(
  appointmentId: string
): Promise<{ token: Token | null; error: string | null }> {
  const parsed = uuidSchema.safeParse(appointmentId)
  if (!parsed.success) {
    return { token: null, error: 'Invalid appointment ID' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('check_in', {
    p_appointment: parsed.data,
  })

  if (error) {
    return { token: null, error: sanitizeErrorMessage(error.message) }
  }

  const token = Array.isArray(data) ? data[0] : data
  revalidatePath('/my')
  revalidatePath('/staff')
  revalidatePath('/display')
  return { token: (token as Token) ?? null, error: null }
}

export async function cancelAppointment(
  appointmentId: string
): Promise<{ success: boolean; error: string | null }> {
  const parsed = uuidSchema.safeParse(appointmentId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid appointment ID' }
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('cancel_appointment', {
    p_appointment: parsed.data,
  })

  if (error) {
    return { success: false, error: sanitizeErrorMessage(error.message) }
  }

  revalidatePath('/my')
  revalidatePath('/staff')
  return { success: true, error: null }
}

export async function rescheduleAppointment(
  appointmentId: string,
  date: string,
  startTime: string
): Promise<{ data: Appointment | null; error: string | null }> {
  const parsed = z.object({
    appointmentId: z.string().regex(postgresUuidRegex, 'Invalid appointment ID'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    startTime: z.string().min(4).max(10),
  }).safeParse({ appointmentId, date, startTime })

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('reschedule_appointment', {
    p_appointment: parsed.data.appointmentId,
    p_date: parsed.data.date,
    p_start: parsed.data.startTime,
  })

  if (error) {
    return { data: null, error: sanitizeErrorMessage(error.message) }
  }

  const appt = Array.isArray(data) ? data[0] : data
  revalidatePath('/my')
  revalidatePath('/staff')
  return { data: (appt as Appointment) ?? null, error: null }
}

export async function getUserAppointments(
  userId: string
): Promise<AppointmentWithDetails[]> {
  const parsed = uuidSchema.safeParse(userId)
  if (!parsed.success) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      services(
        id,
        name,
        prefix,
        avg_duration,
        departments(id, name)
      ),
      tokens(
        id,
        token_number,
        status
      )
    `)
    .eq('user_id', parsed.data)
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: false })

  if (error || !data) return []

  return data as AppointmentWithDetails[]
}

export async function markMissedAppointments(): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('mark_missed_appointments')
  if (error) return 0
  return Number(data) || 0
}
