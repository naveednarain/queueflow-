'use server'

import { createClient } from '@/lib/supabase/server'
import type { StaffCounter, StaffQueueItem, Token, DisplayCounterItem } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function getCounters(): Promise<StaffCounter[]> {
  const supabase = await createClient()

  const { data: counters, error } = await supabase
    .from('counters')
    .select(`
      *,
      departments(name),
      services(name)
    `)
    .order('name')

  if (error || !counters) return []

  // Collect current token IDs to fetch details
  const tokenIds = counters
    .map((c) => c.current_token)
    .filter((id): id is string => Boolean(id))

  const tokenMap: Record<string, any> = {}
  if (tokenIds.length > 0) {
    const { data: tokens } = await supabase
      .from('tokens')
      .select(`
        id,
        token_number,
        status,
        called_at,
        started_at,
        profiles(name, email),
        services(name),
        appointments(ref_no)
      `)
      .in('id', tokenIds)

    if (tokens) {
      for (const t of tokens as any[]) {
        tokenMap[t.id] = {
          id: t.id,
          token_number: t.token_number,
          status: t.status,
          called_at: t.called_at,
          started_at: t.started_at,
          user_name: t.profiles?.name ?? t.profiles?.email ?? 'Walk-in Customer',
          service_name: t.services?.name ?? null,
          appointment_ref: t.appointments?.ref_no ?? null,
        }
      }
    }
  }

  return counters.map((c: any) => ({
    id: c.id,
    department_id: c.department_id,
    name: c.name,
    service_id: c.service_id,
    assigned_staff: c.assigned_staff,
    status: c.status,
    current_token: c.current_token,
    department_name: c.departments?.name ?? 'Unknown',
    service_name: c.services?.name ?? null,
    current_token_details: c.current_token ? tokenMap[c.current_token] ?? null : null,
  }))
}

export async function getCounterDetails(counterId: string): Promise<StaffCounter | null> {
  const supabase = await createClient()

  const { data: counter, error } = await supabase
    .from('counters')
    .select(`
      *,
      departments(name),
      services(name)
    `)
    .eq('id', counterId)
    .single()

  if (error || !counter) return null

  let tokenDetails = null
  if (counter.current_token) {
    const { data: t } = await supabase
      .from('tokens')
      .select(`
        id,
        token_number,
        status,
        called_at,
        started_at,
        profiles(name, email),
        services(name),
        appointments(ref_no)
      `)
      .eq('id', counter.current_token)
      .single()

    if (t) {
      const token = t as any
      tokenDetails = {
        id: token.id,
        token_number: token.token_number,
        status: token.status,
        called_at: token.called_at,
        started_at: token.started_at,
        user_name: token.profiles?.name ?? token.profiles?.email ?? 'Walk-in Customer',
        service_name: token.services?.name ?? null,
        appointment_ref: token.appointments?.ref_no ?? null,
      }
    }
  }

  return {
    id: counter.id,
    department_id: counter.department_id,
    name: counter.name,
    service_id: counter.service_id,
    assigned_staff: counter.assigned_staff,
    status: counter.status,
    current_token: counter.current_token,
    department_name: (counter as any).departments?.name ?? 'Unknown',
    service_name: (counter as any).services?.name ?? null,
    current_token_details: tokenDetails,
  }
}

export async function setCounterStatus(
  counterId: string,
  status: 'available' | 'busy' | 'break' | 'closed'
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_counter_status', {
    p_counter: counterId,
    p_status: status,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/staff')
  revalidatePath('/display')
  return { success: true, error: null }
}

export async function callNextToken(
  counterId: string
): Promise<{ token: Token | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('call_next_token', {
    p_counter: counterId,
  })

  if (error) {
    return { token: null, error: error.message }
  }

  const token = Array.isArray(data) ? data[0] : data
  if (!token) {
    return { token: null, error: 'No waiting tokens in the queue.' }
  }

  revalidatePath('/staff')
  revalidatePath('/display')
  return { token: token as Token, error: null }
}

export async function startService(
  tokenId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('start_service', {
    p_token: tokenId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/staff')
  revalidatePath('/display')
  return { success: true, error: null }
}

export async function completeService(
  tokenId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('complete_service', {
    p_token: tokenId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/staff')
  revalidatePath('/display')
  return { success: true, error: null }
}

export async function recallToken(
  tokenId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('recall_token', {
    p_token: tokenId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/staff')
  revalidatePath('/display')
  return { success: true, error: null }
}

export async function skipToken(
  tokenId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('skip_token', {
    p_token: tokenId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/staff')
  revalidatePath('/display')
  return { success: true, error: null }
}

export async function markTokenMissed(
  tokenId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('mark_token_missed', {
    p_token: tokenId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/staff')
  revalidatePath('/display')
  return { success: true, error: null }
}

export async function getCounterQueue(counterId: string): Promise<StaffQueueItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_counter_queue', {
    p_counter: counterId,
  })

  if (error || !data) {
    return []
  }

  return data as StaffQueueItem[]
}

export async function getDisplayData(): Promise<{
  counters: DisplayCounterItem[]
  nextUp: Array<{ token_number: string; service_name: string; department_name: string }>
}> {
  const supabase = await createClient()

  // 1. Get all counters with department name
  const { data: counters } = await supabase
    .from('counters')
    .select(`
      id,
      name,
      status,
      current_token,
      departments(name)
    `)
    .order('name')

  if (!counters) return { counters: [], nextUp: [] }

  const tokenIds = counters
    .map((c) => c.current_token)
    .filter((id): id is string => Boolean(id))

  const tokenMap: Record<string, { token_number: string; status: any; service_name: string; called_at: string }> = {}

  if (tokenIds.length > 0) {
    const { data: tokens } = await supabase
      .from('tokens')
      .select('id, token_number, status, called_at, services(name)')
      .in('id', tokenIds)

    if (tokens) {
      for (const t of tokens as any[]) {
        tokenMap[t.id] = {
          token_number: t.token_number,
          status: t.status,
          service_name: t.services?.name ?? '',
          called_at: t.called_at,
        }
      }
    }
  }

  const displayCounters: DisplayCounterItem[] = counters.map((c: any) => ({
    counter_id: c.id,
    counter_name: c.name,
    department_name: c.departments?.name ?? '',
    status: c.status,
    token_number: c.current_token && tokenMap[c.current_token] ? tokenMap[c.current_token].token_number : null,
    token_status: c.current_token && tokenMap[c.current_token] ? tokenMap[c.current_token].status : null,
    service_name: c.current_token && tokenMap[c.current_token] ? tokenMap[c.current_token].service_name : null,
    called_at: c.current_token && tokenMap[c.current_token] ? tokenMap[c.current_token].called_at : null,
  }))

  // 2. Next up waiting tokens (first 8 across active services)
  const { data: nextTokens } = await supabase
    .from('tokens')
    .select(`
      token_number,
      created_at,
      services(name, departments(name))
    `)
    .in('status', ['waiting', 'recalled'])
    .order('created_at', { ascending: true })
    .limit(8)

  const nextUp = (nextTokens ?? []).map((t: any) => ({
    token_number: t.token_number,
    service_name: t.services?.name ?? '',
    department_name: t.services?.departments?.name ?? '',
  }))

  return { counters: displayCounters, nextUp }
}
