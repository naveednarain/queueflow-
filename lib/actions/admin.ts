'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

  // All 5 queries run in parallel — previously sequential (4-5x speedup)
  const [usersRes, deptsRes, servsRes, rulesRes, logsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, phone, role, account_status, no_show_count, created_at')
      .order('created_at', { ascending: false }),

    supabase
      .from('departments')
      .select('id, name, open_time, close_time, slot_minutes, max_per_slot, created_at, services(id), counters(id)')
      .order('name'),

    supabase
      .from('services')
      .select('id, department_id, name, prefix, avg_duration, priority_level, active, departments(name)')
      .order('name'),

    supabase
      .from('rules')
      .select('department_id, max_appts_per_user_day, max_active_tokens, cancel_limit, late_checkin_minutes, early_checkin_minutes, departments(name)'),

    supabase
      .from('activity_logs')
      .select('id, actor, action, entity, entity_id, created_at, profiles!activity_logs_actor_fkey(name, email)')
      .order('created_at', { ascending: false })
      .limit(50), // Reduced from 100 to 50 for faster transfer
  ])

  const users = usersRes.data
  const depts = deptsRes.data
  const servs = servsRes.data
  const rules = rulesRes.data
  const logs = logsRes.data

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
  const formattedServs: AdminServiceItem[] = (servs ?? []).map((s: any) => {
    const dept = Array.isArray(s.departments) ? s.departments[0] : s.departments
    return {
      id: s.id,
      department_id: s.department_id,
      department_name: dept?.name ?? 'General',
      name: s.name,
      prefix: s.prefix,
      avg_duration: s.avg_duration,
      priority_level: s.priority_level,
      active: s.active,
    }
  })

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
  const formattedLogs: AdminActivityLogItem[] = (logs ?? []).map((l: any) => {
    const prof = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
    return {
      id: l.id,
      actor: l.actor,
      actor_name: prof?.name || 'System / Automated',
      actor_email: prof?.email || 'system@queueflow.internal',
      action: l.action,
      entity: l.entity,
      entity_id: l.entity_id,
      created_at: l.created_at,
    }
  })

  return {
    users: (users ?? []) as AdminUserItem[],
    departments: formattedDepts,
    services: formattedServs,
    rules: formattedRules,
    logs: formattedLogs,
  }
}

const postgresUuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const uuidSchema = z.string().regex(postgresUuidRegex, 'Invalid ID')
const userRoleSchema = z.enum(['customer', 'staff', 'manager', 'admin'])

const departmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Name must be 80 characters or less'),
  openTime: z.string().min(4).max(8),
  closeTime: z.string().min(4).max(8),
  slotMinutes: z.number().int().min(5).max(120),
  maxPerSlot: z.number().int().min(1).max(50),
})

const serviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Name must be 80 characters or less'),
  prefix: z.string().min(1, 'Prefix must be at least 1 character').max(5, 'Prefix must be 5 characters or less'),
  avgDuration: z.number().int().min(1).max(180),
  priorityLevel: z.number().int().min(0).max(10),
  active: z.boolean(),
})

const rulesSchema = z.object({
  deptId: z.string().regex(postgresUuidRegex, 'Invalid department ID'),
  maxAppts: z.number().int().min(1).max(20),
  maxTokens: z.number().int().min(1).max(10),
  cancelLimit: z.number().int().min(1).max(20),
  lateMin: z.number().int().min(1).max(60),
  earlyMin: z.number().int().min(1).max(60),
})

function sanitizeAdminError(msg?: string): string {
  if (!msg) return 'Operation failed. Please try again.'
  if (
    msg.includes('Unauthorized') ||
    msg.includes('not found') ||
    msg.includes('already exists')
  ) {
    return msg
  }
  return 'A temporary administrative error occurred. Please try again.'
}

