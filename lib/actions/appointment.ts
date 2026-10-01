'use server'

import { createClient } from '@/lib/supabase/server'
import type { Appointment, AppointmentWithDetails, TimeSlot, Token } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function getAvailableSlots(
  serviceId: string,
  date: string
): Promise<TimeSlot[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_available_slots', {
    p_service: serviceId,
    p_date: date,
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
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('book_appointment', {
    p_service: serviceId,
    p_date: date,
    p_start: startTime,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const appt = Array.isArray(data) ? data[0] : data
  revalidatePath('/book')
  revalidatePath('/my')
  return { data: (appt as Appointment) ?? null, error: null }
}

export async function checkInAppointment(
  appointmentId: string
): Promise<{ token: Token | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('check_in', {
    p_appointment: appointmentId,
  })

  if (error) {
    return { token: null, error: error.message }
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
  const supabase = await createClient()

  const { error } = await supabase.rpc('cancel_appointment', {
    p_appointment: appointmentId,
  })

  if (error) {
    return { success: false, error: error.message }
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
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('reschedule_appointment', {
    p_appointment: appointmentId,
    p_date: date,
    p_start: startTime,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const appt = Array.isArray(data) ? data[0] : data
  revalidatePath('/my')
  revalidatePath('/staff')
  return { data: (appt as Appointment) ?? null, error: null }
}

export async function getUserAppointments(
  userId: string
): Promise<AppointmentWithDetails[]> {
  const supabase = await createClient()

  // Run lazy maintenance check for missed appointments
  try {
    await supabase.rpc('mark_missed_appointments')
  } catch {
    // Ignore lazy check errors
  }

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
    .eq('user_id', userId)
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
