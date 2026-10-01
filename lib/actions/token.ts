'use server'

import { createClient } from '@/lib/supabase/server'
import type { Token, DepartmentWithService, DepartmentGroup } from '@/lib/types'

export async function getServicesGrouped(): Promise<DepartmentGroup[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_departments_with_services')

  if (error || !data) {
    // Fallback: direct query if RPC not yet created
    const { data: services } = await supabase
      .from('services')
      .select('*, departments(id, name)')
      .eq('active', true)
      .order('name')

    if (!services) return []

    const grouped: Record<string, DepartmentGroup> = {}
    for (const s of services as any[]) {
      const deptId = s.department_id
      const deptName = s.departments?.name ?? 'Unknown'
      if (!grouped[deptId]) {
        grouped[deptId] = { id: deptId, name: deptName, services: [] }
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

  // Group the RPC results by department
  const grouped: Record<string, DepartmentGroup> = {}
  for (const row of data as DepartmentWithService[]) {
    if (!grouped[row.department_id]) {
      grouped[row.department_id] = {
        id: row.department_id,
        name: row.department_name,
        services: [],
      }
    }
    if (row.active) {
      grouped[row.department_id].services.push({
        id: row.service_id,
        name: row.service_name,
        prefix: row.prefix,
        avg_duration: row.avg_duration,
        active: row.active,
      })
    }
  }
  return Object.values(grouped)
}

export async function createToken(
  serviceId: string
): Promise<{ data: Token | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to get a token.' }
  }

  const { data, error } = await supabase.rpc('create_token', {
    p_service: serviceId,
  })

  if (error) {
    // Extract friendly message from Postgres exception
    const msg = error.message ?? ''
    if (msg.includes('already have an active token')) {
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
  return { data: token ?? null, error: null }
}

export async function getActiveToken(
  userId: string
): Promise<Token | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tokens')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['waiting', 'called', 'recalled', 'in_service'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data as Token | null
}

export async function getTokenHistory(userId: string): Promise<Token[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tokens')
    .select('*, services(name, prefix), counters(name)')
    .eq('user_id', userId)
    .in('status', ['completed', 'skipped', 'missed', 'called'])
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as any[]
}

export async function getUserNotifications(userId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  return data ?? []
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient()
  await supabase.rpc('mark_notification_read', {
    p_notification: notificationId,
  })
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  await supabase.rpc('mark_all_notifications_read')
}
