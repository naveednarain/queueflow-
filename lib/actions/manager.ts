'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DashboardSummary {
  appts_today: number
  walkin_tokens: number
  waiting_tokens: number
  active_counters: number
  completed_tokens: number
  missed_tokens: number
  cancelled_appts: number
  avg_wait_minutes: number
  avg_service_minutes: number
  busiest_department: string
  busiest_service: string
  peak_hour: string
  no_show_rate: number
  cancellation_rate: number
}

export interface DashboardCharts {
  queue_by_hour: Array<{ hour: string; raw_hour: number; count: number; is_peak: boolean }>
  wait_by_department: Array<{ department: string; avg_wait: number; token_count: number }>
  staff_workload: Array<{ staff_name: string; completed: number; avg_duration: number }>
  service_completion_time: Array<{
    service: string
    avg_duration: number
    target_duration: number
    completed_count: number
  }>
  daily_trend: Array<{ date: string; tokens: number; appointments: number }>
}

export interface DashboardData {
  summary: DashboardSummary
  charts: DashboardCharts
}

export interface ManagerCounterItem {
  id: string
  name: string
  status: 'available' | 'busy' | 'break' | 'closed'
  service_id: string | null
  assigned_staff: string | null
  department_id: string
  department_name?: string
  service_name?: string
  staff_name?: string
}

export interface ManagerServiceItem {
  id: string
  department_id: string
  department_name?: string
  name: string
  prefix: string
  avg_duration: number
  priority_level: number
  active: boolean
}

export interface ManagerDepartmentItem {
  id: string
  name: string
  open_time: string
  close_time: string
  slot_minutes: number
  max_per_slot: number
}

export async function fetchDashboardStats(
  fromDate?: string,
  toDate?: string
): Promise<{ data: DashboardData | null; error: string | null }> {
  try {
    const supabase = await createClient()

    const params: { p_from?: string; p_to?: string } = {}
    if (fromDate) params.p_from = fromDate
    if (toDate) params.p_to = toDate

    const { data, error } = await supabase.rpc('get_dashboard_stats', params)

    if (error) {
      console.error('Error fetching dashboard stats:', error)
      return { data: null, error: error.message }
    }

    return { data: data as DashboardData, error: null }
  } catch (err: any) {
    console.error('Unexpected error in fetchDashboardStats:', err)
    return { data: null, error: err.message || 'Failed to fetch dashboard data' }
  }
}

export async function getManagementData(): Promise<{
  counters: ManagerCounterItem[]
  services: ManagerServiceItem[]
  departments: ManagerDepartmentItem[]
  staffList: Array<{ id: string; name: string; email: string; role: string }>
}> {
  const supabase = await createClient()

  // All 4 queries run in parallel — previously sequential
  const [countersRes, servicesRes, departmentsRes, staffRes] = await Promise.all([
    supabase
      .from('counters')
      .select('id, name, status, service_id, assigned_staff, department_id, departments(name), services(name), profiles(name)')
      .order('name'),

    supabase
      .from('services')
      .select('id, department_id, name, prefix, avg_duration, priority_level, active, departments(name)')
      .order('name'),

    supabase
      .from('departments')
      .select('id, name, open_time, close_time, slot_minutes, max_per_slot')
      .order('name'),

    supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('role', ['staff', 'manager', 'admin'])
      .order('name'),
  ])

  const formattedCounters: ManagerCounterItem[] = (countersRes.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    service_id: c.service_id,
    assigned_staff: c.assigned_staff,
    department_id: c.department_id,
    department_name: c.departments?.name ?? '',
    service_name: c.services?.name ?? '',
    staff_name: c.profiles?.name ?? '',
  }))

  const formattedServices: ManagerServiceItem[] = (servicesRes.data ?? []).map((s: any) => ({
    id: s.id,
    department_id: s.department_id,
    department_name: s.departments?.name ?? '',
    name: s.name,
    prefix: s.prefix,
    avg_duration: s.avg_duration,
    priority_level: s.priority_level,
    active: s.active,
  }))

  return {
    counters: formattedCounters,
    services: formattedServices,
    departments: (departmentsRes.data ?? []) as ManagerDepartmentItem[],
    staffList: (staffRes.data ?? []) as any[],
  }
}

export async function saveCounterConfig(
  counterId: string,
  status: string,
  serviceId: string | null,
  staffId: string | null
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('update_counter_config', {
      p_counter_id: counterId,
      p_status: status,
      p_service_id: serviceId || null,
      p_assigned_staff: staffId || null,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/manager')
    revalidatePath('/staff')
    revalidatePath('/display')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update counter' }
  }
}

export async function saveServiceConfig(
  serviceId: string,
  avgDuration: number,
  active: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('update_service_config', {
      p_service_id: serviceId,
      p_avg_duration: avgDuration,
      p_active: active,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update service' }
  }
}

export async function saveDepartmentConfig(
  deptId: string,
  openTime: string,
  closeTime: string,
  slotMinutes: number,
  maxPerSlot: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('update_department_config', {
      p_dept_id: deptId,
      p_open_time: openTime,
      p_close_time: closeTime,
      p_slot_minutes: slotMinutes,
      p_max_per_slot: maxPerSlot,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/manager')
    revalidatePath('/book')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update department' }
  }
}