export async function updateUserRole(
  userId: string,
  role: 'customer' | 'staff' | 'manager' | 'admin',
  status: string = 'active'
): Promise<{ success: boolean; error: string | null }> {
  const parsedId = uuidSchema.safeParse(userId)
  const parsedRole = userRoleSchema.safeParse(role)
  if (!parsedId.success || !parsedRole.success) {
    return { success: false, error: 'Invalid user ID or role parameter.' }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('admin_update_user_role', {
      p_user_id: parsedId.data,
      p_role: parsedRole.data,
      p_status: status.slice(0, 20),
    })

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
    }

    revalidatePath('/admin')
    revalidatePath('/staff')
    revalidatePath('/manager')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err.message) }
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
  const parsed = rulesSchema.safeParse({
    deptId,
    maxAppts,
    maxTokens,
    cancelLimit,
    lateMin,
    earlyMin,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('admin_update_rules', {
      p_dept_id: parsed.data.deptId,
      p_max_appts: parsed.data.maxAppts,
      p_max_tokens: parsed.data.maxTokens,
      p_cancel_limit: parsed.data.cancelLimit,
      p_late_min: parsed.data.lateMin,
      p_early_min: parsed.data.earlyMin,
    })

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
    }

    revalidatePath('/admin')
    revalidatePath('/token')
    revalidatePath('/book')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err.message) }
  }
}

export async function createDepartment(
  name: string,
  openTime: string,
  closeTime: string,
  slotMinutes: number,
  maxPerSlot: number
): Promise<{ success: boolean; error: string | null }> {
  const parsed = departmentSchema.safeParse({
    name,
    openTime,
    closeTime,
    slotMinutes,
    maxPerSlot,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await createClient()

    const { data: dept, error } = await supabase
      .from('departments')
      .insert({
        name: parsed.data.name,
        open_time: parsed.data.openTime,
        close_time: parsed.data.closeTime,
        slot_minutes: parsed.data.slotMinutes,
        max_per_slot: parsed.data.maxPerSlot,
      })
      .select('id')
      .single()

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
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
    return { success: false, error: sanitizeAdminError(err.message) }
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
  const parsedId = uuidSchema.safeParse(id)
  const parsed = departmentSchema.safeParse({
    name,
    openTime,
    closeTime,
    slotMinutes,
    maxPerSlot,
  })
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: 'Invalid department data provided.' }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('departments')
      .update({
        name: parsed.data.name,
        open_time: parsed.data.openTime,
        close_time: parsed.data.closeTime,
        slot_minutes: parsed.data.slotMinutes,
        max_per_slot: parsed.data.maxPerSlot,
      })
      .eq('id', parsedId.data)

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err.message) }
  }
}

export async function deleteDepartment(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false, error: 'Invalid department ID.' }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.from('departments').delete().eq('id', parsedId.data)

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err.message) }
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
  const parsedDeptId = uuidSchema.safeParse(departmentId)
  const parsed = serviceSchema.safeParse({
    name,
    prefix,
    avgDuration,
    priorityLevel,
    active,
  })
  if (!parsedDeptId.success || !parsed.success) {
    return { success: false, error: 'Invalid service data provided.' }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.from('services').insert({
      department_id: parsedDeptId.data,
      name: parsed.data.name,
      prefix: parsed.data.prefix.toUpperCase().slice(0, 1),
      avg_duration: parsed.data.avgDuration,
      priority_level: parsed.data.priorityLevel,
      active: parsed.data.active,
    })

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err.message) }
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
  const parsedId = uuidSchema.safeParse(id)
  const parsed = serviceSchema.safeParse({
    name,
    prefix,
    avgDuration,
    priorityLevel,
    active,
  })
  if (!parsedId.success || !parsed.success) {
    return { success: false, error: 'Invalid service data provided.' }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('services')
      .update({
        name: parsed.data.name,
        prefix: parsed.data.prefix.toUpperCase().slice(0, 1),
        avg_duration: parsed.data.avgDuration,
        priority_level: parsed.data.priorityLevel,
        active: parsed.data.active,
      })
      .eq('id', parsedId.data)

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
    }

    revalidatePath('/admin')
    revalidatePath('/manager')
    revalidatePath('/book')
    revalidatePath('/token')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: sanitizeAdminError(err.message) }
  }
}

export async function deleteService(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false, error: 'Invalid service ID.' }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.from('services').delete().eq('id', parsedId.data)

    if (error) {
      return { success: false, error: sanitizeAdminError(error.message) }
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
