'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface AdminUserItem {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'customer' | 'staff' | 'manager' | 'admin'
  account_status: string
  no_show_count: number
  created_at: string
}

export interface AdminDepartmentItem {
  id: string
  name: string
  open_time: string
  close_time: string
  slot_minutes: number
  max_per_slot: number
  created_at: string
  services_count?: number
  counters_count?: number
}

export interface AdminServiceItem {
  id: string
  department_id: string
  department_name: string
  name: string
  prefix: string
  avg_duration: number
  priority_level: number
  active: boolean
}

export interface AdminRuleItem {
  department_id: string
  department_name: string
  max_appts_per_user_day: number
  max_active_tokens: number
  cancel_limit: number
  late_checkin_minutes: number
  early_checkin_minutes: number
}

export interface AdminActivityLogItem {
  id: string
  actor: string | null
  actor_name: string
  actor_email: string
  action: string
  entity: string | null
  entity_id: string | null
  created_at: string
}

export interface AdminData {
  users: AdminUserItem[]
  departments: AdminDepartmentItem[]
  services: AdminServiceItem[]
  rules: AdminRuleItem[]
  logs: AdminActivityLogItem[]
}

export async function getAdminData(): Promise<AdminData> {
  const supabase = await createClient()

  // 1. Fetch Users
  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, account_status, no_show_count, created_at')
    .order('created_at', { ascending: false })

  // 2. Fetch Departments
  const { data: depts } = await supabase
    .from('departments')
    .select(`
      id,
      name,
      open_time,
      close_time,
      slot_minutes,
      max_per_slot,
      created_at,
      services(id),
      counters(id)
    `)
    .order('name')

  // 3. Fetch Services
  const { data: servs } = await supabase
    .from('services')
    .select(`
      id,
      department_id,
      name,
      prefix,
      avg_duration,
      priority_level,
      active,
      departments(name)
    `)
    .order('name')

  // 4. Fetch Rules
  const { data: rules } = await supabase
    .from('rules')
    .select(`
      department_id,
      max_appts_per_user_day,
      max_active_tokens,
      cancel_limit,
      late_checkin_minutes,
      early_checkin_minutes,
      departments(name)
    `)

  // 5. Fetch Activity Logs
  const { data: logs } = await supabase
    .from('activity_logs')
    .select(`
      id,
      actor,
      action,
      entity,
      entity_id,
      created_at,
      profiles!activity_logs_actor_fkey(name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  // Map departments
  const formattedDepts: AdminDepartmentItem[] = (depts ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    open_time: d.open_time,
    close_time: d.close_time,
    slot_minutes: d.slot_minutes,
    max_per_slot: d.max_per_slot,
    created_at: d.created_at,
    services_count: Array.isArray(d.services) ? d.services.length : 0,
    counters_count: Array.isArray(d.counters) ? d.counters.length : 0,
  }))

  // Map services
  const formattedServs: AdminServiceItem[] = (servs ?? []).map((s: any) => ({
    id: s.id,
    department_id: s.department_id,
    department_name: s.departments?.name ?? 'Unknown',
    name: s.name,
    prefix: s.prefix,
    avg_duration: s.avg_duration,
    priority_level: s.priority_level,
    active: s.active,
  }))

  // Map rules (ensure all departments have rule representation)
  const rulesMap = new Map<string, any>()
  for (const r of rules ?? []) {
    rulesMap.set(r.department_id, r)
  }

  const formattedRules: AdminRuleItem[] = formattedDepts.map((d) => {
    const r = rulesMap.get(d.id)
    return {
      department_id: d.id,
      department_name: d.name,
      max_appts_per_user_day: r?.max_appts_per_user_day ?? 2,
      max_active_tokens: r?.max_active_tokens ?? 1,
      cancel_limit: r?.cancel_limit ?? 3,
      late_checkin_minutes: r?.late_checkin_minutes ?? 10,
      early_checkin_minutes: r?.early_checkin_minutes ?? 10,
    }
  })

  // Map activity logs
  const formattedLogs: AdminActivityLogItem[] = (logs ?? []).map((l: any) => ({
    id: l.id,
    actor: l.actor,
    actor_name: l.profiles?.name || 'System / Automated',
    actor_email: l.profiles?.email || 'system@queueflow.internal',
    action: l.action,
    entity: l.entity,
    entity_id: l.entity_id,
    created_at: l.created_at,
  }))

  return {
    users: (users ?? []) as AdminUserItem[],
    departments: formattedDepts,
    services: formattedServs,
    rules: formattedRules,
    logs: formattedLogs,
  }
}

export async function updateUserRole(
  userId: string,
  role: 'customer' | 'staff' | 'manager' | 'admin',
  status: string = 'active'
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('admin_update_user_role', {
      p_user_id: userId,
      p_role: role,
      p_status: status,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    revalidatePath('/staff')
    revalidatePath('/manager')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update user role' }
  }
}

export async function updateDepartmentRules(
  deptId: string,
  maxAppts: number,
  maxTokens: number,
  cancelLimit: number,
  lateMin: number,
  earlyMin: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('admin_update_rules', {
      p_dept_id: deptId,
      p_max_appts: maxAppts,
      p_max_tokens: maxTokens,
      p_cancel_limit: cancelLimit,
      p_late_min: lateMin,
      p_early_min: earlyMin,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    revalidatePath('/token')
    revalidatePath('/book')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update department rules' }
  }
}

export async function createDepartment(
  name: string,
  openTime: string,
  closeTime: string,
  slotMinutes: number,
  maxPerSlot: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { data: dept, error } = await supabase
      .from('departments')
      .insert({
        name,
        open_time: openTime,
        close_time: closeTime,
        slot_minutes: slotMinutes,
        max_per_slot: maxPerSlot,
      })
      .select('id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Initialize default rules for the new department
    if (dept) {
      await supabase.from('rules').insert({
        department_id: dept.id,
        max_appts_per_user_day: 2,
        max_active_tokens: 1,
        cancel_limit: 3,
        late_checkin_minutes: 10,
        early_checkin_minutes: 10,
      })
    }

    revalidatePath('/admin')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create department' }
  }
}

export async function updateDepartment(
  id: string,
  name: string,
  openTime: string,
  closeTime: string,
  slotMinutes: number,
  maxPerSlot: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('departments')
      .update({
        name,
        open_time: openTime,
        close_time: closeTime,
        slot_minutes: slotMinutes,
        max_per_slot: maxPerSlot,
      })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update department' }
  }
}

export async function deleteDepartment(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('departments').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete department' }
  }
}

export async function createService(
  departmentId: string,
  name: string,
  prefix: string,
  avgDuration: number,
  priorityLevel: number,
  active: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('services').insert({
      department_id: departmentId,
      name,
      prefix: prefix.toUpperCase().slice(0, 1),
      avg_duration: avgDuration,
      priority_level: priorityLevel,
      active,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create service' }
  }
}

export async function updateService(
  id: string,
  name: string,
  prefix: string,
  avgDuration: number,
  priorityLevel: number,
  active: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('services')
      .update({
        name,
        prefix: prefix.toUpperCase().slice(0, 1),
        avg_duration: avgDuration,
        priority_level: priorityLevel,
        active,
      })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update service' }
  }
}

export async function deleteService(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('services').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete service' }
  }
}

export async function triggerSystemMaintenance(): Promise<{
  remindersSent: number
  missedCleaned: number
  error: string | null
}> {
  try {
    const supabase = await createClient()

    const [remindersRes, missedRes] = await Promise.all([
      supabase.rpc('send_reminders'),
      supabase.rpc('mark_missed_appointments'),
    ])

    return {
      remindersSent: remindersRes.data ?? 0,
      missedCleaned: missedRes.data ?? 0,
      error: null,
    }
  } catch (err: any) {
    return { remindersSent: 0, missedCleaned: 0, error: err.message }
  }
}
