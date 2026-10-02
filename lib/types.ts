export type UserRole = 'customer' | 'staff' | 'manager' | 'admin'

export interface Profile {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: UserRole
  department_id: string | null
  account_status: string
  no_show_count: number
  created_at: string
}

export interface Department {
  id: string
  name: string
  open_time: string
  close_time: string
  break_start: string | null
  break_end: string | null
  slot_minutes: number
  max_per_slot: number
  working_days?: number[]
  created_at: string
}

export interface Service {
  id: string
  department_id: string
  name: string
  prefix: string
  avg_duration: number
  priority_level: number
  active: boolean
}

export interface Counter {
  id: string
  department_id: string
  name: string
  service_id: string | null
  assigned_staff: string | null
  status: 'available' | 'busy' | 'break' | 'closed'
  current_token: string | null
}

export type TokenStatus =
  | 'waiting'
  | 'called'
  | 'no_response'
  | 'recalled'
  | 'in_service'
  | 'completed'
  | 'skipped'
  | 'missed'

export interface Token {
  id: string
  token_number: string
  user_id: string | null
  service_id: string
  appointment_id: string | null
  counter_id: string | null
  status: TokenStatus
  queue_position: number | null
  estimated_wait: number | null
  recall_count: number
  created_at: string
  called_at: string | null
  started_at: string | null
  completed_at: string | null
}

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'missed'
  | 'rescheduled'
  | 'delayed'

export interface Appointment {
  id: string
  user_id: string
  service_id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  check_in_time: string | null
  ref_no: string | null
  no_show_risk: number | null
  created_at: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
  max_capacity: number
  booked_count: number
  status: 'available' | 'full'
}

export interface AppointmentWithDetails extends Appointment {
  services?: {
    id: string
    name: string
    prefix: string
    avg_duration: number
    departments?: {
      id: string
      name: string
    } | null
  } | null
  tokens?: {
    id: string
    token_number: string
    status: TokenStatus
  }[] | null
}



export interface Notification {
  id: string
  user_id: string
  message: string
  type: string | null
  read: boolean
  created_at: string
}

// RPC return shape for get_departments_with_services
export interface DepartmentWithService {
  department_id: string
  department_name: string
  working_days?: number[]
  service_id: string
  service_name: string
  prefix: string
  avg_duration: number
  active: boolean
}

// Grouped for the /token and /book page
export interface DepartmentGroup {
  id: string
  name: string
  working_days?: number[]
  services: Array<{
    id: string
    name: string
    prefix: string
    avg_duration: number
    active: boolean
  }>
}

export interface StaffQueueItem {
  token_id: string
  token_number: string
  status: TokenStatus
  queue_position: number | null
  estimated_wait: number | null
  recall_count: number
  created_at: string
  service_id: string
  service_name: string
  service_prefix: string
  appointment_id: string | null
  appointment_ref: string | null
  appointment_start_time: string | null
  appointment_no_show_risk: number | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  user_no_show_count: number
}

export interface StaffCounter extends Counter {
  department_name?: string
  service_name?: string | null
  current_token_details?: {
    id: string
    token_number: string
    status: TokenStatus
    called_at: string | null
    started_at: string | null
    user_name: string | null
    service_name: string | null
    appointment_ref: string | null
  } | null
}

export interface DisplayCounterItem {
  counter_id: string
  counter_name: string
  department_name: string
  status: 'available' | 'busy' | 'break' | 'closed'
  token_number: string | null
  token_status: TokenStatus | null
  service_name: string | null
  called_at: string | null
}
