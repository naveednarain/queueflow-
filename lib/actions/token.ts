'use server'

import { createClient } from '@/lib/supabase/server'
import type { Token, DepartmentWithService, DepartmentGroup } from '@/lib/types'
import { z } from 'zod'
import { recordActivityLog } from '@/lib/actions/admin'

// PostgreSQL UUID regex: accepts 32 hex chars with hyphens (including seed data IDs)
const postgresUuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const uuidSchema = z.string().regex(postgresUuidRegex, 'Invalid service selected.')

export async function getServicesGrouped(): Promise<DepartmentGroup[]> {
  const supabase = await createClient()

  // First attempt: direct join to get departments with working_days and services
  const { data: depts, error: deptsErr } = await supabase
    .from('departments')
    .select('id, name, working_days, services(id, name, prefix, avg_duration, active)')
    .order('name')

  if (!deptsErr && depts) {
    return depts.map((d: any) => ({
      id: d.id,
      name: d.name,
      working_days: Array.isArray(d.working_days) ? d.working_days : [1, 2, 3, 4, 5],
      services: (d.services ?? []).filter((s: any) => s.active),
    }))
  }

  // Fallback: RPC or direct query
  const { data: services } = await supabase
    .from('services')
    .select('*, departments(id, name, working_days)')
    .eq('active', true)
    .order('name')

  if (!services) return []

  const grouped: Record<string, DepartmentGroup> = {}
  for (const s of services as any[]) {
    const deptId = s.department_id
    const deptName = s.departments?.name ?? 'Unknown'
    const workingDays = Array.isArray(s.departments?.working_days)
      ? s.departments.working_days
      : [1, 2, 3, 4, 5]
    if (!grouped[deptId]) {
      grouped[deptId] = {
        id: deptId,
        name: deptName,
        working_days: workingDays,
        services: [],
      }
    }
    grouped[deptId].services.push({
      id: s.id,
      name: s.name,
      prefix: s.prefix,
      avg_duration: s.avg_duration,
      active: s.active,
    })
  }
  return Object.values(grouped)
}

export async function createToken(
  serviceId: string
): Promise<{ data: Token | null; error: string | null }> {
  const parsed = uuidSchema.safeParse(serviceId)
  if (!parsed.success) {
    return { data: null, error: 'Invalid service selected.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to get a token.' }
  }

  const { data, error } = await supabase.rpc('create_token', {
    p_service: parsed.data,
  })

  if (error) {
    // Extract friendly message from Postgres exception
    const msg = error.message ?? ''
    if (msg.includes('already have an active token') || msg.includes('maximum')) {
      return {
        data: null,
        error:
          'You already have an active token. Please complete or cancel it before getting a new one.',
      }
    }
    if (msg.includes('inactive') || msg.includes('not found')) {
      return { data: null, error: 'This service is currently unavailable.' }
    }
    return { data: null, error: 'Failed to get a token. Please try again.' }
  }

  // rpc returns an array (setof)
  const token = Array.isArray(data) ? (data[0] as Token) : (data as Token)
  if (token) {
    await recordActivityLog('create_token_' + token.token_number, 'tokens', token.id)
  }
  return { data: token ?? null, error: null }
}

export async function getActiveToken(
  userId: string
): Promise<Token | null> {
  const parsed = uuidSchema.safeParse(userId)
  if (!parsed.success) return null

  const supabase = await createClient()

  const { data } = await supabase
    .from('tokens')
    .select('*')
    .eq('user_id', parsed.data)
    .in('status', ['waiting', 'called', 'recalled', 'in_service'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data as Token | null
}

export async function getTokenHistory(userId: string): Promise<Token[]> {
  const parsed = uuidSchema.safeParse(userId)
  if (!parsed.success) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('tokens')
    .select('*, services(name, prefix), counters(name)')
    .eq('user_id', parsed.data)
    .in('status', ['completed', 'skipped', 'missed', 'called'])
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as any[]
}

export async function getUserNotifications(userId: string) {
  const parsed = uuidSchema.safeParse(userId)
  if (!parsed.success) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', parsed.data)
    .order('created_at', { ascending: false })
    .limit(30)

  return data ?? []
}

export async function markNotificationRead(notificationId: string) {
  const parsed = uuidSchema.safeParse(notificationId)
  if (!parsed.success) return

  const supabase = await createClient()
  await supabase.rpc('mark_notification_read', {
    p_notification: parsed.data,
  })
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  await supabase.rpc('mark_all_notifications_read')
}
