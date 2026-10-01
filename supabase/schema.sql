create extension if not exists pgcrypto;

create type user_role as enum ('customer','staff','manager','admin');

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  open_time time not null default '09:00',
  close_time time not null default '17:00',
  break_start time,
  break_end time,
  slot_minutes int not null default 30,
  max_per_slot int not null default 6,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  email text,
  phone text,
  role user_role not null default 'customer',
  department_id uuid references departments,
  account_status text not null default 'active',
  no_show_count int not null default 0,
  created_at timestamptz default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments on delete cascade,
  name text not null,
  prefix char(1) not null default 'A',
  avg_duration int not null default 5,       -- minutes
  priority_level int not null default 0,     -- higher = served earlier
  active boolean not null default true
);

create table counters (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments on delete cascade,
  name text not null,
  service_id uuid references services,
  assigned_staff uuid references profiles,
  status text not null default 'closed',     -- available | busy | break | closed
  current_token uuid
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  service_id uuid not null references services,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed',  -- booked|confirmed|checked_in|waiting|in_service|completed|cancelled|missed|rescheduled|delayed
  check_in_time timestamptz,
  ref_no text unique,
  no_show_risk numeric,
  created_at timestamptz default now()
);

create table tokens (
  id uuid primary key default gen_random_uuid(),
  token_number text not null,                -- A-027
  user_id uuid references profiles,
  service_id uuid not null references services,
  appointment_id uuid references appointments,  -- null = walk-in
  counter_id uuid references counters,
  status text not null default 'waiting',    -- waiting|called|no_response|recalled|in_service|completed|skipped|missed
  queue_position int,
  estimated_wait int,                        -- minutes
  recall_count int not null default 0,
  created_at timestamptz default now(),
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  message text not null,
  type text,
  read boolean not null default false,
  created_at timestamptz default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  entity text,
  entity_id uuid,
  created_at timestamptz default now()
);

create table rules (
  department_id uuid primary key references departments on delete cascade,
  max_appts_per_user_day int not null default 2,
  max_active_tokens int not null default 1,
  cancel_limit int not null default 3,
  late_checkin_minutes int not null default 10,
  early_checkin_minutes int not null default 10
);

create index on tokens (service_id, status, created_at);
create index on tokens (user_id, status);
create index on appointments (appointment_date, service_id, start_time);
create index on notifications (user_id, read);

-- auto-create profile on signup
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, 'customer');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- enable realtime
alter publication supabase_realtime add table tokens, counters, appointments, notifications;
